// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IConsentRegistry.sol";
import "./interfaces/IContributionReceipt.sol";

/// @title ConsentRegistry
/// @notice Participant-owned consent and access-request state machine.
/// @dev The real CCP enforcement (verify CVI is active) is done by the Cleanverse
///      verify_apass API. This contract enforces local consent/receipt state and
///      records an immutable audit trail.
contract ConsentRegistry is IConsentRegistry, Ownable, Pausable, ReentrancyGuard {
    uint256 public _consentIds;
    uint256 public _requestIds;

    IContributionReceipt public immutable contributionReceipt;

    mapping(uint256 => Consent) public consents;
    mapping(uint256 => AccessRequest) public requests;

    // ── Indexes for scalable queries ──────────────────────────────
    mapping(address => uint256[]) internal _consentsByParticipant;
    mapping(address => uint256[]) internal _requestsByResearcher;
    mapping(uint256 => uint256[]) internal _requestsByConsent;

    error InvalidAddress();
    error ConsentNotFound(uint256 consentId);
    error NotParticipant(uint256 consentId, address caller);
    error ConsentNotActive(uint256 consentId);
    error ConsentAlreadyRevoked(uint256 consentId);
    error ConsentIsExpired(uint256 consentId);
    error ReceiptInvalid(uint256 receiptId);
    error RequestNotFound(uint256 requestId);
    error NotResearcher(uint256 requestId, address caller);
    error RequestNotPending(uint256 requestId);
    error RequestIsExpired(uint256 requestId);
    error AlreadySettled(uint256 requestId);
    error PurposeMismatch(uint256 consentId, bytes32 expected, bytes32 actual);
    error StudyMismatch(uint256 consentId, bytes32 expected, bytes32 actual);
    error InvalidExpiry();
    error CompensationTransferFailed(uint256 requestId);
    error CompensationRefundFailed(uint256 requestId);
    error ArrayLengthMismatch();

    constructor(address _contributionReceipt) Ownable(msg.sender) {
        if (_contributionReceipt == address(0)) revert InvalidAddress();
        contributionReceipt = IContributionReceipt(_contributionReceipt);
    }

    // ── Core lifecycle ────────────────────────────────────────────

    /// @inheritdoc IConsentRegistry
    function createConsent(
        bytes32 cviAttestationHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt,
        bytes calldata /*receiptData*/
    ) external override whenNotPaused returns (uint256 consentId, uint256 receiptId) {
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        _consentIds += 1;
        consentId = _consentIds;

        bytes32 fixtureHash = keccak256(
            abi.encodePacked(consentId, msg.sender, block.timestamp)
        );

        receiptId = contributionReceipt.issue(
            msg.sender,
            consentId,
            fixtureHash,
            studyId,
            purposeHash,
            policyVersion,
            expiresAt
        );

        consents[consentId] = Consent({
            consentId: consentId,
            participant: msg.sender,
            cviAttestationHash: cviAttestationHash,
            receiptId: receiptId,
            studyId: studyId,
            purposeHash: purposeHash,
            policyVersion: policyVersion,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revokedAt: 0,
            status: ConsentStatus.ACTIVE
        });

        _consentsByParticipant[msg.sender].push(consentId);

        emit ConsentCreated(
            consentId,
            msg.sender,
            studyId,
            cviAttestationHash,
            receiptId,
            purposeHash,
            policyVersion,
            expiresAt
        );
    }

    /// @inheritdoc IConsentRegistry
    function revokeConsent(uint256 consentId) external override {
        Consent storage c = consents[consentId];
        if (c.consentId == 0) revert ConsentNotFound(consentId);
        if (c.participant != msg.sender) revert NotParticipant(consentId, msg.sender);
        if (c.status != ConsentStatus.ACTIVE) revert ConsentNotActive(consentId);

        c.status = ConsentStatus.REVOKED;
        c.revokedAt = uint64(block.timestamp);

        contributionReceipt.revoke(c.receiptId);

        emit ConsentRevoked(consentId, msg.sender, c.revokedAt);
    }

    /// @inheritdoc IConsentRegistry
    function queueAccessRequest(
        uint256 consentId,
        bytes32 studyId,
        bytes32 purposeHash,
        uint64 expiresAt
    ) external payable override whenNotPaused returns (uint256 requestId) {
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        Consent storage c = consents[consentId];
        if (c.consentId == 0) revert ConsentNotFound(consentId);
        if (c.status != ConsentStatus.ACTIVE) revert ConsentNotActive(consentId);
        if (c.expiresAt <= block.timestamp) revert ConsentIsExpired(consentId);
        if (c.studyId != studyId) revert StudyMismatch(consentId, c.studyId, studyId);
        if (c.purposeHash != purposeHash)
            revert PurposeMismatch(consentId, c.purposeHash, purposeHash);

        _requestIds += 1;
        requestId = _requestIds;

        requests[requestId] = AccessRequest({
            requestId: requestId,
            consentId: consentId,
            receiptId: c.receiptId,
            researcher: msg.sender,
            studyId: studyId,
            purposeHash: purposeHash,
            queuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            compensation: msg.value,
            status: RequestStatus.PENDING,
            rejectionCode: RejectionCode.NONE
        });

        _requestsByResearcher[msg.sender].push(requestId);
        _requestsByConsent[consentId].push(requestId);

        emit AccessRequested(
            requestId,
            consentId,
            c.receiptId,
            msg.sender,
            msg.value,
            expiresAt
        );
    }

    /// @inheritdoc IConsentRegistry
    function settleAccessRequest(
        uint256 requestId,
        bool ccpPassed,
        bytes32 /*ccpReasonCode*/
    ) external override nonReentrant {
        _settle(requestId, ccpPassed);
    }

    /// @inheritdoc IConsentRegistry
    function batchSettle(
        uint256[] calldata requestIds,
        bool[] calldata ccpResults,
        bytes32[] calldata reasonCodes
    ) external override nonReentrant {
        if (requestIds.length != ccpResults.length || requestIds.length != reasonCodes.length)
            revert ArrayLengthMismatch();

        RequestStatus[] memory results = new RequestStatus[](requestIds.length);
        for (uint256 i = 0; i < requestIds.length; i++) {
            _settle(requestIds[i], ccpResults[i]);
            results[i] = requests[requestIds[i]].status;
        }
        emit BatchSettled(requestIds, results);
    }

    /// @inheritdoc IConsentRegistry
    function expireConsent(uint256 consentId) external override {
        Consent storage c = consents[consentId];
        if (c.consentId == 0) revert ConsentNotFound(consentId);
        if (c.status != ConsentStatus.ACTIVE) revert ConsentNotActive(consentId);
        if (c.expiresAt > block.timestamp) revert ConsentNotActive(consentId);

        c.status = ConsentStatus.EXPIRED;
        c.revokedAt = uint64(block.timestamp);

        contributionReceipt.revoke(c.receiptId);

        emit ConsentExpired(consentId, c.participant);
    }

    // ── Emergency stop ─────────────────────────────────────────────

    /// @notice Pause the registry to block new activity during emergencies.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the registry to restore normal activity.
    function unpause() external onlyOwner {
        _unpause();
    }

    // ── Internal ──────────────────────────────────────────────────

    function _settle(uint256 requestId, bool ccpPassed) internal {
        AccessRequest storage r = requests[requestId];
        if (r.requestId == 0) revert RequestNotFound(requestId);
        if (r.status != RequestStatus.PENDING) revert RequestNotPending(requestId);
        if (r.researcher != msg.sender) revert NotResearcher(requestId, msg.sender);
        if (r.expiresAt <= block.timestamp) revert RequestIsExpired(requestId);

        // Cache consent fields to avoid redundant SLOADs
        uint256 cReceiptId = r.receiptId;
        uint256 cConsentId = r.consentId;
        address cParticipant;

        {
            Consent storage c = consents[cConsentId];
            if (c.status != ConsentStatus.ACTIVE) revert ConsentNotActive(cConsentId);
            if (c.expiresAt <= block.timestamp) revert ConsentIsExpired(cConsentId);
            cParticipant = c.participant;
        }

        // External call last (CEI pattern — though nonReentrant already guards)
        if (!contributionReceipt.isValid(cReceiptId)) revert ReceiptInvalid(cReceiptId);

        uint256 comp = r.compensation;
        if (ccpPassed) {
            r.status = RequestStatus.APPROVED;
            emit AccessApproved(requestId, msg.sender);

            if (comp > 0) {
                (bool sent, ) = payable(cParticipant).call{value: comp}("");
                if (!sent) revert CompensationTransferFailed(requestId);
            }
        } else {
            r.status = RequestStatus.REJECTED;
            r.rejectionCode = RejectionCode.CVI_REVOKED;
            emit AccessRejected(requestId, r.rejectionCode);

            if (comp > 0) {
                (bool sent, ) = payable(r.researcher).call{value: comp}("");
                if (!sent) revert CompensationRefundFailed(requestId);
            }
        }
    }

    // ── View functions ───────────────────────────────────────────

    /// @inheritdoc IConsentRegistry
    function getConsent(uint256 consentId) external view override returns (Consent memory) {
        Consent memory c = consents[consentId];
        if (c.consentId == 0) revert ConsentNotFound(consentId);
        return c;
    }

    /// @inheritdoc IConsentRegistry
    function getAccessRequest(uint256 requestId) external view override returns (AccessRequest memory) {
        AccessRequest memory r = requests[requestId];
        if (r.requestId == 0) revert RequestNotFound(requestId);
        return r;
    }

    /// @inheritdoc IConsentRegistry
    function consentStatus(uint256 consentId) external view override returns (ConsentStatus) {
        Consent storage c = consents[consentId];
        if (c.consentId == 0) revert ConsentNotFound(consentId);
        if (c.status == ConsentStatus.ACTIVE && c.expiresAt <= block.timestamp) {
            return ConsentStatus.EXPIRED;
        }
        return c.status;
    }

    /// @inheritdoc IConsentRegistry
    function getConsentsByParticipant(address participant) external view override returns (uint256[] memory) {
        return _consentsByParticipant[participant];
    }

    /// @inheritdoc IConsentRegistry
    function getRequestsByResearcher(address researcher) external view override returns (uint256[] memory) {
        return _requestsByResearcher[researcher];
    }

    /// @inheritdoc IConsentRegistry
    function getRequestsByConsent(uint256 consentId) external view override returns (uint256[] memory) {
        return _requestsByConsent[consentId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IConsentRegistry.sol";
import "./interfaces/IContributionReceipt.sol";

/// @title ConsentRegistry
/// @notice Participant-owned consent and access-request state machine.
/// @dev The real CCP enforcement (verify CVI is active) is done by the Cleanverse
///      verify_apass API. This contract enforces local consent/receipt state and
///      records an immutable audit trail.
contract ConsentRegistry is IConsentRegistry, ReentrancyGuard {
    uint256 public _consentIds;
    uint256 public _requestIds;

    IContributionReceipt public immutable contributionReceipt;

    mapping(uint256 => Consent) public consents;
    mapping(uint256 => AccessRequest) public requests;

    error InvalidAddress();
    error ConsentNotFound(uint256 consentId);
    error NotParticipant(uint256 consentId, address caller);
    error ConsentNotActive(uint256 consentId);
    error ConsentAlreadyRevoked(uint256 consentId);
    error ConsentExpired(uint256 consentId);
    error ReceiptInvalid(uint256 receiptId);
    error RequestNotFound(uint256 requestId);
    error NotResearcher(uint256 requestId, address caller);
    error RequestNotPending(uint256 requestId);
    error RequestExpired(uint256 requestId);
    error AlreadySettled(uint256 requestId);
    error PurposeMismatch(uint256 consentId, bytes32 expected, bytes32 actual);
    error StudyMismatch(uint256 consentId, bytes32 expected, bytes32 actual);
    error InvalidExpiry();
    error CompensationTransferFailed(uint256 requestId);
    error CompensationRefundFailed(uint256 requestId);

    constructor(address _contributionReceipt) {
        if (_contributionReceipt == address(0)) revert InvalidAddress();
        contributionReceipt = IContributionReceipt(_contributionReceipt);
    }

    /// @inheritdoc IConsentRegistry
    function createConsent(
        bytes32 cviAttestationHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt,
        bytes calldata /*receiptData*/
    ) external override returns (uint256 consentId, uint256 receiptId) {
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
    ) external payable override returns (uint256 requestId) {
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        Consent storage c = consents[consentId];
        if (c.consentId == 0) revert ConsentNotFound(consentId);
        if (c.status != ConsentStatus.ACTIVE) revert ConsentNotActive(consentId);
        if (c.expiresAt <= block.timestamp) revert ConsentExpired(consentId);
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
        AccessRequest storage r = requests[requestId];
        if (r.requestId == 0) revert RequestNotFound(requestId);
        if (r.status != RequestStatus.PENDING) revert RequestNotPending(requestId);
        if (r.researcher != msg.sender) revert NotResearcher(requestId, msg.sender);
        if (r.expiresAt <= block.timestamp) revert RequestExpired(requestId);

        // Local consent/receipt state sanity checks
        Consent storage c = consents[r.consentId];
        if (c.status != ConsentStatus.ACTIVE) revert ConsentNotActive(r.consentId);
        if (c.expiresAt <= block.timestamp) revert ConsentExpired(r.consentId);
        if (!contributionReceipt.isValid(r.receiptId)) revert ReceiptInvalid(r.receiptId);

        if (ccpPassed) {
            r.status = RequestStatus.APPROVED;
            emit AccessApproved(requestId, msg.sender);

            // Transfer compensation to participant
            if (r.compensation > 0) {
                (bool sent, ) = payable(c.participant).call{value: r.compensation}("");
                if (!sent) revert CompensationTransferFailed(requestId);
            }
        } else {
            r.status = RequestStatus.REJECTED;
            r.rejectionCode = RejectionCode.CVI_REVOKED;
            emit AccessRejected(requestId, r.rejectionCode);

            // Refund compensation to researcher
            if (r.compensation > 0) {
                (bool sent, ) = payable(r.researcher).call{value: r.compensation}("");
                if (!sent) revert CompensationRefundFailed(requestId);
            }
        }
    }

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
        return consents[consentId].status;
    }
}

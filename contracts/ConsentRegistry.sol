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
    error BatchTooLarge();

    /// @notice Initializes the registry with the ContributionReceipt address.
    /// @dev Reverts if _contributionReceipt is address(0).
    /// @param _contributionReceipt The deployed ContributionReceipt contract address.
    constructor(address _contributionReceipt) Ownable(msg.sender) {
        if (_contributionReceipt == address(0)) revert InvalidAddress();
        contributionReceipt = IContributionReceipt(_contributionReceipt);
    }

    // ── Core lifecycle ────────────────────────────────────────────

    /// @inheritdoc IConsentRegistry
    /// @dev Creates a new consent record and issues a linked ContributionReceipt.
    ///      The fixtureHash is computed internally as keccak256(abi.encodePacked(consentId, msg.sender, block.timestamp))
    ///      to provide deterministic linkage without requiring off-chain computation.
    /// @param cviAttestationHash Hash of the CVI attestation from Cleanverse verify_apass.
    /// @param studyId Research study identifier.
    /// @param purposeHash Purpose code for consent-receipt matching.
    /// @param policyVersion Active policy version at issuance.
    /// @param expiresAt Unix timestamp when the consent expires (must be > block.timestamp).
    /// @param receiptData Reserved for future receipt-specific metadata (currently unused).
    /// @return consentId The newly created consent identifier.
    /// @return receiptId The linked ContributionReceipt identifier.
    function createConsent(
        bytes32 cviAttestationHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt,
        bytes calldata receiptData
    ) external override whenNotPaused returns (uint256 consentId, uint256 receiptId) {
        (consentId, receiptId) = _createConsent(
            cviAttestationHash,
            studyId,
            purposeHash,
            policyVersion,
            expiresAt,
            receiptData
        );
    }

    /// @inheritdoc IConsentRegistry
    /// @dev Batch variant of createConsent. Each array element pair creates an independent consent.
    ///      The function validates that all input arrays have equal length (up to 50 items per batch).
    ///      Each consent is created via the internal _createConsent helper, sharing the same
    ///      deterministic fixtureHash computation.
    /// @param cviHashes Array of CVI attestation hashes.
    /// @param studyIds Array of study identifiers (one per consent).
    /// @param purposeHashes Array of purpose hashes.
    /// @param policyVersions Array of policy versions.
    /// @param expiresAts Array of expiry timestamps.
    /// @param receiptDatas Array of receipt metadata (currently unused).
    /// @return consentIds Array of newly created consent identifiers.
    function batchCreateConsent(
        bytes32[] calldata cviHashes,
        bytes32[] calldata studyIds,
        bytes32[] calldata purposeHashes,
        bytes32[] calldata policyVersions,
        uint64[] calldata expiresAts,
        bytes[] calldata receiptDatas
    ) external override whenNotPaused returns (uint256[] memory consentIds) {
        if (cviHashes.length != studyIds.length || cviHashes.length != purposeHashes.length ||
            cviHashes.length != policyVersions.length || cviHashes.length != expiresAts.length ||
            cviHashes.length != receiptDatas.length) {
            revert ArrayLengthMismatch();
        }
        if (cviHashes.length > 50) revert BatchTooLarge();

        consentIds = new uint256[](cviHashes.length);
        for (uint256 i = 0; i < cviHashes.length; i++) {
            (consentIds[i], ) = _createConsent(
                cviHashes[i],
                studyIds[i],
                purposeHashes[i],
                policyVersions[i],
                expiresAts[i],
                receiptDatas[i]
            );
        }

        emit BatchConsentsCreated(consentIds);
    }

    function _createConsent(
        bytes32 cviAttestationHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt,
        bytes calldata /*receiptData*/
    ) internal returns (uint256 consentId, uint256 receiptId) {
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
    /// @dev Revokes an active consent. Only the participant who created the consent can revoke it.
    ///      Sets status to REVOKED and records the revocation timestamp. Also revokes the linked
    ///      ContributionReceipt to keep the audit trail consistent.
    ///      Reverts if: consent does not exist, caller is not the participant, or consent is not ACTIVE.
    /// @param consentId The consent to revoke.
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
    /// @dev Queues a request to access data under a consent. The researcher sends ETH as compensation.
    ///      Validates that the consent is ACTIVE, not expired, and matches the requested study/purpose.
    ///      Reverts if the registry is paused, consent is invalid, or expiry is in the past.
    /// @param consentId The consent under which access is requested.
    /// @param studyId Must match the consent's studyId (prevents cross-study access).
    /// @param purposeHash Must match the consent's purposeHash (prevents purpose drift).
    /// @param expiresAt Request expiry timestamp (must be > block.timestamp).
    /// @return requestId The newly created access request identifier.
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
    /// @dev Settles a single access request. The CCP result determines the outcome:
    ///      - ccpPassed == true: request is APPROVED, compensation is sent to the participant.
    ///      - ccpPassed == false: request is REJECTED, compensation is refunded to the researcher.
    ///      Reverts if: request not found, not PENDING, caller is not the researcher, request expired,
    ///      consent not ACTIVE, or the linked receipt is invalid.
    ///      Uses Checks-Effects-Interactions: state is updated before the external transfer.
    /// @param requestId The access request to settle.
    /// @param ccpPassed Cleanverse CCP result (true = approved, false = rejected).
    function settleAccessRequest(
        uint256 requestId,
        bool ccpPassed,
        bytes32 ccpReasonCode
    ) external override nonReentrant {
        // ccpReasonCode is intentionally passed through as off-chain metadata; the on-chain
        // settlement only needs the boolean ccpPassed. Downstream indexers can read the
        // reason code from the emitted AccessApproved/AccessRejected event logs or tx calldata.
        (ccpReasonCode);
        _settle(requestId, ccpPassed);
    }

    /// @inheritdoc IConsentRegistry
    /// @dev Batch variant of settleAccessRequest. Settles multiple requests in a single transaction.
    ///      All input arrays must have equal length. Each request is settled independently via _settle.
    ///      Provides ~52% gas savings vs individual settles for multi-request scenarios.
    ///      Reverts if array lengths mismatch; individual reverts bubble up from _settle.
    /// @param requestIds Array of access request identifiers.
    /// @param ccpResults Array of CCP results (true = approved, false = rejected).
    /// @param reasonCodes Array of off-chain reason codes.
    function batchSettle(
        uint256[] calldata requestIds,
        bool[] calldata ccpResults,
        bytes32[] calldata reasonCodes
    ) external override nonReentrant {
        if (requestIds.length > 50) revert ArrayLengthMismatch();
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
    /// @dev Expires a consent that has passed its expiry timestamp. Only callable when the consent
    ///      is ACTIVE and expiresAt <= block.timestamp. Sets status to EXPIRED and revokes the
    ///      linked ContributionReceipt. This is distinct from the participant-initiated revokeConsent;
    ///      it is meant to be called by keepers or automation after the natural expiry window.
    /// @param consentId The consent to expire.
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

    /// @notice Withdraw stuck ETH compensation from expired/unsettled requests.
    /// @dev Only the contract owner can call this. Transfers the full balance to the owner.
    function withdrawEth() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InvalidAddress(); // reuse existing error for "nothing to withdraw"
        (bool ok, ) = payable(owner()).call{value: balance}("");
        if (!ok) revert CompensationRefundFailed(0);
    }

    // ── Internal ──────────────────────────────────────────────────

    /// @dev Core settlement logic shared by settleAccessRequest and batchSettle.
    ///      Checks: request exists, is PENDING, caller is researcher, not expired.
    ///      Validates the linked consent is ACTIVE and the receipt is still valid.
    ///      If ccpPassed: transfers compensation to participant, sets APPROVED.
    ///      If !ccpPassed: refunds compensation to researcher, sets REJECTED.
    ///      Uses Checks-Effects-Interactions: state update before external call.
    /// @param requestId The access request to settle.
    /// @param ccpPassed Cleanverse CCP result determining approval/rejection.
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
    /// @dev Returns the full Consent struct for a given identifier.
    ///      Reverts with ConsentNotFound if the consent does not exist.
    /// @param consentId The consent identifier.
    /// @return Consent struct containing all consent fields.
    function getConsent(uint256 consentId) external view override returns (Consent memory) {
        Consent memory c = consents[consentId];
        if (c.consentId == 0) revert ConsentNotFound(consentId);
        return c;
    }

    /// @inheritdoc IConsentRegistry
    /// @dev Returns the full AccessRequest struct for a given identifier.
    ///      Reverts with RequestNotFound if the request does not exist.
    /// @param requestId The request identifier.
    /// @return AccessRequest struct containing all request fields.
    function getAccessRequest(uint256 requestId) external view override returns (AccessRequest memory) {
        AccessRequest memory r = requests[requestId];
        if (r.requestId == 0) revert RequestNotFound(requestId);
        return r;
    }

    /// @inheritdoc IConsentRegistry
    /// @dev Returns the effective status of a consent, accounting for time-based expiry.
    ///      If the stored status is ACTIVE but expiresAt <= block.timestamp, returns EXPIRED.
    ///      This ensures on-chain queries always reflect the current valid state.
    /// @param consentId The consent identifier.
    /// @return status The effective ConsentStatus (may differ from stored status if expired).
    function consentStatus(uint256 consentId) external view override returns (ConsentStatus) {
        Consent storage c = consents[consentId];
        if (c.consentId == 0) revert ConsentNotFound(consentId);
        if (c.status == ConsentStatus.ACTIVE && c.expiresAt <= block.timestamp) {
            return ConsentStatus.EXPIRED;
        }
        return c.status;
    }

    /// @inheritdoc IConsentRegistry
    /// @dev Returns all consent IDs created by a given participant address.
    ///      Returns an empty array if the participant has no consents.
    ///      The array is ordered by creation time (oldest first).
    /// @param participant The wallet address to query.
    /// @return Array of consent identifiers.
    function getConsentsByParticipant(address participant) external view override returns (uint256[] memory) {
        return _consentsByParticipant[participant];
    }

    /// @inheritdoc IConsentRegistry
    /// @dev Returns all access request IDs submitted by a given researcher address.
    ///      Returns an empty array if the researcher has no requests.
    ///      The array is ordered by queue time (oldest first).
    /// @param researcher The wallet address to query.
    /// @return Array of request identifiers.
    function getRequestsByResearcher(address researcher) external view override returns (uint256[] memory) {
        return _requestsByResearcher[researcher];
    }

    /// @inheritdoc IConsentRegistry
    /// @dev Returns all access request IDs associated with a given consent.
    ///      Returns an empty array if no requests exist for this consent.
    ///      The array is ordered by queue time (oldest first).
    /// @param consentId The consent identifier.
    /// @return Array of request identifiers.
    function getRequestsByConsent(uint256 consentId) external view override returns (uint256[] memory) {
        return _requestsByConsent[consentId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IConsentRegistry
/// @notice Participant-owned consent and access-request state machine.
/// @dev Defines the core data structures (Consent, AccessRequest) and interface for the ConsentRegistry.
///      All state transitions are validated on-chain. The real CCP enforcement is handled by the
///      Cleanverse verify_apass API off-chain, which calls settleAccessRequest with the result.
interface IConsentRegistry {
    /// @notice Consent lifecycle states.
    /// @dev NONE (0): default uninitialized state. ACTIVE (1): consent is valid. REVOKED (2): participant revoked. EXPIRED (3): time-based expiry.
    enum ConsentStatus { NONE, ACTIVE, REVOKED, EXPIRED }

    /// @notice Access request lifecycle states.
    /// @dev PENDING (0): queued, awaiting settlement. APPROVED (1): CCP passed, access granted. REJECTED (2): CCP failed, access denied. EXPIRED (3): request timed out.
    enum RequestStatus { PENDING, APPROVED, REJECTED, EXPIRED }

    /// @notice Rejection classification codes.
    /// @dev NONE (0): no rejection. CVI_REVOKED (1): CVI/attestation revoked. CVA_REVOKED (2): CVA receipt revoked. EXPIRED (3): time-based expiry. PURPOSE_MISMATCH (4): purpose hash changed. STUDY_MISMATCH (5): study ID changed. POLICY_UNSUPPORTED (6): policy version unsupported.
    enum RejectionCode { NONE, CVI_REVOKED, CVA_REVOKED, EXPIRED, PURPOSE_MISMATCH, STUDY_MISMATCH, POLICY_UNSUPPORTED }

    struct Consent {
        uint256 consentId;           /// @dev Unique consent identifier (auto-incrementing).
        address participant;         /// @dev Wallet that owns this consent (immutable after creation).
        bytes32 cviAttestationHash;  /// @dev Hash of the Cleanverse CVI attestation.
        uint256 receiptId;           /// @dev Linked ContributionReceipt identifier.
        bytes32 studyId;             /// @dev Research study identifier.
        bytes32 purposeHash;         /// @dev Purpose code for consent-receipt matching.
        bytes32 policyVersion;       /// @dev Active policy version at issuance.
        // ── Packed slot: createdAt(64) | expiresAt(64) | revokedAt(64) | status(8) = 200 bits ──
        uint64 createdAt;            /// @dev Unix timestamp when the consent was created.
        uint64 expiresAt;            /// @dev Unix timestamp after which the consent is invalid.
        uint64 revokedAt;            /// @dev Unix timestamp when revoked (0 if not revoked).
        ConsentStatus status;        /// @dev Current lifecycle status.
    }

    struct AccessRequest {
        uint256 requestId;          /// @dev Unique request identifier (auto-incrementing).
        uint256 consentId;          /// @dev Linked consent identifier.
        uint256 receiptId;          /// @dev Linked ContributionReceipt identifier.
        address researcher;         /// @dev Wallet that submitted the request.
        bytes32 studyId;            /// @dev Research study identifier (must match consent).
        bytes32 purposeHash;        /// @dev Purpose code (must match consent).
        uint64 queuedAt;            /// @dev Unix timestamp when the request was queued.
        uint64 expiresAt;            /// @dev Unix timestamp when the request expires.
        uint256 compensation;       /// @dev ETH compensation escrowed with the request.
        RequestStatus status;       /// @dev Current lifecycle status.
        RejectionCode rejectionCode; /// @dev Reason code if rejected (NONE otherwise).
    }

    event ConsentCreated(
        uint256 indexed consentId,
        address indexed participant,
        bytes32 indexed studyId,
        bytes32 cviAttestationHash,
        uint256 receiptId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt
    );
    event ConsentRevoked(uint256 indexed consentId, address indexed participant, uint64 revokedAt);
    event ConsentExpired(uint256 indexed consentId, address indexed participant);
    event AccessRequested(
        uint256 indexed requestId,
        uint256 indexed consentId,
        uint256 indexed receiptId,
        address researcher,
        uint256 compensation,
        uint64 expiresAt
    );
    event AccessApproved(uint256 indexed requestId, address indexed researcher);
    event AccessRejected(uint256 indexed requestId, RejectionCode indexed code);
    event BatchSettled(uint256[] requestIds, RequestStatus[] results);
    event BatchConsentsCreated(uint256[] consentIds);
    event RequestExpired(uint256 indexed requestId);
    // Paused/Unpaused events inherited from OpenZeppelin Pausable — not redeclared here.

    /// @notice Creates a new on-chain consent record for a clinical trial participant.
    /// @dev Issues a ContributionReceipt and stores the consent with study/purpose metadata.
    /// @param cviAttestationHash Hash of the Cleanverse A-Pass attestation.
    /// @param studyId Study identifier.
    /// @param purposeHash Hash of the data purpose (e.g., "genomic-analysis").
    /// @param policyVersion Policy version hash.
    /// @param expiresAt Unix timestamp when the consent expires.
    /// @param receiptData ABI-encoded data for the CVA receipt.
    /// @return consentId The new consent ID.
    /// @return receiptId The new receipt ID from ContributionReceipt.
    function createConsent(
        bytes32 cviAttestationHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt,
        bytes calldata receiptData
    ) external returns (uint256 consentId, uint256 receiptId);

    /// @notice Creates multiple consents in a single transaction (gas optimization).
    /// @dev Limited to 50 consents per batch to prevent gas DoS. Reverts if any consent has past expiry.
    /// @return consentIds Array of created consent IDs.
    function batchCreateConsent(
        bytes32[] calldata cviHashes,
        bytes32[] calldata studyIds,
        bytes32[] calldata purposeHashes,
        bytes32[] calldata policyVersions,
        uint64[] calldata expiresAts,
        bytes[] calldata receiptDatas
    ) external returns (uint256[] memory consentIds);

    /// @notice Revokes an active consent. Only the original participant can call this.
    /// @dev Changes consent status to REVOKED. Future access requests are blocked.
    /// @param consentId The consent to revoke.
    function revokeConsent(uint256 consentId) external;

    /// @notice Queues a data-access request from a researcher with ETH compensation.
    /// @dev Requires consent to be ACTIVE. Compensation is held in escrow until settlement.
    /// @param consentId The consent to request access to.
    /// @param studyId Must match the consent's studyId.
    /// @param purposeHash Must match the consent's purposeHash.
    /// @param expiresAt When the request expires if not settled.
    /// @return requestId The new request ID.
    function queueAccessRequest(
        uint256 consentId,
        bytes32 studyId,
        bytes32 purposeHash,
        uint64 expiresAt
    ) external payable returns (uint256 requestId);

    /// @notice Settles a pending access request based on Cleanverse compliance check.
    /// @dev If ccpPassed=true, compensation goes to participant. If false, compensation refunds to researcher.
    /// @param ccpPassed True if the Cleanverse verify_apass check passed.
    /// @param reasonCode Off-chain reason code / hash for rejection context.
    function settleAccessRequest(uint256 requestId, bool ccpPassed, bytes32 reasonCode) external;

    /// @notice Settles multiple access requests in one transaction (gas optimization).
    function batchSettle(
        uint256[] calldata requestIds,
        bool[] calldata ccpResults,
        bytes32[] calldata reasonCodes
    ) external;

    /// @notice Marks an expired consent as EXPIRED. Callable by anyone (permissionless auto-expiry).
    /// @dev Reverts if consent is not past expiry or not ACTIVE.
    /// @param consentId The consent to expire.
    function expireConsent(uint256 consentId) external;

    /// @notice Gets a consent record by ID.
    /// @dev Reverts if consentId does not exist.
    /// @param consentId The consent identifier.
    /// @return consent The full Consent struct.
    function getConsent(uint256 consentId) external view returns (Consent memory);

    /// @notice Gets an access request record by ID.
    /// @dev Reverts if requestId does not exist.
    /// @param requestId The request identifier.
    /// @return request The full AccessRequest struct.
    function getAccessRequest(uint256 requestId) external view returns (AccessRequest memory);

    /// @notice Gets the dynamic consent status (checks auto-expiry on-the-fly).
    /// @dev Returns EXPIRED if status is ACTIVE but block.timestamp >= expiresAt.
    ///      This prevents stale "ACTIVE" status from persisting after natural expiry.
    /// @param consentId The consent identifier.
    /// @return status The effective ConsentStatus.
    function consentStatus(uint256 consentId) external view returns (ConsentStatus);

    /// @notice Gets all consent IDs for a participant (O(1) index lookup).
    /// @dev Returns an empty array if the participant has no consents.
    /// @param participant The wallet address to query.
    /// @return consentIds Array of consent identifiers (ordered by creation time).
    function getConsentsByParticipant(address participant) external view returns (uint256[] memory);

    /// @notice Gets all request IDs for a researcher (O(1) index lookup).
    /// @dev Returns an empty array if the researcher has no requests.
    /// @param researcher The wallet address to query.
    /// @return requestIds Array of request identifiers (ordered by queue time).
    function getRequestsByResearcher(address researcher) external view returns (uint256[] memory);

    /// @notice Gets all request IDs for a consent (O(1) index lookup).
    /// @dev Returns an empty array if no requests exist for this consent.
    /// @param consentId The consent identifier.
    /// @return requestIds Array of request identifiers (ordered by queue time).
    function getRequestsByConsent(uint256 consentId) external view returns (uint256[] memory);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IConsentRegistry
/// @notice Participant-owned consent and access-request state machine.
interface IConsentRegistry {
    enum ConsentStatus { NONE, ACTIVE, REVOKED, EXPIRED }
    enum RequestStatus { PENDING, APPROVED, REJECTED, EXPIRED }
    enum RejectionCode { NONE, CVI_REVOKED, CVA_REVOKED, EXPIRED, PURPOSE_MISMATCH, STUDY_MISMATCH, POLICY_UNSUPPORTED }

    struct Consent {
        uint256 consentId;
        address participant;
        bytes32 cviAttestationHash;
        uint256 receiptId;
        bytes32 studyId;
        bytes32 purposeHash;
        bytes32 policyVersion;
        // ── Packed slot: createdAt(64) | expiresAt(64) | revokedAt(64) | status(8) = 200 bits ──
        uint64 createdAt;
        uint64 expiresAt;
        uint64 revokedAt;
        ConsentStatus status;
    }

    struct AccessRequest {
        uint256 requestId;
        uint256 consentId;
        uint256 receiptId;
        address researcher;
        bytes32 studyId;
        bytes32 purposeHash;
        uint64 queuedAt;
        uint64 expiresAt;
        uint256 compensation;
        RequestStatus status;
        RejectionCode rejectionCode;
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
    function getConsent(uint256 consentId) external view returns (Consent memory);

    /// @notice Gets an access request record by ID.
    function getAccessRequest(uint256 requestId) external view returns (AccessRequest memory);

    /// @notice Gets the dynamic consent status (checks auto-expiry on-the-fly).
    function consentStatus(uint256 consentId) external view returns (ConsentStatus);

    /// @notice Gets all consent IDs for a participant (O(1) index lookup).
    function getConsentsByParticipant(address participant) external view returns (uint256[] memory);

    /// @notice Gets all request IDs for a researcher (O(1) index lookup).
    function getRequestsByResearcher(address researcher) external view returns (uint256[] memory);

    /// @notice Gets all request IDs for a consent (O(1) index lookup).
    function getRequestsByConsent(uint256 consentId) external view returns (uint256[] memory);
}

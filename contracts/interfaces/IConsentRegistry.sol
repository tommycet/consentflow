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
    event RequestExpired(uint256 indexed requestId);
    event Paused(address account);
    event Unpaused(address account);

    function createConsent(
        bytes32 cviAttestationHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt,
        bytes calldata receiptData
    ) external returns (uint256 consentId, uint256 receiptId);

    function revokeConsent(uint256 consentId) external;

    function queueAccessRequest(
        uint256 consentId,
        bytes32 studyId,
        bytes32 purposeHash,
        uint64 expiresAt
    ) external payable returns (uint256 requestId);

    /// @param ccpPassed True if the Cleanverse verify_apass/API check passed.
    /// @param reasonCode Off-chain reason code / hash for rejection context.
    function settleAccessRequest(uint256 requestId, bool ccpPassed, bytes32 reasonCode) external;

    function batchSettle(
        uint256[] calldata requestIds,
        bool[] calldata ccpResults,
        bytes32[] calldata reasonCodes
    ) external;

    function expireConsent(uint256 consentId) external;

    function getConsent(uint256 consentId) external view returns (Consent memory);
    function getAccessRequest(uint256 requestId) external view returns (AccessRequest memory);
    function consentStatus(uint256 consentId) external view returns (ConsentStatus);
    function getConsentsByParticipant(address participant) external view returns (uint256[] memory);
    function getRequestsByResearcher(address researcher) external view returns (uint256[] memory);
    function getRequestsByConsent(uint256 consentId) external view returns (uint256[] memory);
}

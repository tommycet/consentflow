// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IContributionReceipt
/// @notice Purpose-bound, wallet-locked CVA receipt representing one consent's data contribution.
/// @dev Non-transferable. Commits to fixtureHash only — no health payload, URI, or PII.
interface IContributionReceipt {
    enum ReceiptStatus {
        ACTIVE,
        REVOKED
    }

    struct Receipt {
        uint256 receiptId;
        uint256 consentId;
        address participant;
        bytes32 fixtureHash;   // hash of synthetic fixture; never a real data hash
        bytes32 studyId;
        bytes32 purposeHash;
        bytes32 policyVersion;
        uint64 issuedAt;
        uint64 expiresAt;
        uint64 revokedAt;
        ReceiptStatus status;
    }

    event ReceiptIssued(
        uint256 indexed receiptId,
        uint256 indexed consentId,
        address indexed participant,
        bytes32 fixtureHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt
    );
    event ReceiptRevoked(
        uint256 indexed receiptId,
        uint256 indexed consentId,
        address indexed participant,
        uint64 revokedAt
    );

    /// @notice Mint a receipt for a newly created consent.
    /// @dev Callable only by the ConsentRegistry.
    function issue(
        address participant,
        uint256 consentId,
        bytes32 fixtureHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt
    ) external returns (uint256 receiptId);

    /// @notice Revoke a receipt, triggered by ConsentRegistry on consent revocation.
    /// @dev Only the ConsentRegistry may call this. Terminal; status cannot return to ACTIVE.
    function revoke(uint256 receiptId) external;

    function getReceipt(uint256 receiptId) external view returns (Receipt memory);

    function isValid(uint256 receiptId) external view returns (bool);

    function receiptStatus(uint256 receiptId) external view returns (ReceiptStatus);
}

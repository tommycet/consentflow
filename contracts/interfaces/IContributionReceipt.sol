// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IContributionReceipt
/// @notice Purpose-bound, wallet-locked CVA receipt.
/// @dev Each receipt is bound to a single participant address and cannot be transferred.
///      Status transitions are ACTIVE → REVOKED or ACTIVE → EXPIRED.
interface IContributionReceipt {
    /// @notice Receipt lifecycle states.
    enum ReceiptStatus { NONE, ACTIVE, REVOKED, EXPIRED }

    /// @notice Immutable receipt issued against a consent.
    struct Receipt {
        uint256 receiptId;         /// @dev Unique receipt identifier (auto-incrementing).
        uint256 consentId;         /// @dev Linked consent identifier.
        address participant;       /// @dev Wallet that owns this receipt (immutable after issue).
        bytes32 fixtureHash;       /// @dev Deterministic hash of consentId + participant + timestamp.
        bytes32 studyId;           /// @dev Research study identifier for linkage.
        bytes32 purposeHash;       /// @dev Purpose code for consent-receipt matching.
        bytes32 policyVersion;     /// @dev Active policy version at time of issuance.
        uint64 issuedAt;           /// @dev Unix timestamp when the receipt was issued.
        uint64 expiresAt;          /// @dev Unix timestamp after which the receipt is invalid.
        uint64 revokedAt;          /// @dev Unix timestamp when revoked (0 if not revoked).
        ReceiptStatus status;      /// @dev Current lifecycle status.
    }

    /// @notice Emitted when a receipt is issued.
    /// @param receiptId Auto-incremented receipt identifier.
    /// @param consentId Linked consent identifier.
    /// @param participant Bound wallet address.
    /// @param fixtureHash Deterministic fixture hash.
    /// @param studyId Research study identifier.
    /// @param purposeHash Purpose code.
    /// @param policyVersion Policy version string.
    /// @param expiresAt Expiry timestamp.
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

    /// @notice Emitted when a receipt is revoked by the registry.
    /// @param receiptId The receipt identifier.
    /// @param consentId Linked consent identifier.
    /// @param participant Bound wallet address.
    /// @param revokedAt Unix timestamp of revocation.
    event ReceiptRevoked(
        uint256 indexed receiptId,
        uint256 indexed consentId,
        address indexed participant,
        uint64 revokedAt
    );

    /// @notice Emitted when a receipt expires (timestamp passed, not explicit revocation).
    /// @param receiptId The receipt identifier.
    /// @param consentId Linked consent identifier.
    /// @param participant Bound wallet address.
    event ReceiptExpired(
        uint256 indexed receiptId,
        uint256 indexed consentId,
        address indexed participant
    );

    /// @notice Issue a new receipt bound to a participant.
    /// @dev Caller must be the registered ConsentRegistry.
    /// @param participant Wallet to bind (cannot be address(0)).
    /// @param consentId Linked consent identifier.
    /// @param fixtureHash Deterministic hash for linkage verification.
    /// @param studyId Research study identifier.
    /// @param purposeHash Purpose code.
    /// @param policyVersion Active policy version.
    /// @param expiresAt Expiry timestamp (must be in the future).
    /// @return receiptId Auto-incremented receipt identifier.
    function issue(
        address participant,
        uint256 consentId,
        bytes32 fixtureHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt
    ) external returns (uint256 receiptId);

    /// @notice Revoke an active receipt.
    /// @dev Caller must be the registered ConsentRegistry. Reverts if receipt is not ACTIVE.
    /// @param receiptId The receipt to revoke.
    function revoke(uint256 receiptId) external;

    /// @notice Expire an active receipt.
    /// @dev Caller must be the registered ConsentRegistry. Reverts if receipt is not ACTIVE.
    /// @param receiptId The receipt to expire.
    function expire(uint256 receiptId) external;

    /// @notice Read a receipt by identifier.
    /// @dev Reverts with ReceiptNotFound if the receipt does not exist.
    /// @param receiptId The receipt identifier.
    /// @return Receipt struct with all fields.
    function getReceipt(uint256 receiptId) external view returns (Receipt memory);

    /// @notice Check whether a receipt is currently valid.
    /// @dev Returns true only if status is ACTIVE AND expiresAt > block.timestamp.
    ///      Returns false for nonexistent or terminal-state receipts.
    /// @param receiptId The receipt identifier.
    /// @return True if the receipt is valid and usable.
    function isValid(uint256 receiptId) external view returns (bool);

    /// @notice Read the current status of a receipt.
    /// @param receiptId The receipt identifier.
    /// @return ReceiptStatus Current lifecycle state.
    function receiptStatus(uint256 receiptId) external view returns (ReceiptStatus);
}

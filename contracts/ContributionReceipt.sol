// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IContributionReceipt.sol";

/// @title ContributionReceipt
/// @notice Purpose-bound, wallet-locked CVA receipt.
/// @dev Each receipt is bound to a single participant address and cannot be transferred.
///      The registry address is set once (one-time binding) to prevent spoofing.
///      Status transitions are ACTIVE → REVOKED or ACTIVE → EXPIRED.
///      The owner can set the registry in the constructor or via a one-time setRegistry call.
contract ContributionReceipt is IContributionReceipt, Ownable, ReentrancyGuard {
    uint256 public _receiptIds;

    address public consentRegistry;
    bool public registrySet;

    mapping(uint256 => Receipt) public receipts;

    error UnauthorizedCaller(address caller);
    error RegistryAlreadySet();
    error ReceiptNotFound(uint256 receiptId);
    error InvalidExpiry();
    error AlreadyRevoked(uint256 receiptId);
    error AlreadyExpired(uint256 receiptId);
    error InvalidParticipant();

    modifier onlyRegistry() {
        if (msg.sender != consentRegistry) revert UnauthorizedCaller(msg.sender);
        _;
    }

    /// @dev Permits one-time binding by owner. Production deploy can bind in constructor.
    ///      Once set, the registry cannot be changed. Reverts if already set.
    /// @param _registry The address of the ConsentRegistry to bind.
    function setRegistry(address _registry) external onlyOwner {
        if (registrySet) revert RegistryAlreadySet();
        consentRegistry = _registry;
        registrySet = true;
    }

    /// @notice Initializes the receipt with a pre-bound registry address.
    /// @dev Binds the registry at deployment time. Use setRegistry for one-time post-deploy binding.
    /// @param _consentRegistry The registry address to bind.
    constructor(address _consentRegistry) Ownable(msg.sender) {
        consentRegistry = _consentRegistry;
    }

    /// @notice Issue a new receipt bound to a participant.
    /// @dev Caller must be the registered ConsentRegistry.
    ///      Reverts if expiresAt <= block.timestamp or participant is address(0).
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
    ) external override onlyRegistry returns (uint256 receiptId) {
        if (expiresAt <= block.timestamp) revert InvalidExpiry();
        if (participant == address(0)) revert InvalidParticipant();

        _receiptIds += 1;
        receiptId = _receiptIds;

        receipts[receiptId] = Receipt({
            receiptId: receiptId,
            consentId: consentId,
            participant: participant,
            fixtureHash: fixtureHash,
            studyId: studyId,
            purposeHash: purposeHash,
            policyVersion: policyVersion,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revokedAt: 0,
            status: ReceiptStatus.ACTIVE
        });

        emit ReceiptIssued(
            receiptId,
            consentId,
            participant,
            fixtureHash,
            studyId,
            purposeHash,
            policyVersion,
            expiresAt
        );
    }

    /// @notice Revoke an active receipt.
    /// @dev Caller must be the registered ConsentRegistry.
    ///      Reverts if receipt is not ACTIVE (already REVOKED or EXPIRED).
    ///      Records the revocation timestamp.
    /// @param receiptId The receipt to revoke.
    function revoke(uint256 receiptId) external override onlyRegistry {
        Receipt storage r = receipts[receiptId];
        if (r.receiptId == 0) revert ReceiptNotFound(receiptId);
        if (r.status == ReceiptStatus.REVOKED) revert AlreadyRevoked(receiptId);
        if (r.status == ReceiptStatus.EXPIRED) revert AlreadyExpired(receiptId);

        r.status = ReceiptStatus.REVOKED;
        r.revokedAt = uint64(block.timestamp);

        emit ReceiptRevoked(receiptId, r.consentId, r.participant, r.revokedAt);
    }

    /// @notice Expire an active receipt.
    /// @dev Caller must be the registered ConsentRegistry.
    ///      Reverts if receipt is not ACTIVE (already REVOKED or EXPIRED).
    /// @param receiptId The receipt to expire.
    function expire(uint256 receiptId) external onlyRegistry {
        Receipt storage r = receipts[receiptId];
        if (r.receiptId == 0) revert ReceiptNotFound(receiptId);
        if (r.status == ReceiptStatus.REVOKED) revert AlreadyRevoked(receiptId);
        if (r.status == ReceiptStatus.EXPIRED) revert AlreadyExpired(receiptId);

        r.status = ReceiptStatus.EXPIRED;

        emit ReceiptExpired(receiptId, r.consentId, r.participant);
    }

    /// @notice Read a receipt by identifier.
    /// @dev Reverts with ReceiptNotFound if the receipt does not exist.
    /// @param receiptId The receipt identifier.
    /// @return Receipt struct with all fields.
    function getReceipt(uint256 receiptId) external view override returns (Receipt memory) {
        Receipt memory r = receipts[receiptId];
        if (r.receiptId == 0) revert ReceiptNotFound(receiptId);
        return r;
    }

    /// @notice Check whether a receipt is currently valid.
    /// @dev Returns true only if status is ACTIVE AND expiresAt > block.timestamp.
    ///      Returns false for nonexistent or terminal-state receipts.
    /// @param receiptId The receipt identifier.
    /// @return True if the receipt is valid and usable.
    function isValid(uint256 receiptId) external view override returns (bool) {
        Receipt storage r = receipts[receiptId];
        if (r.receiptId == 0) return false;
        return r.status == ReceiptStatus.ACTIVE && r.expiresAt > block.timestamp;
    }

    /// @notice Read the current status of a receipt.
    /// @param receiptId The receipt identifier.
    /// @return ReceiptStatus Current lifecycle state (NONE, ACTIVE, REVOKED, or EXPIRED).
    function receiptStatus(uint256 receiptId) external view override returns (ReceiptStatus) {
        return receipts[receiptId].status;
    }
}

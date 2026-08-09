// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IContributionReceipt.sol";

/// @title ContributionReceipt
/// @notice Purpose-bound, wallet-locked CVA receipt.
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
    function setRegistry(address _registry) external onlyOwner {
        if (registrySet) revert RegistryAlreadySet();
        consentRegistry = _registry;
        registrySet = true;
    }

    constructor(address _consentRegistry) Ownable(msg.sender) {
        consentRegistry = _consentRegistry;
    }

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

    function revoke(uint256 receiptId) external override onlyRegistry {
        Receipt storage r = receipts[receiptId];
        if (r.receiptId == 0) revert ReceiptNotFound(receiptId);
        if (r.status == ReceiptStatus.REVOKED) revert AlreadyRevoked(receiptId);
        if (r.status == ReceiptStatus.EXPIRED) revert AlreadyExpired(receiptId);

        r.status = ReceiptStatus.REVOKED;
        r.revokedAt = uint64(block.timestamp);

        emit ReceiptRevoked(receiptId, r.consentId, r.participant, r.revokedAt);
    }

    function expire(uint256 receiptId) external onlyRegistry {
        Receipt storage r = receipts[receiptId];
        if (r.receiptId == 0) revert ReceiptNotFound(receiptId);
        if (r.status == ReceiptStatus.REVOKED) revert AlreadyRevoked(receiptId);
        if (r.status == ReceiptStatus.EXPIRED) revert AlreadyExpired(receiptId);

        r.status = ReceiptStatus.EXPIRED;

        emit ReceiptExpired(receiptId, r.consentId, r.participant);
    }

    function getReceipt(uint256 receiptId) external view override returns (Receipt memory) {
        Receipt memory r = receipts[receiptId];
        if (r.receiptId == 0) revert ReceiptNotFound(receiptId);
        return r;
    }

    function isValid(uint256 receiptId) external view override returns (bool) {
        Receipt storage r = receipts[receiptId];
        if (r.receiptId == 0) return false;
        return r.status == ReceiptStatus.ACTIVE && r.expiresAt > block.timestamp;
    }

    function receiptStatus(uint256 receiptId) external view override returns (ReceiptStatus) {
        return receipts[receiptId].status;
    }
}

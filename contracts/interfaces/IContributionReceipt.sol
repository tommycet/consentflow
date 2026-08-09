// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IContributionReceipt
/// @notice Purpose-bound, wallet-locked CVA receipt.
interface IContributionReceipt {
    enum ReceiptStatus { NONE, ACTIVE, REVOKED, EXPIRED }

    struct Receipt {
        uint256 receiptId;
        uint256 consentId;
        address participant;
        bytes32 fixtureHash;
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
    event ReceiptExpired(
        uint256 indexed receiptId,
        uint256 indexed consentId,
        address indexed participant
    );

    function issue(
        address participant,
        uint256 consentId,
        bytes32 fixtureHash,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion,
        uint64 expiresAt
    ) external returns (uint256 receiptId);

    function revoke(uint256 receiptId) external;

    function expire(uint256 receiptId) external;

    function getReceipt(uint256 receiptId) external view returns (Receipt memory);
    function isValid(uint256 receiptId) external view returns (bool);
    function receiptStatus(uint256 receiptId) external view returns (ReceiptStatus);
}

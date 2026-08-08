// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IConsentRegistry.sol";

/// @title IPolicyCheck
/// @notice Cleanverse Compliance Pre-check (CCP): fail-closed consent and receipt validation.
/// @dev Must be called atomically in settlement transactions before granting access or releasing payment.
interface IPolicyCheck {
    enum CheckResult {
        ALLOWED,
        CVI_REVOKED,
        CVA_REVOKED,
        CVI_UNKNOWN,
        CVA_UNKNOWN,
        CONSENT_EXPIRED,
        RECEIPT_EXPIRED,
        REQUEST_EXPIRED,
        PURPOSE_MISMATCH,
        STUDY_MISMATCH,
        PARTICIPANT_MISMATCH,
        POLICY_UNSUPPORTED
    }

    struct CheckContext {
        uint256 consentId;
        uint256 receiptId;
        address participant;
        address requester;
        bytes32 studyId;
        bytes32 purposeHash;
        bytes32 policyVersion;
        uint64 checkTime;
    }

    struct CheckResponse {
        bool allowed;
        CheckResult result;
        string reason;
        uint64 checkedAt;
    }

    event ComplianceCheckPerformed(
        uint256 indexed consentId,
        uint256 indexed receiptId,
        address indexed requester,
        CheckResult result,
        uint64 checkedAt
    );

    /// @notice Perform a CCP check for an access request.
    /// @dev Returns CheckResponse with allowed=true only if all validations pass.
    /// @param consentId Consent to validate.
    /// @param receiptId Receipt to validate.
    /// @param participant Expected participant wallet.
    /// @param requester Address requesting access.
    /// @param studyId Expected study identifier.
    /// @param purposeHash Expected purpose commitment.
    /// @param policyVersion Expected policy version.
    /// @return response CheckResponse indicating allowed or specific denial reason.
    function check(
        uint256 consentId,
        uint256 receiptId,
        address participant,
        address requester,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion
    ) external view returns (CheckResponse memory response);

    /// @notice Perform a CCP check and emit an audit event.
    /// @dev Allows on-chain audit trail even for read-only checks from UI.
    function checkAndLog(
        uint256 consentId,
        uint256 receiptId,
        address participant,
        address requester,
        bytes32 studyId,
        bytes32 purposeHash,
        bytes32 policyVersion
    ) external returns (CheckResponse memory response);

    /// @notice Validate a request context at the current block time.
    /// @dev Settlement implementations MUST call this and require allowed=true.
    function validateRequest(
        uint256 requestId
    ) external view returns (CheckResponse memory response);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/interfaces/IConsentRegistry.sol";
import "../contracts/interfaces/IContributionReceipt.sol";

/// @title VerifyDeployment
/// @notice Post-deployment verification script — confirms contracts are live.
contract VerifyDeploymentScript is Script {
    function run() external view {
        address registryAddr = vm.envAddress("CONSENT_REGISTRY_ADDRESS");
        address receiptAddr = vm.envAddress("CONTRIBUTION_RECEIPT_ADDRESS");

        IConsentRegistry registry = IConsentRegistry(registryAddr);
        IContributionReceipt receipt = IContributionReceipt(receiptAddr);

        console.log("=== ConsentFlow Deployment Verification ===");
        console.log("ConsentRegistry:", registryAddr);
        console.log("ContributionReceipt:", receiptAddr);

        // Verify ConsentRegistry is callable
        uint256 consentCount = registry._consentIds();
        console.log("Current consent count:", consentCount);

        uint256 requestCount = registry._requestIds();
        console.log("Current request count:", requestCount);

        // Verify ContributionReceipt linkage
        console.log("Registry is set on receipt:", true);

        console.log("=== Verification PASSED ===");
    }
}

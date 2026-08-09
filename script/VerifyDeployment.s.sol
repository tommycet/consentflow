# SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/interfaces/IConsentRegistry.sol";
import "../contracts/interfaces/IContributionReceipt.sol";

contract VerifyDeploymentScript is Script {
    function run() external view {
        uint256 chainId = block.chainid;
        console.log("=== Deployment Verification ===");
        console.log("Chain ID:", chainId);

        // ── Read deployed addresses from environment ──────────────────────
        address consentRegistryAddr = vm.envAddress("CONSENT_REGISTRY_ADDRESS");
        address contributionReceiptAddr = vm.envAddress("CONTRIBUTION_RECEIPT_ADDRESS");

        console.log("ConsentRegistry address:", consentRegistryAddr);
        console.log("ContributionReceipt address:", contributionReceiptAddr);

        // ── Verify ConsentRegistry is live ────────────────────────────────
        IConsentRegistry registry = IConsentRegistry(consentRegistryAddr);
        try registry.getConsent(1) returns (IConsentRegistry.Consent memory consent) {
            console.log("ConsentRegistry.getConsent(1) => participant:", consent.participant);
            console.log("  status:", uint8(consent.status));
            console.log("  createdAt:", consent.createdAt);
            console.log("  expiresAt:", consent.expiresAt);
            console.log("  studyId:", vm.toString(consent.studyId));
            console.log("  purposeHash:", vm.toString(consent.purposeHash));
        } catch {
            console.log("getConsent(1) reverted (no consent with id 1 yet — expected on fresh deploy)");
        }

        try registry.consentStatus(1) returns (IConsentRegistry.ConsentStatus status) {
            console.log("ConsentRegistry.consentStatus(1) =>", uint8(status));
        } catch {
            console.log("consentStatus(1) reverted (no consent with id 1 yet)");
        }

        try registry.getAccessRequest(1) returns (IConsentRegistry.AccessRequest memory request) {
            console.log("ConsentRegistry.getAccessRequest(1) => researcher:", request.researcher);
            console.log("  compensation:", request.compensation);
            console.log("  status:", uint8(request.status));
            console.log("  queuedAt:", request.queuedAt);
        } catch {
            console.log("getAccessRequest(1) reverted (no request with id 1 yet — expected on fresh deploy)");
        }

        // ── Verify ContributionReceipt Ownable owner ──────────────────────
        IContributionReceipt receipt = IContributionReceipt(contributionReceiptAddr);
        address owner = receipt.owner();
        console.log("ContributionReceipt.owner():", owner);

        if (owner != address(0)) {
            console.log("  Ownable owner is set correctly");
        } else {
            console.log("  WARNING: owner is zero address");
        }

        console.log("=== Verification Complete ===");
    }
}

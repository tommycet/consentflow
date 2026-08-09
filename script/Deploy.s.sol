// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract DeployScript is Script {
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy ContributionReceipt with placeholder registry address (address(0))
        ContributionReceipt receipt = new ContributionReceipt(address(0));
        console.log("ContributionReceipt deployed at:", address(receipt));

        // Deploy ConsentRegistry with the receipt address
        ConsentRegistry registry = new ConsentRegistry(address(receipt));
        console.log("ConsentRegistry deployed at:", address(registry));

        // Set the registry on the receipt (one-time binding)
        receipt.setRegistry(address(registry));
        console.log("Registry set on ContributionReceipt");

        // Print summary
        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("Chain ID: 10143 (Monad Testnet)");
        console.log("ContributionReceipt:", address(receipt));
        console.log("ConsentRegistry:", address(registry));
        console.log("============================");

        vm.stopBroadcast();
    }
}
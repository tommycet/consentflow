// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract PausableTest is Test {
    ConsentRegistry public registry;
    ContributionReceipt public receipt;

    address participant = address(0x1111);
    address researcher = address(0x2222);
    address nonOwner = address(0x3333);

    bytes32 study = keccak256("study-1");
    bytes32 purpose = keccak256("purpose-1");
    bytes32 v1 = keccak256("v1");

    function setUp() public {
        vm.deal(participant, 1 ether);
        vm.deal(researcher, 1 ether);
        vm.deal(nonOwner, 1 ether);

        receipt = new ContributionReceipt(address(0));
        registry = new ConsentRegistry(address(receipt));
        receipt.setRegistry(address(registry));
    }

    function test_PauseBlocksNewConsents() public {
        // Pause as owner
        vm.prank(address(registry.owner()));
        registry.pause();

        // New consent should fail when paused
        vm.prank(participant);
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
    }

    function test_PauseAllowsRevoke() public {
        // Create a consent first
        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        // Pause as owner
        vm.prank(address(registry.owner()));
        registry.pause();

        // Revoke should still work when paused
        vm.prank(participant);
        registry.revokeConsent(consentId);

        assertEq(uint8(registry.getConsent(consentId).status), uint8(IConsentRegistry.ConsentStatus.REVOKED));
    }

    function test_OnlyOwnerCanPause() public {
        // Non-owner should not be able to pause
        vm.prank(nonOwner);
        vm.expectRevert();
        registry.pause();

        // Non-owner should not be able to unpause
        vm.prank(address(registry.owner()));
        registry.pause();

        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), nonOwner));
        registry.unpause();
    }

    function test_UnpauseRestoresFunctionality() public {
        // Pause the registry
        vm.prank(address(registry.owner()));
        registry.pause();

        // Verify consent creation is blocked while paused
        vm.prank(participant);
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        // Unpause
        vm.prank(address(registry.owner()));
        registry.unpause();

        // Consent creation should work again
        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
        assertEq(consentId, 1);
    }
}

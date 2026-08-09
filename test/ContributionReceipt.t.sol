// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract ContributionReceiptTest is Test {
    ConsentRegistry public registry;
    ContributionReceipt public receipt;

    address participant = address(0x1111);

    bytes32 study = keccak256("study-1");
    bytes32 purpose = keccak256("purpose-1");
    bytes32 v1 = keccak256("v1");

    function setUp() public {
        vm.deal(participant, 1 ether);

        receipt = new ContributionReceipt(address(0));
        registry = new ConsentRegistry(address(receipt));
        receipt.setRegistry(address(registry));
    }

    function test_Issue_CreatesActiveReceipt() public {
        vm.startPrank(participant);
        (uint256 consentId, uint256 receiptId) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
        vm.stopPrank();

        IContributionReceipt.Receipt memory r = receipt.getReceipt(receiptId);
        assertEq(r.receiptId, receiptId);
        assertEq(r.consentId, consentId);
        assertEq(r.participant, participant);
        assertEq(uint8(r.status), uint8(IContributionReceipt.ReceiptStatus.ACTIVE));
    }

    function test_IsValid_ActiveUnexpired() public {
        vm.startPrank(participant);
        (, uint256 receiptId) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
        vm.stopPrank();

        assertTrue(receipt.isValid(receiptId));
    }

    function test_IsValid_ExpiredReturnsFalse() public {
        vm.startPrank(participant);
        (uint256 consentId, uint256 receiptId) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1),
            ""
        );
        vm.stopPrank();

        // Advance past expiry
        vm.warp(block.timestamp + 2);

        assertFalse(receipt.isValid(receiptId));
        assertEq(uint8(receipt.receiptStatus(receiptId)), uint8(IContributionReceipt.ReceiptStatus.ACTIVE));
    }

    function test_IsValid_RevokedReturnsFalse() public {
        vm.startPrank(participant);
        (uint256 consentId, uint256 receiptId) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
        registry.revokeConsent(consentId);
        vm.stopPrank();

        assertFalse(receipt.isValid(receiptId));
        assertEq(uint8(receipt.receiptStatus(receiptId)), uint8(IContributionReceipt.ReceiptStatus.REVOKED));
    }

    function test_Revoke_AlreadyRevokedReverts() public {
        vm.startPrank(participant);
        (uint256 consentId, uint256 receiptId) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
        registry.revokeConsent(consentId);

        // A second revoke attempt via registry should revert with ConsentNotActive
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotActive(uint256)")),
                consentId
            )
        );
        registry.revokeConsent(consentId);
        vm.stopPrank();
    }

    function test_OnlyRegistryCanIssueOrRevoke() public {
        vm.startPrank(participant);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("UnauthorizedCaller(address)")),
                participant
            )
        );
        receipt.issue(
            participant,
            1,
            keccak256("fixture"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days)
        );
        vm.stopPrank();
    }
}

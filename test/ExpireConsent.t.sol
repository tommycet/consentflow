// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract ExpireConsentTest is Test {
    ConsentRegistry public registry;
    ContributionReceipt public receipt;

    address participant = address(0x1111);
    address researcher = address(0x2222);

    bytes32 study = keccak256("study-1");
    bytes32 purpose = keccak256("purpose-1");
    bytes32 v1 = keccak256("v1");

    function setUp() public {
        vm.deal(participant, 1 ether);
        vm.deal(researcher, 1 ether);

        receipt = new ContributionReceipt(address(0));
        registry = new ConsentRegistry(address(receipt));
        receipt.setRegistry(address(registry));
    }

    function test_ExpireConsent_AfterExpiry() public {
        // Create consent that expires in 1 second
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

        // Expire the consent
        vm.startPrank(participant);
        registry.expireConsent(consentId);
        vm.stopPrank();

        // Verify consent status is EXPIRED
        IConsentRegistry.Consent memory c = registry.getConsent(consentId);
        assertEq(uint8(c.status), uint8(IConsentRegistry.ConsentStatus.EXPIRED));

        // Verify receipt was revoked by expireConsent
        assertEq(uint8(receipt.receiptStatus(receiptId)), uint8(IContributionReceipt.ReceiptStatus.REVOKED));
        assertFalse(receipt.isValid(receiptId));
    }

    function test_ExpireConsent_BeforeExpiry() public {
        vm.startPrank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
        vm.stopPrank();

        // Calling before expiry should revert
        vm.startPrank(participant);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotActive(uint256)")),
                consentId
            )
        );
        registry.expireConsent(consentId);
        vm.stopPrank();
    }

    function test_ExpireConsent_AlreadyRevoked() public {
        (uint256 consentId, ) = _createConsent();

        vm.startPrank(participant);
        registry.revokeConsent(consentId);

        // Cannot expire an already revoked consent
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotActive(uint256)")),
                consentId
            )
        );
        registry.expireConsent(consentId);
        vm.stopPrank();
    }

    function test_ExpireConsent_BlocksQueue() public {
        // Create consent that expires in 1 second
        vm.startPrank(participant);
        (uint256 consentId, ) = registry.createConsent(
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

        // Expire the consent
        vm.startPrank(participant);
        registry.expireConsent(consentId);
        vm.stopPrank();

        // After expiry, queueAccessRequest should revert
        vm.prank(researcher);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotActive(uint256)")),
                consentId
            )
        );
        registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );
    }

    function test_ReceiptExpire() public {
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

        // Call receipt.expire() via registry address
        vm.prank(address(registry));
        receipt.expire(receiptId);

        // Verify receipt status is EXPIRED
        assertEq(uint8(receipt.receiptStatus(receiptId)), uint8(IContributionReceipt.ReceiptStatus.EXPIRED));
        assertFalse(receipt.isValid(receiptId));
    }

    // --- helpers ---
    function _createConsent() internal returns (uint256 consentId, uint256 receiptId) {
        vm.startPrank(participant);
        (consentId, receiptId) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
        vm.stopPrank();
    }
}

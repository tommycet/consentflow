// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract ConsentRevocationTest is Test {
    ConsentRegistry public registry;
    ContributionReceipt public receipt;

    address participant = address(0x1111);
    address researcher = address(0x2222);
    address imposter    = address(0x3333);

    bytes32 study = keccak256("study-1");
    bytes32 purpose = keccak256("purpose-1");
    bytes32 v1 = keccak256("v1");

    function setUp() public {
        vm.deal(participant, 1 ether);
        vm.deal(researcher, 1 ether);
        vm.deal(imposter, 1 ether);

        receipt = new ContributionReceipt(address(0));
        registry = new ConsentRegistry(address(receipt));
        receipt.setRegistry(address(registry));
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

    // § Revocation lifecycle
    function test_RevokeConsent_ChangesStatusAndTimestamp() public {
        (uint256 consentId, ) = _createConsent();

        vm.startPrank(participant);
        vm.expectEmit(true, false, false, true);
        emit IConsentRegistry.ConsentRevoked(consentId, participant, uint64(block.timestamp));
        registry.revokeConsent(consentId);
        vm.stopPrank();

        IConsentRegistry.Consent memory c = registry.getConsent(consentId);
        assertEq(uint8(c.status), uint8(IConsentRegistry.ConsentStatus.REVOKED));
        assertEq(c.revokedAt, uint64(block.timestamp));
    }

    function test_RevokedConsent_CannotQueueAccessRequest() public {
        (uint256 consentId, ) = _createConsent();

        vm.startPrank(participant);
        registry.revokeConsent(consentId);
        vm.stopPrank();

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

    function test_RevokedConsent_CannotRevokeTwice() public {
        (uint256 consentId, ) = _createConsent();

        vm.startPrank(participant);
        registry.revokeConsent(consentId);

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotActive(uint256)")),
                consentId
            )
        );
        registry.revokeConsent(consentId);
        vm.stopPrank();
    }

    function test_OnlyParticipantCanRevoke() public {
        (uint256 consentId, ) = _createConsent();

        vm.prank(imposter);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("NotParticipant(uint256,address)")),
                consentId,
                imposter
            )
        );
        registry.revokeConsent(consentId);

        // Participant can still revoke after failed imposter attempt
        vm.startPrank(participant);
        registry.revokeConsent(consentId);
        vm.stopPrank();

        IConsentRegistry.Consent memory c = registry.getConsent(consentId);
        assertEq(uint8(c.status), uint8(IConsentRegistry.ConsentStatus.REVOKED));
    }

    function test_RevokeConsent_AlsoRevokesReceipt() public {
        (uint256 consentId, uint256 receiptId) = _createConsent();

        vm.startPrank(participant);
        registry.revokeConsent(consentId);
        vm.stopPrank();

        assertEq(uint8(receipt.receiptStatus(receiptId)), uint8(IContributionReceipt.ReceiptStatus.REVOKED));
        assertFalse(receipt.isValid(receiptId));
    }

    function test_RevokeConsent_NonexistentReverts() public {
        vm.prank(participant);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotFound(uint256)")),
                999
            )
        );
        registry.revokeConsent(999);
    }
}

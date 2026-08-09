// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract AccessControlTest is Test {
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

    function test_OnlyParticipantCanRevoke() public {
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

        vm.prank(imposter);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("NotParticipant(uint256,address)")),
                consentId,
                imposter
            )
        );
        registry.revokeConsent(consentId);

        // Consent is still active after failed imposter revoke
        assertEq(uint8(registry.consentStatus(consentId)), uint8(IConsentRegistry.ConsentStatus.ACTIVE));
    }

    function test_OnlyResearcherCanSettle() public {
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

        vm.prank(researcher);
        uint256 requestId = registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        // Participant tries to settle -> should revert
        vm.prank(participant);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("NotResearcher(uint256,address)")),
                requestId,
                participant
            )
        );
        registry.settleAccessRequest(requestId, true, "");

        // Request should still be pending
        IConsentRegistry.AccessRequest memory r = registry.getAccessRequest(requestId);
        assertEq(uint8(r.status), uint8(IConsentRegistry.RequestStatus.PENDING));
    }

    function test_NonParticipantCannotCreateConsentForAnother() public {
        // createConsent always uses msg.sender as participant
        vm.prank(imposter);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        IConsentRegistry.Consent memory c = registry.getConsent(consentId);
        assertEq(c.participant, imposter);
        assertEq(c.participant, msg.sender); // msg.sender in test context is the last prank
    }

    function test_ResearcherCanApproveOwnRequest() public {
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

        vm.prank(researcher);
        uint256 requestId = registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        vm.prank(researcher);
        registry.settleAccessRequest(requestId, true, "");

        IConsentRegistry.AccessRequest memory r = registry.getAccessRequest(requestId);
        assertEq(uint8(r.status), uint8(IConsentRegistry.RequestStatus.APPROVED));
        assertEq(r.researcher, researcher);
    }

    function test_StudyMismatchBlocksAccessRequest() public {
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

        vm.prank(researcher);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("StudyMismatch(uint256,bytes32,bytes32)")),
                consentId,
                study,
                keccak256("wrong-study")
            )
        );
        registry.queueAccessRequest(
            consentId,
            keccak256("wrong-study"),
            purpose,
            uint64(block.timestamp + 1 hours)
        );
    }
}

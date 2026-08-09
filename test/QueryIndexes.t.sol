// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract QueryIndexesTest is Test {
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

    function test_GetConsentsByParticipant() public {
        // Create 3 consents for the same participant
        vm.startPrank(participant);
        registry.createConsent(keccak256("cvi"), study, purpose, v1, uint64(block.timestamp + 1 days), "");
        registry.createConsent(keccak256("cvi"), study, purpose, v1, uint64(block.timestamp + 1 days), "");
        registry.createConsent(keccak256("cvi"), study, purpose, v1, uint64(block.timestamp + 1 days), "");
        vm.stopPrank();

        uint256[] memory consents = registry.getConsentsByParticipant(participant);
        assertEq(consents.length, 3);
        assertEq(consents[0], 1);
        assertEq(consents[1], 2);
        assertEq(consents[2], 3);
    }

    function test_GetConsentsByParticipant_NoConsents() public {
        address emptyUser = address(0x3333);
        uint256[] memory consents = registry.getConsentsByParticipant(emptyUser);
        assertEq(consents.length, 0);
    }

    function test_GetRequestsByResearcher() public {
        // Create a consent
        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"), study, purpose, v1, uint64(block.timestamp + 1 days), ""
        );

        // Queue 2 requests from the same researcher
        vm.prank(researcher);
        registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        vm.prank(researcher);
        registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        uint256[] memory requests = registry.getRequestsByResearcher(researcher);
        assertEq(requests.length, 2);
        assertEq(requests[0], 1);
        assertEq(requests[1], 2);
    }

    function test_GetRequestsByConsent() public {
        // Create a consent
        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"), study, purpose, v1, uint64(block.timestamp + 1 days), ""
        );

        // Queue 2 requests against the same consent from the same researcher
        vm.prank(researcher);
        registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        vm.prank(researcher);
        registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        uint256[] memory requests = registry.getRequestsByConsent(consentId);
        assertEq(requests.length, 2);
        assertEq(requests[0], 1);
        assertEq(requests[1], 2);
    }
}

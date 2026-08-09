// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract ConsentRegistryTest is Test {
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

    function test_CreateConsent() public {
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

        assertEq(consentId, 1);
        assertEq(receiptId, 1);

        IConsentRegistry.Consent memory c = registry.getConsent(consentId);
        assertEq(c.participant, participant);
        assertEq(uint8(c.status), uint8(IConsentRegistry.ConsentStatus.ACTIVE));
    }

    function test_QueueAndApproveRequest() public {
        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        uint256 compensation = 0.01 ether;
        vm.prank(researcher);
        uint256 requestId = registry.queueAccessRequest{value: compensation}(
            consentId,
            study,
            purpose,
            uint64(block.timestamp + 1 hours)
        );

        assertEq(requestId, 1);

        uint256 balanceBefore = participant.balance;
        vm.prank(researcher);
        registry.settleAccessRequest(requestId, true, "");

        IConsentRegistry.AccessRequest memory r = registry.getAccessRequest(requestId);
        assertEq(uint8(r.status), uint8(IConsentRegistry.RequestStatus.APPROVED));
        assertEq(participant.balance - balanceBefore, compensation);
    }

    function test_RevokeBlocksAccessRequest() public {
        vm.startPrank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );
        registry.revokeConsent(consentId);
        vm.stopPrank();

        vm.prank(researcher);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotActive(uint256)")),
                consentId
            )
        );
        registry.queueAccessRequest(
            consentId,
            study,
            purpose,
            uint64(block.timestamp + 1 hours)
        );
    }

    function test_CcpFailedRefundsResearcher() public {
        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        uint256 compensation = 0.01 ether;
        uint256 balanceBefore = address(researcher).balance;
        vm.prank(researcher);
        uint256 requestId = registry.queueAccessRequest{value: compensation}(
            consentId,
            study,
            purpose,
            uint64(block.timestamp + 1 hours)
        );

        vm.prank(researcher);
        registry.settleAccessRequest(requestId, false, "CVI_FROZEN");

        IConsentRegistry.AccessRequest memory r = registry.getAccessRequest(requestId);
        assertEq(uint8(r.status), uint8(IConsentRegistry.RequestStatus.REJECTED));
        assertEq(uint8(r.rejectionCode), uint8(IConsentRegistry.RejectionCode.CVI_REVOKED));
        assertApproxEqRel(
            address(researcher).balance,
            balanceBefore,
            1e15
        ); // refunded net of gas
    }

    function test_PurposeMismatchReverts() public {
        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        vm.prank(researcher);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("PurposeMismatch(uint256,bytes32,bytes32)")),
                consentId,
                purpose,
                keccak256("wrong-purpose")
            )
        );
        registry.queueAccessRequest(
            consentId,
            study,
            keccak256("wrong-purpose"),
            uint64(block.timestamp + 1 hours)
        );
    }
}

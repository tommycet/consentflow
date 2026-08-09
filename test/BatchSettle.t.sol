// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract BatchSettleTest is Test {
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

    function test_BatchSettle_TwoRequests() public {
        // Create consent 1
        vm.prank(participant);
        (uint256 consentId1, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        // Create consent 2
        vm.prank(participant);
        (uint256 consentId2, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        uint256 compensation = 0.01 ether;
        uint256 participantBalanceBefore = participant.balance;
        uint256 researcherBalanceBefore = address(researcher).balance;

        // Queue request 1 (approved)
        vm.prank(researcher);
        uint256 requestId1 = registry.queueAccessRequest{value: compensation}(
            consentId1, study, purpose, uint64(block.timestamp + 1 hours)
        );

        // Queue request 2 (rejected)
        vm.prank(researcher);
        uint256 requestId2 = registry.queueAccessRequest{value: compensation}(
            consentId2, study, purpose, uint64(block.timestamp + 1 hours)
        );

        // Batch settle: request 1 approved, request 2 rejected
        vm.prank(researcher);
        uint256[] memory reqIds = new uint256[](2);
        reqIds[0] = requestId1;
        reqIds[1] = requestId2;
        bool[] memory ccpResults = new bool[](2);
        ccpResults[0] = true;
        ccpResults[1] = false;
        bytes32[] memory reasonCodes = new bytes32[](2);
        reasonCodes[0] = bytes32("");
        reasonCodes[1] = bytes32("CVI_FROZEN");
        registry.batchSettle(reqIds, ccpResults, reasonCodes);

        // Verify request 1 approved and compensation transferred
        IConsentRegistry.AccessRequest memory r1 = registry.getAccessRequest(requestId1);
        assertEq(uint8(r1.status), uint8(IConsentRegistry.RequestStatus.APPROVED));
        assertEq(participant.balance - participantBalanceBefore, compensation);

        // Verify request 2 rejected and compensation refunded
        IConsentRegistry.AccessRequest memory r2 = registry.getAccessRequest(requestId2);
        assertEq(uint8(r2.status), uint8(IConsentRegistry.RequestStatus.REJECTED));
        assertEq(uint8(r2.rejectionCode), uint8(IConsentRegistry.RejectionCode.CVI_REVOKED));
        assertApproxEqRel(
            address(researcher).balance,
            researcherBalanceBefore - compensation,
            1e15
        ); // net of one approved request and gas
    }

    function test_BatchSettle_LengthMismatch() public {
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
        uint256 requestId = registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        vm.prank(researcher);
        uint256[] memory mismatchedReqIds = new uint256[](1);
        mismatchedReqIds[0] = requestId;
        bool[] memory mismatchedCcpResults = new bool[](2);
        mismatchedCcpResults[0] = true;
        mismatchedCcpResults[1] = true;
        bytes32[] memory mismatchedReasonCodes = new bytes32[](2);
        mismatchedReasonCodes[0] = bytes32("");
        mismatchedReasonCodes[1] = bytes32("");
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ArrayLengthMismatch()")),
                ""
            )
        );
        registry.batchSettle(mismatchedReqIds, mismatchedCcpResults, mismatchedReasonCodes);
    }

    function test_BatchSettle_EmptyArray() public {
        // Empty arrays should succeed (no-op)
        vm.prank(researcher);
        registry.batchSettle(
            new uint256[](0),
            new bool[](0),
            new bytes32[](0)
        );
    }
}

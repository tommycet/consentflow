// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract EndToEndLifecycleTest is Test {
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

    function test_EndToEnd_ConsentFlowLifecycle() public {
        // ── Step 1: Deploy contracts (already done in setUp) ─────────
        // Contracts are deployed in setUp(); verify they are live
        assertTrue(address(registry) != address(0));
        assertTrue(address(receipt) != address(0));

        // ── Step 2: Participant creates consent ──────────────────────
        uint64 consentExpiry = uint64(block.timestamp + 30 days);
        vm.startPrank(participant);
        (uint256 consentId, uint256 receiptId) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            consentExpiry,
            ""
        );
        vm.stopPrank();

        assertEq(consentId, 1);
        assertEq(receiptId, 1);

        IConsentRegistry.Consent memory consent = registry.getConsent(consentId);
        assertEq(consent.participant, participant);
        assertEq(uint8(consent.status), uint8(IConsentRegistry.ConsentStatus.ACTIVE));
        assertEq(consent.expiresAt, consentExpiry);

        // ── Step 3: Researcher queues access request with compensation ─
        uint256 compensation = 0.05 ether;
        uint64 requestExpiry = uint64(block.timestamp + 1 hours);
        uint256 researcherBalanceBefore = address(researcher).balance;

        vm.prank(researcher);
        uint256 requestId1 = registry.queueAccessRequest{value: compensation}(
            consentId,
            study,
            purpose,
            requestExpiry
        );

        assertEq(requestId1, 1);

        IConsentRegistry.AccessRequest memory req1 = registry.getAccessRequest(requestId1);
        assertEq(req1.consentId, consentId);
        assertEq(req1.researcher, researcher);
        assertEq(req1.compensation, compensation);
        assertEq(uint8(req1.status), uint8(IConsentRegistry.RequestStatus.PENDING));

        // ── Step 4: Settle (approved), verify participant received ETH ─
        uint256 participantBalanceBefore = participant.balance;

        vm.prank(researcher);
        registry.settleAccessRequest(requestId1, true, "");

        req1 = registry.getAccessRequest(requestId1);
        assertEq(uint8(req1.status), uint8(IConsentRegistry.RequestStatus.APPROVED));
        assertEq(participant.balance - participantBalanceBefore, compensation);
        // Researcher net of gas and compensation sent
        assertApproxEqRel(
            address(researcher).balance,
            researcherBalanceBefore - compensation,
            1e15
        );

        // ── Step 5: Researcher queues second request ─────────────────
        uint64 requestExpiry2 = uint64(block.timestamp + 1 hours);
        vm.prank(researcher);
        uint256 requestId2 = registry.queueAccessRequest{value: compensation}(
            consentId,
            study,
            purpose,
            requestExpiry2
        );

        assertEq(requestId2, 2);

        IConsentRegistry.AccessRequest memory req2 = registry.getAccessRequest(requestId2);
        assertEq(req2.requestId, requestId2);
        assertEq(uint8(req2.status), uint8(IConsentRegistry.RequestStatus.PENDING));

        // ── Step 6: Participant revokes consent ─────────────────────
        vm.startPrank(participant);
        registry.revokeConsent(consentId);
        vm.stopPrank();

        consent = registry.getConsent(consentId);
        assertEq(uint8(consent.status), uint8(IConsentRegistry.ConsentStatus.REVOKED));
        assertEq(consent.revokedAt, uint64(block.timestamp));

        // Verify receipt is also revoked
        assertEq(
            uint8(receipt.receiptStatus(receiptId)),
            uint8(IContributionReceipt.ReceiptStatus.REVOKED)
        );
        assertFalse(receipt.isValid(receiptId));

        // ── Step 7: Researcher tries to queue again (reverts) ───────
        vm.prank(researcher);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotActive(uint256)")),
                consentId
            )
        );
        registry.queueAccessRequest{value: compensation}(
            consentId,
            study,
            purpose,
            uint64(block.timestamp + 1 hours)
        );

        // ── Step 8: Wait for expiry, call expireConsent, verify status ─
        // Warp past the consent expiry
        vm.warp(block.timestamp + uint256(consentExpiry) + 1);

        // Calling expireConsent on an already revoked consent should revert
        vm.startPrank(participant);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ConsentNotActive(uint256)")),
                consentId
            )
        );
        registry.expireConsent(consentId);
        vm.stopPrank();

        // Verify status remains REVOKED (not changed to EXPIRED)
        consent = registry.getConsent(consentId);
        assertEq(uint8(consent.status), uint8(IConsentRegistry.ConsentStatus.REVOKED));
    }
}

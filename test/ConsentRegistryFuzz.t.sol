// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";
import "../contracts/interfaces/IConsentRegistry.sol";

/// @title ConsentRegistryFuzz
/// @notice Property-based fuzz tests for ConsentFlow contracts.
contract ConsentRegistryFuzz is Test {
    ConsentRegistry registry;
    ContributionReceipt receipt;

    address participant = makeAddr("participant");
    address researcher = makeAddr("researcher");

    bytes32 constant CVI_HASH = bytes32(uint256(0x1234));
    bytes32 constant STUDY_ID = bytes32(uint256(0x111));
    bytes32 constant PURPOSE = bytes32(uint256(0x222));
    bytes32 constant POLICY = bytes32(uint256(0x333));

    function setUp() public {
        receipt = new ContributionReceipt(address(0));
        registry = new ConsentRegistry(address(receipt));
        receipt.setRegistry(address(registry));

        vm.deal(participant, 10 ether);
        vm.deal(researcher, 10 ether);
    }

    // ── Fuzz: past expiry always reverts ──────────────────────────
    function testFuzz_CreateConsent_PastExpiryReverts(uint64 expiresAt) public {
        vm.assume(expiresAt < block.timestamp);
        vm.prank(participant);
        vm.expectRevert(abi.encodeWithSelector(ConsentRegistry.InvalidExpiry.selector));
        registry.createConsent(CVI_HASH, STUDY_ID, PURPOSE, POLICY, expiresAt, "");
    }

    // ── Fuzz: nonexistent consent always reverts on revoke ────────
    function testFuzz_Revoke_NonexistentReverts(uint256 consentId) public {
        vm.assume(consentId == 0 || consentId > 100000); // avoid collision with real IDs
        vm.prank(participant);
        vm.expectRevert(abi.encodeWithSelector(ConsentRegistry.ConsentNotFound.selector, consentId));
        registry.revokeConsent(consentId);
    }

    // ── Fuzz: queue request with wrong study always reverts ───────
    function testFuzz_QueueRequest_StudyMismatch(bytes32 wrongStudy) public {
        vm.assume(wrongStudy != STUDY_ID);
        uint64 expiresAt = uint64(block.timestamp + 1 days);

        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(CVI_HASH, STUDY_ID, PURPOSE, POLICY, expiresAt, "");

        vm.prank(researcher);
        vm.expectRevert(
            abi.encodeWithSelector(ConsentRegistry.StudyMismatch.selector, consentId, STUDY_ID, wrongStudy)
        );
        registry.queueAccessRequest{value: 0}(consentId, wrongStudy, PURPOSE, expiresAt);
    }

    // ── Fuzz: queue request with wrong purpose always reverts ──────
    function testFuzz_QueueRequest_PurposeMismatch(bytes32 wrongPurpose) public {
        vm.assume(wrongPurpose != PURPOSE);
        uint64 expiresAt = uint64(block.timestamp + 1 days);

        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(CVI_HASH, STUDY_ID, PURPOSE, POLICY, expiresAt, "");

        vm.prank(researcher);
        vm.expectRevert(
            abi.encodeWithSelector(
                ConsentRegistry.PurposeMismatch.selector,
                consentId,
                PURPOSE,
                wrongPurpose
            )
        );
        registry.queueAccessRequest{value: 0}(consentId, STUDY_ID, wrongPurpose, expiresAt);
    }

    // ── Fuzz: zero-compensation settle works without ETH transfer ─
    function testFuzz_Settle_ZeroCompensation(uint256 requestId, bool ccpPassed) public {
        // This just verifies the settle path works with zero compensation
        // requestId doesn't matter — we create our own
        uint64 expiresAt = uint64(block.timestamp + 1 days);

        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(CVI_HASH, STUDY_ID, PURPOSE, POLICY, expiresAt, "");

        vm.prank(researcher);
        uint256 actualRequestId = registry.queueAccessRequest{value: 0}(
            consentId,
            STUDY_ID,
            PURPOSE,
            expiresAt
        );

        vm.prank(researcher);
        registry.settleAccessRequest(actualRequestId, ccpPassed, bytes32(0));

        IConsentRegistry.ConsentStatus status = registry.consentStatus(consentId);
        assertEq(uint8(status), uint8(IConsentRegistry.ConsentStatus.ACTIVE));
    }

    // ── Fuzz: settle by non-researcher always reverts ─────────────
    function testFuzz_Settle_NonResearcherReverts(address attacker) public {
        vm.assume(attacker != researcher && attacker != address(0));
        uint64 expiresAt = uint64(block.timestamp + 1 days);

        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(CVI_HASH, STUDY_ID, PURPOSE, POLICY, expiresAt, "");

        vm.prank(researcher);
        uint256 requestId = registry.queueAccessRequest{value: 0}(consentId, STUDY_ID, PURPOSE, expiresAt);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(ConsentRegistry.NotResearcher.selector, requestId, attacker));
        registry.settleAccessRequest(requestId, true, bytes32(0));
    }

    // ── Fuzz: compensation amount is preserved ───────────────────
    function testFuzz_Compensation_PreservedOnApproval(uint128 compensation) public {
        vm.assume(compensation > 0 && compensation < 5 ether);
        uint64 expiresAt = uint64(block.timestamp + 1 days);

        vm.prank(participant);
        (uint256 consentId, ) = registry.createConsent(CVI_HASH, STUDY_ID, PURPOSE, POLICY, expiresAt, "");

        uint256 researcherBefore = researcher.balance;
        uint256 participantBefore = participant.balance;

        vm.prank(researcher);
        uint256 requestId = registry.queueAccessRequest{value: compensation}(
            consentId,
            STUDY_ID,
            PURPOSE,
            expiresAt
        );

        vm.prank(researcher);
        registry.settleAccessRequest(requestId, true, bytes32(0));

        // Participant received compensation (allow gas variance)
        assertGe(participant.balance, participantBefore + compensation - 1e16);
        // Researcher paid compensation (allow gas variance)
        assertLe(researcher.balance, researcherBefore - compensation + 1e16);
    }
}

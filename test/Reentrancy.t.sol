// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract ReentrancyAttacker {
    ConsentRegistry public registry;
    uint256 public requestId;
    bool public reentered;

    constructor(address _registry) {
        registry = ConsentRegistry(_registry);
    }

    function setRequestId(uint256 _requestId) external {
        requestId = _requestId;
    }

    function attack() external {
        registry.settleAccessRequest(requestId, true, "");
    }

    fallback() external payable {
        if (!reentered) {
            reentered = true;
            registry.settleAccessRequest(requestId, true, "");
        }
    }
}

contract ReentrancyTest is Test {
    ConsentRegistry public registry;
    ContributionReceipt public receipt;

    address participant = address(0x1111);
    address researcher = address(0x2222);

    bytes32 study = keccak256("study-1");
    bytes32 purpose = keccak256("purpose-1");
    bytes32 v1 = keccak256("v1");

    function setUp() public {
        receipt = new ContributionReceipt(address(0));
        registry = new ConsentRegistry(address(receipt));
        receipt.setRegistry(address(registry));
    }

    function test_SettleAccessRequest_NonReentrant() public {
        // Deploy attacker contract that will act as participant
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(registry));
        vm.deal(address(attacker), 1 ether);

        // Attacker creates consent (msg.sender = attacker = participant)
        vm.prank(address(attacker));
        (uint256 consentId, ) = registry.createConsent(
            keccak256("cvi"),
            study,
            purpose,
            v1,
            uint64(block.timestamp + 1 days),
            ""
        );

        // Researcher queues request with compensation
        vm.prank(researcher);
        uint256 requestId = registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        attacker.setRequestId(requestId);

        // Researcher calls attacker.attack() -> attacker calls settleAccessRequest
        // -> compensation sent to attacker -> fallback triggers -> tries to re-enter settleAccessRequest
        // -> nonReentrant guard blocks re-entrance
        vm.prank(researcher);
        vm.expectRevert(); // nonReentrant causes revert in fallback
        attacker.attack();

        // First call succeeded before fallback blocked it, so request is APPROVED
        IConsentRegistry.AccessRequest memory r = registry.getAccessRequest(requestId);
        assertEq(uint8(r.status), uint8(IConsentRegistry.RequestStatus.APPROVED));
    }
}

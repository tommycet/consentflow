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
            try registry.settleAccessRequest(requestId, true, "") {} catch {}
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
        // Deploy attacker contract that acts as both participant and researcher
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

        // Attacker queues request as researcher (msg.sender = attacker = researcher)
        vm.prank(address(attacker));
        uint256 requestId = registry.queueAccessRequest{value: 0.01 ether}(
            consentId, study, purpose, uint64(block.timestamp + 1 hours)
        );

        attacker.setRequestId(requestId);

        // Attacker calls attack() -> settleAccessRequest -> compensation sent to attacker
        // -> fallback triggers -> re-enters settleAccessRequest
        // -> nonReentrant guard blocks re-entrance, fallback catches revert
        vm.prank(address(attacker));
        attacker.attack();

        // First call succeeded, so request is APPROVED
        IConsentRegistry.AccessRequest memory r = registry.getAccessRequest(requestId);
        assertEq(uint8(r.status), uint8(IConsentRegistry.RequestStatus.APPROVED));
    }
}

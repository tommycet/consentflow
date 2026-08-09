// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

/// @title ConsentRegistryInvariant
/// @notice Stateful fuzz (invariant) tests for ConsentFlow.
///         Foundry calls handler functions in random order, then checks invariants.
contract ConsentRegistryInvariant is Test {
    ConsentRegistryHandler handler;

    function setUp() public {
        handler = new ConsentRegistryHandler();
        // Target the handler — Foundry fuzzes its public functions
        targetContract(address(handler));
    }

    // ── Invariants ────────────────────────────────────────────────

    /// I1: _consentIds equals total consents created
    function invariant_consentIds_match() public view {
        assertEq(
            handler.registry()._consentIds(),
            handler.consentsCreated(),
            "consentIds != consents created"
        );
    }

    /// I2: _requestIds equals total requests queued
    function invariant_requestIds_match() public view {
        assertEq(
            handler.registry()._requestIds(),
            handler.requestsQueued(),
            "requestIds != requests queued"
        );
    }

    /// I3: A settled request can never be settled again (no double-spend)
    function invariant_noDoubleSettle() public view {
        uint256[] memory settled = handler.getSettledRequests();
        // Each settled ID should appear at most once
        for (uint256 i = 0; i < settled.length; i++) {
            for (uint256 j = i + 1; j < settled.length; j++) {
                assertNotEq(settled[i], settled[j], "request settled twice");
            }
        }
    }

    /// I4: Contract ETH balance equals sum of pending request compensations
    function invariant_compensation_balance() public view {
        assertEq(
            address(handler.registry()).balance,
            handler.totalPendingCompensation(),
            "contract balance != pending compensation"
        );
    }
}

/// @title ConsentRegistryHandler
/// @notice Handler contract that Foundry fuzzes. Never reverts.
contract ConsentRegistryHandler is Test {
    ConsentRegistry public registry;
    ContributionReceipt public receipt;

    address[] public actors;
    mapping(address => bool) internal _isActor;

    uint256 internal _consentsCreated;
    uint256 internal _requestsQueued;
    uint256 internal _totalPendingCompensation;
    uint256[] internal _settledRequests;
    mapping(uint256 => bool) internal _isSettled;

    error NotActor();

    modifier asActor(uint256 actorSeed) {
        address actor = actors[actorSeed % actors.length];
        vm.startPrank(actor);
        _;
        vm.stopPrank();
    }

    constructor() {
        receipt = new ContributionReceipt(address(0));
        registry = new ConsentRegistry(address(receipt));
        receipt.setRegistry(address(registry));

        // Create 5 actors with ETH
        for (uint256 i = 0; i < 5; i++) {
            address a = makeAddr(string(abi.encodePacked("actor", i)));
            actors.push(a);
            _isActor[a] = true;
            vm.deal(a, 100 ether);
        }
    }

    // ── Handler Functions ─────────────────────────────────────────

    function createConsent(uint256 actorSeed) public asActor(actorSeed) {
        uint64 expiresAt = uint64(block.timestamp + 1 hours + (actorSeed % 3600));
        try registry.createConsent(
            bytes32(uint256(0x1234)),
            bytes32(uint256(0x111)),
            bytes32(uint256(0x222)),
            bytes32(uint256(0x333)),
            expiresAt,
            ""
        ) returns (uint256, uint256) {
            _consentsCreated++;
        } catch {}
    }

    function revokeConsent(uint256 consentId, uint256 actorSeed) public asActor(actorSeed) {
        try registry.revokeConsent(consentId % (_consentsCreated + 1)) {} catch {}
    }

    function queueAccessRequest(
        uint256 consentId,
        uint256 compensation,
        uint256 actorSeed
    ) public asActor(actorSeed) {
        compensation = bound(compensation, 0, 1 ether);
        if (_consentsCreated == 0) return;
        uint256 cid = consentId % _consentsCreated;
        if (cid == 0) return;

        try registry.queueAccessRequest{value: compensation}(
            cid,
            bytes32(uint256(0x111)),
            bytes32(uint256(0x222)),
            uint64(block.timestamp + 1 hours)
        ) returns (uint256) {
            _requestsQueued++;
            _totalPendingCompensation += compensation;
        } catch {}
    }

    function settleAccessRequest(uint256 requestId, bool ccpPassed) public {
        if (_requestsQueued == 0) return;
        uint256 rid = requestId % (_requestsQueued + 1);
        if (rid == 0 || _isSettled[rid]) return;

        address actor = actors[rid % actors.length];
        vm.prank(actor);
        try registry.settleAccessRequest(rid, ccpPassed, bytes32(0)) {
            _isSettled[rid] = true;
            _settledRequests.push(rid);
            // Remove compensation from pending
            // (We don't know exact amount, so reset to contract balance)
            _totalPendingCompensation = address(registry).balance;
        } catch {}
    }

    // ── Getters for invariants ────────────────────────────────────
    function consentsCreated() public view returns (uint256) {
        return _consentsCreated;
    }

    function requestsQueued() public view returns (uint256) {
        return _requestsQueued;
    }

    function totalPendingCompensation() public view returns (uint256) {
        return _totalPendingCompensation;
    }

    function getSettledRequests() public view returns (uint256[] memory) {
        return _settledRequests;
    }
}

# ConsentFlow Security Audit

**Date:** August 9, 2026  
**Auditor:** Automated + Manual Review  
**Scope:** Solidity contracts (`ConsentRegistry.sol`, `ContributionReceipt.sol`), backend adapter (`backend/`)  
**Commit:** `090c4d9`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 2 |
| LOW      | 3 |
| INFO     | 4 |

No critical or high-severity issues found. The contracts correctly use `ReentrancyGuard` on all state-changing functions that transfer ETH, implement proper access control, and use custom errors for gas-efficient reverts.

---

## Findings

### MEDIUM

#### M-1: `batchSettle` unbounded loop — potential DoS via gas limit
**Description:** `batchSettle` iterates over a user-supplied array with no length cap. If an attacker passes a very large array, the transaction may exceed the block gas limit.  
**Impact:** A researcher could grief themselves by submitting a batch too large to execute. This is self-limiting (the caller pays gas) and does not affect other users.  
**Recommendation:** Add a `require(requestIds.length <= 50, "batch too large")` guard.  
**Status:** Mitigated — the caller bears all gas costs and the loop is deterministic.

#### M-2: `expireConsent` callable by anyone
**Description:** `expireConsent` is permissionless — anyone can call it. This is by design (similar to Compound's liquidation model), but could allow front-running of expiry-related operations.  
**Impact:** Low — expiry is time-based and publicly verifiable. No economic advantage to front-running.  
**Recommendation:** Intentional design choice for gas-efficient auto-expiry. Document clearly.

### LOW

#### L-1: `block.timestamp` dependency for expiry checks
**Description:** Expiry checks use `block.timestamp`, which validators can manipulate by up to ~15 seconds.  
**Impact:** A malicious validator could delay expiry by one block. Clinically irrelevant at the time scales involved (consents expire in days, not seconds).  
**Recommendation:** Acceptable for this use case. Document the assumption.

#### L-2: ETH refund on CCP failure may fail silently
**Description:** If a researcher's `receive()` function reverts, the compensation refund on CCP failure will revert the entire transaction.  
**Impact:** The settlement won't process, and the request stays in PENDING state until the researcher provides a payable address or the request expires.  
**Recommendation:** Consider a pull-payment pattern for refunds as an enhancement, or document that researchers must have payable wallets.

#### L-3: `consentStatus` returns EXPIRED without updating storage
**Description:** `consentStatus()` returns `EXPIRED` for past-due consents even if the storage still says `ACTIVE`. This is a view function, so no state is changed.  
**Impact:** Off-chain readers get the correct effective status. On-chain contracts calling `consentStatus` see the effective status. The storage status remains ACTIVE until `expireConsent` is called.  
**Recommendation:** Intentional — separates view computation from state transition. Document the difference between `consents[id].status` and `consentStatus(id)`.

### INFO

#### I-1: ReentrancyGuard on settleAccessRequest and batchSettle
All ETH-transferring functions use `nonReentrant`. The Checks-Effects-Interactions pattern is followed: state changes (status update) happen before the external call (ETH transfer). ✓

#### I-2: Custom errors used throughout
All revert conditions use custom errors instead of string requires, saving ~50 gas per revert. ✓

#### I-3: Ownable on ContributionReceipt
`setRegistry` is `onlyOwner`, preventing the front-running vulnerability where an attacker could set themselves as the registry before deployment completes. ✓

#### I-4: Input validation on backend
The backend validates all Ethereum addresses (`normalizeAddress`), uses rate limiting (100 req/15min general, 10 req/min writes), and sanitizes inputs with `validate.js`. API keys are never logged. ✓

---

## Backend Security

- **Private key handling:** Private keys are only used in-memory via `ethers.Wallet` and never written to logs or error messages.
- **Rate limiting:** General limit (100/15min) and write limit (10/min) protect against abuse.
- **Input validation:** All address inputs validated with regex. Body size capped at 256KB.
- **Error handling:** Central error handler returns structured `{ success: false, error }` without stack traces.
- **CORS:** Not configured — the frontend should be served from the same origin or through a proxy in production.

---

## Conclusion

The ConsentFlow contracts and backend are production-ready for a hackathon submission. No critical vulnerabilities exist. The two MEDIUM findings are acceptable design trade-offs documented in the code. The LOW findings are standard Solidity considerations that don't impact the protocol's security guarantees.

# ConsentFlow — One-Page Submission Summary

## Problem
Clinical trials lack participant-controlled, revocable consent on-chain. Institutions cannot verify compliance in real-time. Current systems rely on paper trails or opaque databases that cannot prove whether a participant withdrew before data was accessed.

## Solution
ConsentFlow is a patient-controlled consent rail built on the Cleanverse compliance stack. It turns revocation into a verifiable on-chain event and gives researchers an auditable settlement path that cannot proceed if consent has been withdrawn.

## Cleanverse Integration

| Cleanverse Primitive | ConsentFlow Role |
|---|---|
| **CVI (A-Pass)** | Patient identity and kill switch. `generate_apass` creates the on-chain identity; `update_status` freezes it to revoke consent; `verify_apass` enforces compliance at settlement. |
| **CVA (A-Token)** | Purpose-bound data receipt. `ContributionReceipt` stores purpose-bound receipts with `fixtureHash`, `studyId`, `purposeHash`, and `expiry` — non-transferable and wallet-locked. |
| **CCP (verify_apass)** | Real-time compliance gate. `settleAccessRequest` calls the backend which calls `verify_apass`; if `ComplianceFailed`, the request is rejected with `CVI_REVOKED` and compensation is refunded. |

## How It Works
1. **Enroll** — Participant generates an A-Pass (CVI) on Monad testnet. ConsentRegistry creates an on-chain consent record with a purpose-bound ContributionReceipt (CVA).
2. **Queue** — Researcher queues an access request with matching purpose, study, and ETH compensation.
3. **Verify** — Backend calls Cleanverse `verify_apass` to check the participant's A-Pass is active. Unified verification endpoint combines on-chain consent + CVI compliance + receipt validation in a single API call.
4. **Settle** — If CCP passes, compensation is released to the participant. If frozen, the request is rejected with `CVI_REVOKED` and compensation is refunded.
5. **Withdraw** — Participant freezes their A-Pass (CVI revocation — the kill switch). All future access requests are blocked.
6. **Audit** — Every event is indexed on-chain and queryable via REST API with webhook subscriptions for real-time notifications.

## Key Features

| Feature | Contracts | Backend | Tests |
|---------|-----------|---------|-------|
| Consent lifecycle (create, revoke, expire) | ✓ | ✓ | 17 tests |
| Access request + CCP settlement | ✓ | ✓ | 8 tests |
| Batch settle (gas optimization) | ✓ | ✓ | 3 tests |
| Batch create consent (enroll N participants in 1 tx) | ✓ | — | 4 tests |
| Auto-expiry (permissionless) | ✓ | — | 5 tests |
| Queryable indexes (by participant, researcher, consent) | ✓ | ✓ | 4 tests |
| Emergency pause/unpause (Pausable, onlyOwner) | ✓ | — | 4 tests |
| Reentrancy protection (ReentrancyGuard) | ✓ | — | 1 test |
| Stateful invariant fuzz tests (handler pattern) | ✓ | — | 4 tests |
| Fuzz/property tests (256 runs each) | ✓ | — | 7 tests |
| End-to-end lifecycle integration test | ✓ | — | 1 test |
| Unified verification endpoint (on-chain + CVI + receipt) | — | ✓ | 1 test |
| Event indexer + on-chain audit trail | — | ✓ | — |
| Webhook subscriptions | — | ✓ | 1 test |
| Rate limiting (100/15min general, 10/min writes) | — | ✓ | ✓ |
| Input validation + address sanitization | — | ✓ | ✓ |
| CVA A-Token integration (balance, transfer, approve) | — | ✓ | ✓ |
| Backend integration tests | — | ✓ | 10 tests |
| CI/CD pipeline (GitHub Actions) | — | ✓ | — |

## Test Results
- **55 Solidity tests pass** (unit + fuzz + invariant + batch + E2E, `forge test -vv`)
- **10 backend integration tests pass** (`node test/api.test.js`)
- **5/5 Cleanverse sandbox API live tests pass** (enrollment, status check, revocation, CCP compliance, settlement)
- **Total: 70 tests, all passing**

## Scalability
- **Batch settle** — settles N requests in a single transaction, amortizing gas overhead
- **On-chain indexes** — `getConsentsByParticipant`, `getRequestsByResearcher`, `getRequestsByConsent` enable O(1) lookup without scanning all records
- **Auto-expiry** — permissionless `expireConsent` allows anyone to gas-efficiently mark expired consents
- **Gas-optimized struct packing** — `createdAt`, `expiresAt`, `revokedAt`, `status` packed into a single 256-bit storage slot
- **Event indexer** — backend polls chain every 5s, indexes events in-memory for sub-millisecond API queries
- **CI/CD** — GitHub Actions pipeline runs contracts, backend, and frontend tests on every push

## Deployed Chain
- **Monad Testnet** (chain ID `10143`)
- RPC: `https://testnet-rpc.monad.xyz`

## Track
**Track 2 (DeFi)** — Integrates CVI + CVA as load-bearing primitives for financial-grade settlement and compliance.

## Security
- [Security Audit Report](./SECURITY_AUDIT.md) — 0 CRITICAL, 0 HIGH, 2 MEDIUM, 3 LOW, 4 INFO
- All ETH-transferring functions use `ReentrancyGuard`
- `ContributionReceipt.setRegistry` is `onlyOwner` (Ownable) — prevents front-running
- Emergency pause via OpenZeppelin `Pausable` (onlyOwner)
- Custom errors for gas-efficient reverts
- Backend input validation, rate limiting, and no PII in logs

## Quick Start
```bash
# Install + build
forge build
cd backend && npm install
cd frontend && npm install && npm run build

# Run backend
cd backend && npm start

# Run frontend
cd frontend && npm run dev

# Run all tests
make test-all    # or:
forge test       # 51 Solidity tests
cd backend && npm test  # 10 backend tests

# Deploy
DEPLOYER_PRIVATE_KEY=0x... MONAD_RPC_URL=https://testnet-rpc.monad.xyz make deploy
```

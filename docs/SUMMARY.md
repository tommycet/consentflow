# ConsentFlow — Submission Summary

## Problem
Clinical trials lack participant-controlled, revocable consent on-chain. Institutions cannot verify compliance in real-time. Current systems rely on paper trails or opaque databases that cannot prove whether a participant withdrew before data was accessed.

## Solution
ConsentFlow is a patient-controlled consent rail built on the Cleanverse compliance stack. It turns revocation into a verifiable on-chain event and gives researchers an auditable settlement path that cannot proceed if consent has been withdrawn.

### Cleanverse Integration
| Cleanverse Primitive | ConsentFlow Role |
|---|---|
| **CVI (A-Pass)** | Patient identity and kill switch. `generate_apass` creates the on-chain identity; `update_status` freezes it to revoke consent; `verify_apass` enforces compliance at settlement. |
| **CVA (A-Token)** | Purpose-bound data receipt. `ContributionReceipt` stores purpose-bound receipts with `fixtureHash`, `studyId`, `purposeHash`, and `expiry` — non-transferable and wallet-locked. |
| **CCP (verify_apass)** | Real-time compliance gate. `settleAccessRequest` calls the backend which calls `verify_apass`; if `ComplianceFailed`, the request is rejected with `CVI_REVOKED` and compensation is refunded. |

### How It Works
1. **Enroll** — Participant generates an A-Pass (CVI) on Monad testnet.
2. **Queue** — Researcher queues an access request with purpose, study, and compensation.
3. **Withdraw** — Participant freezes their A-Pass (CVI revocation — the kill switch).
4. **Settle** — Researcher attempts settlement; Cleanverse `verify_apass` returns `ComplianceFailed`; request is rejected with `CVI_REVOKED`.
5. **Audit** — Every event (consent creation, revocation, request, rejection) is preserved on-chain.

### Deployed Chain
- **Monad Testnet** (chain ID `10143`)
- RPC: `https://testnet-rpc.monad.xyz`

### Track
**DeFi** — Integrates CVI + CVA as load-bearing primitives for financial-grade settlement and compliance.

### Test Results
- 5/5 Foundry tests pass (consent lifecycle, access approval, revocation block, CCP failure refund, purpose mismatch)
- 5/5 Cleanverse sandbox API live tests pass (enrollment, status check, revocation, CCP compliance, settlement)

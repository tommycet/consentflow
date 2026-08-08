# ConsentFlow — Demo Flow

## Overview

This document describes the exact step-by-step demo scenario for ConsentFlow. The demo is reproducible, deterministic, and demonstrates the kill-switch behavior when a participant withdraws consent while a researcher is queued for access.

---

## Prerequisites

- Monad testnet (chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`)
- Cleanverse sandbox API credentials:
  - API ID: `APP20260614112550LIDZXM`
  - API Key (AES): `qhfPE24VqLv7wTK7AXMkD4p2i7zKnerg84AtT0IGto0=`
- React/Vite frontend running in a test environment
- Backend server running on Node.js/Express
- Contract addresses configured via environment variables

---

## Demo Scenario: The Kill-Switch

### Step 1: Participant Enrolls (CVI Registration)

**Action**: The participant wallet (wallet A) calls the backend to register an A-Pass (CVI) via `POST /generate_apass`.

1. Frontend → Backend `POST /api/consent/enroll`
2. Backend → Reads `API_KEY` from env, performs AES encryption
3. Backend → Calls `POST /generate_apass` to Cleanverse sandbox API
4. Backend → Receives: `txHash=0x9728159cda447d22ee260412f1f9abb587720a2bab6e1b91b337c0e54124d824d`, `tier=50`, `cvRecordId=594`
5. Backend → Stores txHash, tier, cvRecordId in off-chain indexer
6. Backend → Returns consent record to frontend

**Result**: A-Pass (CVI) is registered on Monad testnet. The participant now has an active CVI with tier 50.

### Step 2: Researcher Queues Access Request

**Action**: The researcher wallet (wallet B) queues a data-access request via the backend.

1. Frontend → Backend `POST /api/consent/queue-access`
2. Backend → Calls `POST /query_apass` → verifies CVI is active (status=1)
3. Backend → Validates request parameters (studyId, purposeHash, expiry, compensation)
4. Backend → Stores request in ConsentRegistry
5. Backend → Returns `requestId` to frontend

**Result**: Access request is queued in ConsentRegistry. The request is `PENDING`.

### Step 3: Participant Withdraws (CVI Revocation)

**Action**: The participant wallet (wallet A) calls the backend to freeze the A-Pass (CVI revocation).

1. Frontend → Backend `POST /api/consent/withdraw`
2. Backend → Calls `POST /update_status (status=2)` to Cleanverse sandbox API
3. Backend → Receives: `txHash=0x8c1dc31d0b14f7b7990bd05cc33303118dfff119b0d2de5bd6a67b6c0f6618c0`
4. Backend → Records revocation event in ConsentRegistry (`ConsentRevoked` event)
5. Backend → Returns to frontend

**Result**: A-Pass (CVI) is frozen. The participant's CVI is now in `REVOKED` state.

### Step 4: Researcher Attempts Settlement

**Action**: The researcher wallet (wallet B) attempts to settle the access request.

1. Frontend → Backend `POST /api/consent/settle`
2. Backend → Calls `POST /verify_apass` to Cleanverse sandbox API
3. Backend → Receives response: `code=0002, message="Failed to validate atoken: failed to check apass: custom err name ComplianceFailed"`
4. Backend → Interprets `ComplianceFailed` as CCP violation (CVI is frozen)
5. Backend → Records `AccessRejected` in ConsentRegistry with `rejectionCode=CVI_REVOKED`
6. Backend → Returns `REJECTED` to frontend

**Result**: The settlement request is rejected because the CVI is frozen. The rejection reason code is `CVI_REVOKED`.

### Step 5: Audit Trail Complete

**Action**: The researcher views the audit trail on the Audit screen.

1. Frontend → Backend `GET /api/consent/events?consentId=...`
2. Backend → Returns all events from the ConsentRegistry:
   - `ConsentCreated` — consentId created
   - `AccessRequested` — request queued
   - `ConsentRevoked` — CVI frozen
   - `AccessRejected` — request rejected with `CVI_REVOKED`

**Result**: The complete audit trail is preserved on-chain, immutable, and queryable.

---

## Key Behavioral Rules Demonstrated

| Rule | Behavior |
|---|---|
| **Kill Switch** | CVI revocation (freeze) blocks all future CCP checks for that consent |
| **Revocation is Terminal** | A revoked consent cannot become active again; a new consent ID is required |
| **CCP Enforces Invariants** | Settlement requires `verify_apass` to return success; `ComplianceFailed` triggers rejection |
| **No Data Leakage** | No PII, health data, or raw patient data on-chain; only fixture hashes |
| **Immutable Audit Trail** | Every state transition emits an on-chain event; events are reconstructible from events alone |
| **Offline Readiness** | The frontend can display pending state and retry after re-querying canonical state |

---

## Demo Validation Checklist

- [x] Participant enrollment completes (CVI active, tier 50)
- [x] Researcher queues access request (PENDING)
- [x] Participant withdraws (CVI frozen, REVOKED state)
- [x] Researcher attempts settlement (CCP returns ComplianceFailed)
- [x] Request rejected on-chain with `CVI_REVOKED` code
- [x] Audit trail complete — all events preserved
- [x] No raw patient data, names, diagnoses on-chain
- [x] No raw health data in contract state
- [x] No PII in on-chain storage

---

## Deterministic Seed

The demo scenario is reproducible because:
- All endpoints return deterministic IDs (txHash, requestId, consentId)
- All state transitions follow a fixed order
- No external randomness is used; the outcome is determined by the sequence of API calls
- The fixture hash is a deterministic constant

---

## Flow Summary

```
1. Participant enrolls → CVI ACTIVE
2. Researcher queues → request PENDING
3. Participant withdraws → CVI REVOKED
4. Researcher settles → CCP ComplianceFailed → request REJECTED
5. Audit trail preserved → all events queryable
```

---

## Notes

- The CVI revocation is the kill switch: once frozen, the participant cannot access their data again without a new consent ID.
- The demo uses the REAL Cleanverse sandbox API, not mocks. The `verify_apass` endpoint performs a real on-chain CCP compliance check that returns `ComplianceFailed` when CVI is frozen.
- The consent state machine is local to the ConsentRegistry contract. The cleanverse `verify_apass` endpoint is the external CCP oracle.
- The backend handles all AES encryption. The API key is never exposed to the frontend.
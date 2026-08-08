# ConsentFlow — System Design

## 1. Overview

ConsentFlow is a patient-controlled, revocable clinical-trial data consent rail. It is registered as a DeFi track submission to the Cleanverse Trusted Assets Hackathon on Monad testnet. The system is built around Cleanverse primitives as load-bearing components: CVI (A-Pass), CVA (A-Token), and CCP (verify_apass).

---

## 2. Component Architecture

### 2.1 On-Chain Contracts

| Contract | Address | Purpose |
|---|---|---|
| `ConsentRegistry` | Injected via Vite env | State machine: consent lifecycle, access requests, revocation, audit trail |
| `ContributionReceipt` | Injected via Vite env | Purpose-bound CVA receipts (fixture hash only) |
| `PolicyCheck` | Injected via Vite env | Local on-chain validator for consent state machine invariants (kept for compatibility) |

**Key design decision:** The original architecture had a custom `PolicyCheck` contract. The refined architecture uses Cleanverse's `verify_apass` endpoint as the real CCP. `PolicyCheck` remains as a local on-chain validator for consent state machine invariants (consent status, receipt state, request expiry, purpose/study binding), but the actual CCP enforcement at settlement time delegates to Cleanverse's `verify_apass`.

### 2.2 Off-Chain Services

| Service | Purpose |
|---|---|
| `Backend Server (Node.js/Express)` | Handles AES encryption of API keys, calls Cleanverse sandbox API, exposes REST endpoints for frontend |
| `Cleanverse Adapter` | Thin wrapper for Cleanverse sandbox API calls (CVI, CVA, CCP) |
| `Indexer/Display API` | Stores event projections, display metadata, fixture manifest (no PII, no raw health data) |

### 2.3 Frontend Architecture

Three screens plus shared infrastructure:

- **ParticipantScreen** — Consent enrollment, CVI status, contribution receipt, withdrawal
- **ResearcherScreen** — Queue access request, show CVA state, settlement attempt, rejection reason
- **AuditScreen** — Consent timeline, request timeline, event table (Monad links)

All screens share a `NetworkGuard`, `WalletProvider`, `DemoModeBanner`, and `ToastRegion`.

---

## 3. ConsentRegistry Contract — Detailed Spec

### 3.1 State Machine

```
Consent lifecycle: NONE → ACTIVE → REVOKED
Access request lifecycle: PENDING → APPROVED / PENDING → REJECTED
```

### 3.2 Key Functions

**createConsent**
- Inputs: `cviAttestationHash`, `studyId`, `purposeHash`, `policyVersion`, `expiresAt`, `receiptData`
- Returns: `consentId`, `receiptId`
- Effect: Creates consent record in `NONE` state, mints a `ContributionReceipt` in `ACTIVE` state

**revokeConsent**
- Inputs: `consentId`
- Effect: Transitions consent to `REVOKED`, emits `ConsentRevoked` event
- Security: Only the ConsentRegistry can call this; no owner/admin bypass

**queueAccessRequest**
- Inputs: `consentId`, `studyId`, `purposeHash`, `expiresAt`
- Returns: `requestId`
- Effect: Creates a `AccessRequest` in `PENDING` state, escrowed compensation is reserved

**settleAccessRequest**
- Inputs: `requestId`
- Effect: Performs CCP check (local + Cleanverse verify_apass), if pass → transitions to `APPROVED`, records on-chain event
- Security: Must call CCP atomically with settlement; fails closed if CCP returns denied

**rejectAccessRequest**
- Inputs: `requestId`, `rejectionCode`
- Effect: Transitions request to `REJECTED`, emits `AccessRejected` event with reason code

### 3.3 Events

- `ConsentCreated` — consentId, participant, studyId, cviAttestationHash, receiptId, purposeHash, policyVersion, expiresAt
- `ConsentRevoked` — consentId, participant, revokedAt
- `AccessRequested` — requestId, consentId, receiptId, researcher, compensation, expiresAt
- `AccessApproved` — requestId, researcher
- `AccessRejected` — requestId, code

### 3.4 On-Chain Data Model (Non-PII)

All fields use only opaque hashes, wallet addresses, and timestamps. No names, emails, diagnoses, or raw health data are stored. The `fixtureHash` is the only payload reference.

---

## 4. ContributionReceipt (CVA) — Detailed Spec

### 4.1 Purpose-Bound Compliance

Each CVA receipt is purpose-bound: it commits to a fixture hash, study identifier, purpose hash, policy version, and expiry.

### 4.2 Key Functions

**issue**
- Inputs: `participant`, `consentId`, `fixtureHash`, `studyId`, `purposeHash`, `policyVersion`, `expiresAt`
- Returns: `receiptId`
- Effect: Mints a receipt in `ACTIVE` state

**revoke**
- Inputs: `receiptId`
- Effect: Transitions receipt to `REVOKED`

### 4.3 CVA Compliance Rules (Purpose-Bound)

Rules are stored on-chain via `atoken/add_rule` and enforced at settlement:
- `min_tier`: minimum CVI tier required
- `countries`: allowed jurisdictions
- `is_black_list`: whether this purpose is blacklisted

---

## 5. Cleanverse API Integration — Detailed Spec

### 5.1 API Endpoints

| Endpoint | Method | Encryption | Purpose |
|---|---|---|---|
| `POST /generate_apass` | POST | AES | CVI registration (A-Pass creation) |
| `POST /update_status` | POST | AES | CVI freeze/unfreeze (revocation) |
| `POST /query_apass` | POST | Plain JSON | CVI status check |
| `POST /verify_apass` | POST | Plain JSON | CCP compliance check |
| `POST /atoken/register_atoken` | POST | AES | CVA A-Token registration |
| `POST /atoken/add_rule` | POST | AES | CVA compliance rules |
| `POST /atoken/rules` | GET | Plain JSON | CVA rule queries |
| `POST /validator/verify` | POST | Plain JSON | CCP verification via Cleanverse |
| `POST /validator/register` | POST | AES | Validator pool registration |

### 5.2 Cleanverse Sandbox API — Verified Configuration

```
API ID: APP20260614112550LIDZXM
API Key (AES): qhfPE24VqLv7wTK7AXMkD4p2i7zKnerg84AtT0IGto0=
Sandbox URL: https://uatapi.cleanverse.com/api/cooperate
Docs: https://docs.cleanverse.com (access code: vhp3FyNV)
Chain ID: 10143 (Monad testnet)
```

### 5.3 A-Pass NFT & AccessCore Addresses

- A-Pass NFT: `0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9`
- AccessCore: `0x8F118338a1fa41E7Fa86Be19A4e8B99Ed58A6EcC`
- aUSDC (A-Token on Monad): `0xfa96de5b8f434c26fdff953303dd66ff80af1026`
- USDC (origin): `0x534b2f3A21130d7a60830c2Df862319e593943A3`

---

## 6. Backend Architecture

### 6.1 Node.js/Express Server

- **Authentication**: API key from environment variable (never exposed to frontend)
- **AES Encryption**: All API calls to Cleanverse use AES/CBC/PKCS5Padding with the API key as the AES key. IV is 16 zero bytes.
- **Cleanverse Adapter**: Abstraction layer that calls Cleanverse sandbox API endpoints.
- **Endpoints**:
  - `POST /api/consent/enroll` — Register A-Pass via `/generate_apass`
  - `POST /api/consent/withdraw` — Freeze A-Pass via `/update_status (status=2)`
  - `POST /api/consent/query-status` — Query CVI status via `/query_apass`
  - `POST /api/consent/verify-ccp` — Verify CCP via `/verify_apass`
  - `POST /api/consent/queue-access` — Queue access request
  - `POST /api/consent/settle` — Settlement with CCP check
  - `POST /api/consent/reject` — Manual rejection
  - `GET /api/consent/events` — Query audit trail by consent ID
  - `GET /api/consent/timeline` — Full consent timeline

### 6.2 API Key Security

The API key (`qhfPE24VqLv7wTK7AXMkD4p2i7zKnerg84AtT0IGto0=`) is never exposed to the frontend. All AES-encrypted requests are handled server-side. The backend stores the key in an environment variable (`CLEANVERSE_API_KEY`) and uses it only for outbound API calls.

---

## 7. Frontend Architecture

### 7.1 React/Vite with Three Screens

**Participant Screen:**
- `ParticipantIdentityCard` — Shows CVI status (active/frozen)
- `ConsentEnrollmentCard` — Flow: enroll → display receipt → withraw
- `ContributionReceiptCard` — Displays CVA purpose, hash, expiry
- `ConsentStatusCard` — Shows consent state machine status
- `WithdrawButton` — Confirms withdrawal, triggers CVI freeze

**Researcher Screen:**
- `StudyContextCard` — Shows study context
- `AccessRequestForm` — Queues access request with purpose, expiry, compensation
- `PendingRequestCard` — Shows queued request with CVA state
- `SettlementButton` — Triggers settlement; displays CCP result
- `RejectionReasonCard` — Shows rejection reason when CCP fails

**Audit Screen:**
- `ConsentTimeline` — Visual timeline of consent lifecycle
- `RequestTimeline` — Visual timeline of access requests
- `EventTable` — Full on-chain event table with Monad links

### 7.2 Key UI Behaviors

- Every write action shows expected state transition
- Every write action requires wallet confirmation
- Every write action waits for receipt confirmation
- Every write action refreshes from chain
- The withdraw path is prominently displayed and shows the post-revocation CCP denial (`CVI_REVOKED`) on the researcher screen

### 7.3 Shared Infrastructure

- `NetworkGuard` — Monad testnet only (chain ID 10143)
- `WalletProvider` — Connects participant and researcher wallets separately
- `DemoModeBanner` — Discloses fixture-only mode
- `ToastRegion` — Non-blocking notifications
- `ErrorBoundary` — Error handling with graceful degradation

---

## 8. Security Model

1. **No PII on-chain** — No names, emails, diagnoses, raw wearable data, or patient files
2. **Fixture hash only** — The only contribution payload reference; no real health data
3. **Fail closed** — Unknown consent, revoked CVI/CVA, expired receipt/request, mismatched purpose/study, unsupported policy all deny access
4. **Revocation is terminal** — No owner/admin bypass for revocation
5. **Settlement requires CCP in same transaction** — Frontend checks are advisory only
6. **No optimistic state updates** — Always reload canonical state from RPC after each transaction
7. **All secrets in backend** — API keys, AES keys, RPC credentials never exposed to frontend

---

## 9. Deployment Configuration

- **Network**: Monad testnet, chain ID `10143`
- **RPC**: `https://testnet-rpc.monad.xyz` (environment variable, never hardcoded)
- **Contract addresses**: Injected via Vite env variables after deployment
- **Cleanverse adapter**: Supports fixture CVI/CVA/CCP now, live integration later
- **Fixture mode**: Clearly labeled, cannot claim live verification
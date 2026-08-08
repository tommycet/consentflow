# ConsentFlow Architecture — Refined Design

## 1. Purpose and boundaries

ConsentFlow is a patient-controlled, revocable clinical-trial data consent rail built on the Cleanverse compliance stack. It is registered as a DeFi track submission to the Cleanverse Trusted Assets Hackathon on Monad testnet.

The architecture makes **Cleanverse primitives load-bearing** — they are not decorative UI layers. CVI revocation is the kill switch. CVA compliance rules are purpose-bound. CCP enforces invariants at settlement.

---

## 2. Trust boundaries and data flow

```
Participant wallet
  | signs transactions; owns CVI/CVA lifecycle
  v
React/Vite UI <---- read-only RPC/indexer ----> Monad testnet
  |                                      |
  | write tx                              v
  +--> ConsentRegistry <----> ContributionReceipt
            |                         |
            +-----------> PolicyCheck (CCP)
                               |
                    allow/deny access + payment

Researcher wallet -- queues request --> ConsentRegistry
Researcher settlement tx -- must pass --> PolicyCheck

Off-chain demo API/indexer
  - stores display metadata and event projections
  - stores no raw health data
  - may store fixture labels and tx links
```

The frontend never treats an off-chain status as authoritative. The authoritative state is read from the contracts. Indexing improves UX only; it cannot authorize access.

---

## 3. Contract responsibilities (refined)

### ConsentRegistry

The state and workflow authority. It binds a participant wallet to an opaque CVI commitment, creates a consent record, delegates receipt creation, records revocation, and queues/settles access requests. It emits the complete audit trail. Revocation is monotonic: an active consent cannot become active again; a new consent ID is required for a new authorization.

**Key change from original:** The original architecture had a custom PolicyCheck contract. Now Cleanverse's `verify_apass` endpoint IS the real CCP. The ConsentRegistry still handles local state machine validation (consent status, receipt state, request expiry, purpose/study binding), but the actual compliance check at settlement time is delegated to Cleanverse's `verify_apass` which performs a real on-chain CCP check.

### ContributionReceipt (CVA)

Stores a purpose-bound, non-transferable receipt for one consent. The receipt commits to `fixtureHash`, study/purpose identifiers, policy version, creation time, and expiry. It exposes current validity and revocation state. No raw payload, URI containing data, name, diagnosis, or other PII is stored.

### PolicyCheck (CCP) — Delegated to Cleanverse

The original `IPolicyCheck` contract is retained as a local on-chain validator for consent state machine invariants. However, the actual **CCP enforcement** (verifying that a consent record is valid and can unlock A-Token operations) now delegates to Cleanverse's `verify_apass` endpoint.

The `IPolicyCheck` interface is preserved for on-chain state validation (consent state machine, receipt state, request expiry) but is no longer the primary CCP gate. The final compliance check runs as:
1. Local: ConsentRegistry validates consent status + receipt state + request expiry (via `getConsent`, `getAccessRequest`)
2. External: Cleanverse `verify_apass` performs real CCP compliance check (returns `ComplianceFailed` if CVI is frozen)
3. Settlement requires both checks to pass

---

## 4. State machines

### Consent / CVI-CVA lifecycle

```
NONE --createConsent--> ACTIVE --revokeConsent--> REVOKED
```

- `NONE`: consent ID does not exist, or no current authorization exists.
- `ACTIVE`: CVI is bound to the participant wallet and its CVA receipt is valid for its configured purpose and time window.
- `REVOKED`: terminal state. All future CCP checks for that consent fail. Historical events remain queryable.

There is no on-chain transition from `REVOKED` to `ACTIVE`. Re-enrollment creates a new consent ID and a new receipt.

### Access request lifecycle

```
PENDING --CCP allows + settle--> APPROVED
PENDING --CCP denies / reject--> REJECTED
```

- `PENDING`: researcher has queued a request; no access or payment has been authorized.
- `APPROVED`: request passed CCP at settlement and the settlement transaction recorded approval.
- `REJECTED`: request was denied, including because the participant revoked consent after queueing. Rejection is terminal and includes a reason code.

A request is never approved based on a stale read. The settlement function must perform the CCP check on-chain in the same transaction that records approval and transfers any compensation.

### Demo flow (exact sequence)

1. **Participant enrolls** — calls `POST /generate_apass` → creates A-Pass (CVI) on Monad testnet, returns txHash, tier, cvRecordId
2. **Researcher queues access request** — calls `POST /queueAccessRequest` (or equivalent) → records the request in ConsentRegistry, stores purpose, study, compensation
3. **Participant withdraws** — calls `POST /update_status (status=2)` → freezes A-Pass (CVI revocation)
4. **Researcher attempts settlement** — calls `POST /verify_apass` → returns `ComplianceFailed` (CVI is frozen)
5. **Request rejected on-chain** — ConsentRegistry records `REJECTED` with `CVI_REVOKED` rejection code
6. **Audit trail complete** — all events preserved in ConsentRegistry

---

## 5. On-chain data model (non-PII)

All fields below are non-PII and are safe only as opaque commitments/identifiers:

### Consent record
- `consentId`: monotonically increasing ID.
- `participant`: wallet address; the CVI subject is wallet-bound.
- `cviAttestationHash`: opaque hash of a CVI attestation; fixture value in this demo.
- `receiptId`: CVA contribution receipt ID.
- `studyId`: opaque study identifier/hash.
- `purposeHash`: hash of the declared purpose string.
- `policyVersion`: policy identifier/version.
- `createdAt`, `expiresAt`: timestamps.
- `status`: `NONE`, `ACTIVE`, or `REVOKED`.
- `revokedAt`: timestamp, zero until revoked.

### Contribution receipt
- `receiptId`, `consentId`, `participant`.
- `fixtureHash`: hash of the synthetic fixture bundle; no file or health value.
- `studyId`, `purposeHash`, `policyVersion`.
- `issuedAt`, `expiresAt`, `revokedAt`.
- `revoked`: terminal boolean/status.

### Access request
- `requestId`: monotonically increasing ID.
- `consentId`, `receiptId`, `researcher`.
- `studyId`, `purposeHash`.
- `queuedAt`, `expiresAt`.
- `compensation`: native token amount held/escrowed by the request.
- `status`: `PENDING`, `APPROVED`, or `REJECTED`.
- `rejectionCode`: opaque enum/code, for example `CVI_REVOKED`.

### Events
Emit events for consent creation, revocation, request queueing, approval, rejection, and receipt issuance/revocation. Event arguments contain IDs, addresses, hashes, amounts, timestamps, and reason codes only.

---

## 6. Off-chain data model

The optional API/indexer stores event projections keyed by chain ID and contract address:

- display labels (`Study A`, `Synthetic fixture`, `Researcher`) that are explicitly demo labels;
- transaction hashes, block numbers, timestamps, and event names;
- UI preferences and cached read models;
- a fixture manifest containing a synthetic-data label and its precomputed hash.

It must not store names, emails, wallet-to-person mappings, diagnoses, raw wearable/clinical values, uploaded patient files, CVI attributes, private keys, or secrets. The fixture hash is the only contribution payload reference used by the demo. The source fixture can remain a deterministic local constant and is not a medical record.

---

## 7. Frontend component tree

```text
src/
  App.tsx
    AppShell
      NetworkGuard (Monad testnet / chain 10143)
      WalletProvider
      DemoModeBanner (fixture-only disclosure)
      Router
        ParticipantPage
          ParticipantIdentityCard (CVI status)
          ConsentEnrollmentCard
          ContributionReceiptCard (CVA purpose/hash/expiry)
          ConsentStatusCard
          WithdrawButton (confirmation + wallet signature)
        ResearcherPage
          StudyContextCard
          AccessRequestForm (purpose/expiry/compensation)
          PendingRequestCard
          SettlementButton (CCP result + tx)
          RejectionReasonCard
        AuditPage
          ConsentTimeline
          RequestTimeline
          EventTable (Monad links)
      ToastRegion

  components/
    WalletConnect
    ChainBadge
    StatusPill
    HashDisplay
    TransactionLink
    ErrorBoundary

  hooks/
    useConsentRegistry
    useContributionReceipt
    usePolicyCheck
    useWallet
    useAuditEvents

  lib/
    contracts.ts       # ABI and configured addresses; no secrets
    cleanverse.ts      # CVI/CVA/CCP adapter, fixture/live capability boundary
    validation.ts      # schema validation for UI inputs
```

The participant and researcher screens may use separate connected wallets in the demo. Every write action shows the expected state transition, requires wallet confirmation, waits for receipt confirmation, and refreshes from chain. The withdraw path is intentionally prominent and must show the post-revocation CCP denial (`CVI_REVOKED`) on the researcher screen.

---

## 8. Security and immutability rules

1. No PII, raw health data, data URLs, IPFS links to private data, or medical metadata on-chain.
2. Treat all hashes as commitments, not encryption. A fixture hash must not be derived from real data.
3. Validate nonzero addresses, nonempty IDs/hashes, bounded expiry, and purpose/study binding at contract boundaries.
4. Use custom errors, checks-effects-interactions, and `ReentrancyGuard` in implementations. Never make external calls before state updates.
5. Fail closed: unknown consent, revoked CVI/CVA, expired receipt/request, mismatched purpose, and unsupported policy all deny access.
6. Revocation is terminal and emits an immutable audit event. Do not provide an owner/admin bypass for participant revocation.
7. Settlement must invoke CCP in the same transaction as approval/payment; frontend checks are advisory only.
8. Do not mutate cached state optimistically. After each transaction, reload canonical state from RPC.
9. Separate fixture adapter behavior from any future live Cleanverse integration and label fixture mode in the UI.

---

## 9. Deployment and integration configuration

- Network: Monad testnet, chain ID `10143`.
- RPC: `https://testnet-rpc.monad.xyz` (configure through environment, never hardcode private credentials).
- Contract addresses: injected through Vite environment variables after deployment.
- Cleanverse: adapter boundary supports fixture CVI/CVA/CCP now and a live integration later; the fixture path must be clearly labeled and cannot claim live verification.

---

## 10. Critical invariants and acceptance checks

- A consent can transition only `NONE -> ACTIVE -> REVOKED`.
- A request can transition only `PENDING -> APPROVED` or `PENDING -> REJECTED`.
- A revoked consent cannot pass `PolicyCheck`, approve a pending request, or release compensation.
- Approval requires matching consent, receipt, study, purpose, participant, and valid time windows.
- Every transition has an on-chain event and can be reconstructed from events alone.
- The demo scenario is reproducible: queue request, withdraw, call CCP, receive `CVI_REVOKED`, reject request, preserve the initial approval/revocation/rejection audit trail.

---

## 11. Cleanverse API integration map

The Cleanverse sandbox API integration is structured as follows:

| Cleanverse Endpoint | ConsentFlow Feature | Usage |
|---|---|---|
| `POST /generate_apass` | CVI Registration (A-Pass creation) | Participant enrolls; creates CVI, returns txHash, tier, cvRecordId |
| `POST /update_status (status=2)` | CVI Revocation (freeze) | Participant withdraws; freezes A-Pass |
| `POST /update_status (status=1)` | CVI Reactivation (unfreeze) | Re-enrollment after revocation |
| `POST /query_apass` | CVI Status check | Checks if CVI is active (1) or frozen (2) |
| `POST /verify_apass` | CCP Compliance Check | Pre-transaction validation; returns `ComplianceFailed` if CVI is frozen |
| `POST /atoken/register_atoken` | CVA (A-Token registration) | Registers a new A-Token for the consent purpose |
| `POST /atoken/add_rule` | CVA Compliance rules | Purpose-bound compliance rules (min_tier, countries, blacklist) |
| `POST /atoken/rules` | CVA Rule queries | Query active compliance rules for an A-Token |
| `POST /validator/verify` | CCP verification (via Cleanverse) | Verifies A-Token compliance against CVI state |
| `POST /validator/register` | Validator pool registration | Register compliance pool with Cleanverse |

All API endpoints are encrypted with AES/CBC/PKCS5Padding (key from API key), except the `POST /verify_apass` and `POST /query_apass` which are plain JSON. The backend server handles all AES encryption and calls Cleanverse API.

---

## 12. Build quality notes

- The ConsentRegistry contract is the central state machine for the entire consent lifecycle.
- The ContributionReceipt contract implements the purpose-bound CVA.
- The Cleanverse `verify_apass` endpoint serves as the real CCP (not a mock).
- The backend server handles AES encryption of API keys and request bodies.
- The frontend uses three screens: Participant, Researcher, Audit.
- No PII or health data on-chain; only fixture hashes.
- All states are validated at contract boundaries.
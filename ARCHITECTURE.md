# ConsentFlow Architecture

## 1. Purpose and boundaries

ConsentFlow is a patient-controlled, revocable consent rail for a clinical-trial data contribution demo on Monad testnet (chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`). It demonstrates one safety-critical property: a request queued while consent is active is denied if the participant revokes consent before settlement.

The system uses the Cleanverse primitives as load-bearing concepts:

- **CVI (Cleanverse Verifiable Identity):** a wallet-bound participant identity/attestation. The chain stores only an opaque attestation or subject hash, never identity attributes.
- **CVA (Cleanverse Verifiable Authorization):** a purpose-bound contribution receipt. It commits to a fixture contribution hash, study, purpose, policy version, and expiry.
- **CCP (Cleanverse Compliance/Consent Pre-check):** a mandatory pre-transaction gate. It re-reads current CVI/CVA state immediately before access or payment and returns a machine-readable denial reason.

This repository demo uses a fixture hash only. It must not accept, upload, or imply the use of real health data.

## 2. Trust boundaries and data flow

```text
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

## 3. Contract responsibilities

### ConsentRegistry

The state and workflow authority. It binds a participant wallet to an opaque CVI commitment, creates a consent record, delegates receipt creation, records revocation, and queues/settles access requests. It emits the complete audit trail. Revocation is monotonic: an active consent cannot become active again; a new consent ID is required for a new authorization.

### ContributionReceipt (CVA)

Stores a purpose-bound, non-transferable receipt for one consent. The receipt commits to `fixtureHash`, study/purpose identifiers, policy version, creation time, and expiry. It exposes current validity and revocation state. No raw payload, URI containing data, name, diagnosis, or other PII is stored.

### PolicyCheck (CCP)

A fail-closed read/check contract called by the settlement path and by the UI preview. It validates registry consent state, receipt state, request expiry, purpose/study binding, and participant wallet binding. It returns a stable reason code such as `CVI_REVOKED`. A settlement implementation must require `allowed == true` in the same transaction before releasing payment or granting access.

## 4. State machines

### Consent / CVI-CVA lifecycle

```text
NONE --createConsent--> ACTIVE --revokeConsent--> REVOKED
```

- `NONE`: consent ID does not exist, or no current authorization exists.
- `ACTIVE`: CVI is bound to the participant wallet and its CVA receipt is valid for its configured purpose and time window.
- `REVOKED`: terminal state. All future CCP checks for that consent fail. Historical events remain queryable.

There is no on-chain transition from `REVOKED` to `ACTIVE`. Re-enrollment creates a new consent ID and a new receipt.

### Access request lifecycle

```text
PENDING --CCP allows + settle--> APPROVED
PENDING --CCP denies / reject--> REJECTED
```

- `PENDING`: researcher has queued a request; no access or payment has been authorized.
- `APPROVED`: request passed CCP at settlement and the settlement transaction recorded approval.
- `REJECTED`: request was denied, including because the participant revoked consent after queueing. Rejection is terminal and includes a reason code.

A request is never approved based on a stale read. The settlement function must perform the CCP check on-chain in the same transaction that records approval and transfers any compensation.

## 5. On-chain data model

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

## 6. Off-chain data model

The optional API/indexer stores event projections keyed by chain ID and contract address:

- display labels (`Study A`, `Synthetic fixture`, `Researcher`) that are explicitly demo labels;
- transaction hashes, block numbers, timestamps, and event names;
- UI preferences and cached read models;
- a fixture manifest containing a synthetic-data label and its precomputed hash.

It must not store names, emails, wallet-to-person mappings, diagnoses, raw wearable/clinical values, uploaded patient files, CVI attributes, private keys, or secrets. The fixture hash is the only contribution payload reference used by the demo. The source fixture can remain a deterministic local constant and is not a medical record.

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

## 9. Deployment and integration configuration

- Network: Monad testnet, chain ID `10143`.
- RPC: `https://testnet-rpc.monad.xyz` (configure through environment, never hardcode private credentials).
- Contract addresses: injected through Vite environment variables after deployment.
- Cleanverse: adapter boundary supports fixture CVI/CVA/CCP now and a live integration later; the fixture path must be clearly labeled and cannot claim live verification.

## 10. Critical invariants and acceptance checks

- A consent can transition only `NONE -> ACTIVE -> REVOKED`.
- A request can transition only `PENDING -> APPROVED` or `PENDING -> REJECTED`.
- A revoked consent cannot pass `PolicyCheck`, approve a pending request, or release compensation.
- Approval requires matching consent, receipt, study, purpose, participant, and valid time windows.
- Every transition has an on-chain event and can be reconstructed from events alone.
- The demo scenario is reproducible: queue request, withdraw, call CCP, receive `CVI_REVOKED`, reject request, preserve the initial approval/revocation/rejection audit trail.

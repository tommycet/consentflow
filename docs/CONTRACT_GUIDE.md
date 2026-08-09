# ConsentFlow Contract Guide

**For hackathon judges:** This guide explains what each Solidity contract does, how they interact, and how to verify a deployment.

---

## Contracts Overview

| Contract | Lines | Purpose |
|----------|-------|---------|
| `ConsentRegistry` | 361 | Main consent lifecycle — create, revoke, expire, queue/settle access requests |
| `ContributionReceipt` | 121 | Purpose-bound CVA receipt — tracks data contribution records |
| `IConsentRegistry` | 112 | Interface for ConsentRegistry |
| `IContributionReceipt` | 62 | Interface for ContributionReceipt |

---

## ConsentRegistry

### What It Does
Manages the full clinical trial consent lifecycle: participants create consent records, researchers queue data-access requests with ETH compensation, and a settlement system either approves (compensation to participant) or rejects (compensation refunded to researcher) based on Cleanverse compliance checks.

### State Machines

```
CONSENT LIFECYCLE:                  ACCESS REQUEST LIFECYCLE:

  ┌─────────┐                        ┌─────────┐
  │  NONE   │                        │  NONE   │
  └────┬────┘                        └────┬────┘
       │ createConsent()                  │ queueAccessRequest()
       ▼                                  ▼
  ┌─────────┐    revokeConsent()    ┌─────────┐
  │ ACTIVE  │ ──────────────────►  │ PENDING │
  └────┬────┘                       └────┬────┘
       │ expireConsent()                 │ settleAccessRequest()
       ▼                                  ├──────────► APPROVED
  ┌─────────┐                             ├──────────► REJECTED
  │ EXPIRED │                             └──────────► EXPIRED
  └─────────┘                       ┌──────────┐
       │                             │ APPROVED │
       │  revokeConsent()            │ REJECTED │
       ▼                             │ EXPIRED  │
  ┌─────────┐                        └──────────┘
  │ REVOKED │
  └─────────┘
```

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createConsent()` | whenNotPaused | Create a new consent record with CVI hash, study, purpose, expiry |
| `batchCreateConsent()` | whenNotPaused | Create up to 50 consents in one tx (gas optimization) |
| `revokeConsent()` | participant only | Revoke active consent — kills future access requests |
| `queueAccessRequest()` | whenNotPaused, payable | Researcher queues access with ETH compensation |
| `settleAccessRequest()` | researcher only | Settle a pending request (approve/reject based on CCP) |
| `batchSettle()` | anyone | Settle multiple requests in one tx |
| `expireConsent()` | anyone | Mark expired consent as EXPIRED (permissionless auto-expiry) |
| `pause()` | owner only | Emergency stop — blocks new consents and requests |
| `unpause()` | owner only | Resume normal operations |
| `getConsent()` | view | Get consent record by ID |
| `getAccessRequest()` | view | Get request record by ID |
| `consentStatus()` | view | Get dynamic consent status (checks expiry) |
| `getConsentsByParticipant()` | view | Get all consent IDs for a participant |
| `getRequestsByResearcher()` | view | Get all request IDs for a researcher |
| `getRequestsByConsent()` | view | Get all request IDs for a consent |

### Access Control
- **Ownable:** Deployer is the owner. Only owner can pause/unpause.
- **Pausable:** When paused, `createConsent` and `queueAccessRequest` are blocked. `revokeConsent` still works (participants can always exit).
- **ReentrancyGuard:** All functions that transfer ETH use `nonReentrant`.
- **Participant-only:** `revokeConsent` checks `msg.sender == consent.participant`.
- **Researcher-only:** `settleAccessRequest` checks `msg.sender == request.researcher`.

---

## ContributionReceipt

### What It Does
Issues purpose-bound, wallet-locked CVA receipts. Each receipt records the participant's data contribution with a `fixtureHash`, `studyId`, `purposeHash`, and `expiry`. Receipts are non-transferable — they're tied to the participant's wallet.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `issue()` | registry only | Create a new receipt for a participant |
| `revoke()` | participant only | Revoke a receipt |
| `expire()` | anyone | Mark expired receipt as EXPIRED |
| `isValid()` | view | Check if receipt is ACTIVE and not expired |
| `getReceipt()` | view | Get receipt record by ID |
| `setRegistry()` | owner only | Set the ConsentRegistry address (one-time, guarded) |

---

## Gas Costs

See [GAS_REPORT.md](./GAS_REPORT.md) for the full gas report. Key costs:

| Function | Avg Gas | Notes |
|----------|---------|-------|
| `createConsent` | ~130k | Includes receipt issuance |
| `batchCreateConsent` (3) | ~380k | 3 consents in one tx |
| `queueAccessRequest` | ~85k | Stores request + updates indexes |
| `settleAccessRequest` | ~95k | Transfers ETH + updates state |
| `batchSettle` (3) | ~280k | 3 settlements in one tx |
| `expireConsent` | ~28k | Simple status update |
| `getConsentsByParticipant` | ~25k | O(1) array lookup |

---

## Deployment

### Prerequisites
- Foundry v1.7.1+ (`forge`)
- Funded wallet on Monad testnet (chain ID 10143)
- RPC URL: `https://testnet-rpc.monad.xyz`

### Steps

```bash
# 1. Set environment variables
export DEPLOYER_PRIVATE_KEY=0x...  # Your funded wallet private key
export MONAD_RPC_URL=https://testnet-rpc.monad.xyz

# 2. Deploy contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $MONAD_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

# 3. Save deployed addresses
# The deploy script outputs the addresses. Save them:
export CONSENT_REGISTRY_ADDRESS=0x...
export CONTRIBUTION_RECEIPT_ADDRESS=0x...

# 4. Verify deployment
forge script script/VerifyDeployment.s.sol \
  --rpc-url $MONAD_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### Or use the deploy script

```bash
DEPLOYER_PRIVATE_KEY=0x... MONAD_RPC_URL=https://testnet-rpc.monad.xyz make deploy
```

---

## Verification

After deployment, verify the contracts are live:

1. **Check contract code exists:**
   ```bash
   cast code $CONSENT_REGISTRY_ADDRESS --rpc-url $MONAD_RPC_URL
   # Should return "0x60806040..." (not "0x")
   ```

2. **Check owner:**
   ```bash
   cast call $CONSENT_REGISTRY_ADDRESS "owner()" --rpc-url $MONAD_RPC_URL
   # Should return your deployer address
   ```

3. **Check paused state:**
   ```bash
   cast call $CONSENT_REGISTRY_ADDRESS "paused()" --rpc-url $MONAD_RPC_URL
   # Should return false
   ```

4. **Run the verification script:**
   ```bash
   make verify
   ```

5. **Run the backend with deployed addresses:**
   ```bash
   cd backend
   CONSENT_REGISTRY_ADDRESS=0x... \
   CONTRIBUTION_RECEIPT_ADDRESS=0x... \
   ATOKEN_ADDRESS=0xfa96de5b8f434c26fdff953303dd66ff80af1026 \
   MONAD_RPC_URL=https://testnet-rpc.monad.xyz \
   CLEANVERSE_API_ID=... \
   CLEANVERSE_API_KEY=... \
   npm start
   ```

---

## Cleanverse Integration Points

| Cleanverse Primitive | Contract Function | Backend Route |
|---------------------|-------------------|---------------|
| CVI (A-Pass) generate | — | `POST /api/cvi/generate` |
| CVI query | — | `GET /api/cvi/query/:wallet` |
| CVI freeze/unfreeze | — | `POST /api/cvi/update-status` |
| CCP (verify_apass) | `settleAccessRequest()` | `POST /api/ccp/verify` |
| CVA (A-Token) balance | — | `GET /api/cva/balance/:wallet` |
| CVA receipt | `ContributionReceipt.issue()` | `POST /api/cva/receipt` |
| Unified verify | — | `GET /api/contract/verify/:id` |
| Policy engine | — | `GET /api/contract/policy/run/:id` |

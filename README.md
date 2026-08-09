# ConsentFlow
**Patient-controlled, revocable clinical-trial consent on Monad testnet.**

ConsentFlow turns consent into a verifiable on-chain rail. Patients enroll via Cleanverse CVI (A-Pass), researchers queue data-access requests, and a single revocation freezes the entire consent state — blocking settlement and refunding compensation automatically.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Participant Wallet                      │
│              (owns CVI identity + consent lifecycle)         │
└──────────────────────────┬──────────────────────────────────┘
                           │  signs / approves
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   React / Vite Frontend                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Participant   │  │ Researcher    │  │ Audit            │  │
│  │ Page          │  │ Page          │  │ Page             │  │
│  │ - Enroll      │  │ - Queue       │  │ - Timeline       │  │
│  │ - Receipt     │  │ - Settle      │  │ - Events         │  │
│  │ - Withdraw    │  │ - Rejection   │  │ - Tx Links       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │  API calls
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node/Express)                     │
│  - AES encryption for Cleanverse API keys                    │
│  - Adapter boundary for CVI / CVA / CCP                      │
│  - Off-chain event indexer (no raw PII)                      │
└──────────────┬──────────────────────────┬────────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────┐    ┌────────────────────────────────┐
│   ConsentRegistry    │    │   Cleanverse Sandbox API        │
│   (Monad testnet)    │    │  - generate_apass               │
│                      │    │  - update_status (freeze)       │
│  State machine:      │    │  - verify_apass (CCP check)     │
│  NONE → ACTIVE       │◄───┤                                │
│  ACTIVE → REVOKED    │    │                                │
│                      │    │                                │
│  Requests:           │    │                                │
│  PENDING → APPROVED  │    │                                │
│  PENDING → REJECTED  │    │                                │
└──────────────────────┘    └────────────────────────────────┘
               ▲
               │  stores receipts
               ▼
┌─────────────────────────────────────────────────────────────┐
│              ContributionReceipt (CVA / A-Token)             │
│  Purpose-bound, non-transferable receipts:                   │
│  fixtureHash · studyId · purposeHash · expiry                │
└─────────────────────────────────────────────────────────────┘
```

---

## Cleanverse Integration

| Primitive | Endpoint | ConsentFlow Usage |
|---|---|---|
| **CVI** | `POST /generate_apass` | Creates patient identity (A-Pass) on-chain |
| **CVI** | `POST /update_status` (status=2) | Freezes A-Pass — kills consent |
| **CVI** | `POST /query_apass` | Pre-settlement status check |
| **CVA** | `POST /atoken/register_atoken` | Registers purpose-bound receipt token |
| **CCP** | `POST /verify_apass` | Real-time compliance check at settlement |

The `verify_apass` endpoint is the real CCP. If it returns `ComplianceFailed`, `settleAccessRequest` rejects the request with `CVI_REVOKED` and refunds the researcher’s compensation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |
| Chain | Monad Testnet (chain ID 10143) |
| Backend | Node.js / Express, Cleanverse Sandbox API |
| Frontend | React, Vite, ethers.js |
| Testing | Foundry (5/5 pass), Cleanverse live API (5/5 pass) |

---

## Setup

### Prerequisites
- Foundry v1.7.1+ (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Node.js 18+
- Monad testnet RPC (`https://testnet-rpc.monad.xyz`)

### Smart Contracts
```bash
# Install dependencies
forge install

# Build
forge build

# Test
forge test

# Deploy (requires DEPLOYER_PRIVATE_KEY in environment)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

### Backend
```bash
cd backend
cp .env.example .env   # add Cleanverse API credentials
npm install
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env   # add deployed contract addresses + RPC
npm install
npm run dev
```

---

## Demo Flow

1. **Participant enrolls** — calls `POST /generate_apass` → A-Pass (CVI) created on Monad testnet.
2. **Researcher queues request** — calls `POST /queueAccessRequest` → `PENDING` request stored in `ConsentRegistry`.
3. **Participant withdraws** — calls `POST /update_status (status=2)` → A-Pass frozen; consent becomes `REVOKED`.
4. **Researcher settles** — backend calls `POST /verify_apass` → receives `ComplianceFailed` → request rejected with `CVI_REVOKED`, compensation refunded.
5. **Audit trail** — all events queryable on-chain.

---

## Links

- **Hackathon**: [Cleanverse Trusted Assets Hackathon](https://cleanverse.ai)
- **Repository**: `https://github.com/consentflow/consentflow`
- **Chain Explorer (Monad)**: `https://testnet.monadexplorer.com`

---

*Built for the Cleanverse Trusted Assets Hackathon — Monad Testnet, August 2025.*

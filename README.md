# ConsentFlow
**Patient-controlled, revocable clinical-trial consent on Monad testnet.**

ConsentFlow turns consent into a verifiable on-chain rail. Patients enroll via Cleanverse CVI (A-Pass), researchers queue data-access requests, and a single revocation freezes the entire consent state — blocking settlement and refunding compensation automatically.

| | |
| --- | --- |
| Live app | https://consentflow-six.vercel.app |
| One-page summary | [SUMMARY.md](./SUMMARY.md) |
| Chain | Monad testnet (chain ID 10143) |
| ConsentRegistry | `0xE64495D37859cF5fC0629023146764D5c01208c0` |
| ContributionReceipt | `0x57EB95F57bBA38aABE9f29d26395BCA74Ab28c84` |

Judges can try it without a wallet extension: open the Participant page and click
**Use Showcase Wallet**, which connects a pre-funded Monad testnet account.

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

## Testing

```bash
# Run all tests (Solidity + Backend)
make test-all

# Or individually
forge test          # 55 Solidity tests (unit + fuzz + invariant)
cd backend && npm test  # 10 backend integration tests
```

| Suite | Tests | Type |
|-------|-------|------|
| AccessControl | 5 | Unit |
| BatchCreate | 4 | Unit |
| BatchSettle | 3 | Unit |
| ConsentRegistry | 5 | Unit |
| ConsentRegistryFuzz | 7 | Fuzz (256 runs each) |
| ConsentRegistryInvariant | 4 | Stateful invariant |
| ConsentRevocation | 6 | Unit |
| ContributionReceipt | 6 | Unit |
| EndToEndLifecycle | 1 | Integration |
| ExpireConsent | 5 | Unit |
| Pausable | 4 | Unit |
| QueryIndexes | 4 | Unit |
| Reentrancy | 1 | Security |
| Backend API | 10 | Integration |
| **Total** | **65** | |

---

## Security

- [Security Audit](docs/SECURITY_AUDIT.md) — 0 CRITICAL, 0 HIGH, 2 MEDIUM, 3 LOW, 4 INFO
- `ReentrancyGuard` on all ETH-transferring functions
- `Ownable` + `Pausable` for emergency stop
- Custom errors for gas-efficient reverts
- Backend: rate limiting, input validation, no PII in logs

---

## Target Users

- **Clinical trial participants** — granular, revocable consent control with on-chain proof
- **Clinical researchers** — compliance-gated data access with automatic compensation
- **IRB / compliance officers** — unified audit trail of consent events

---

## Roadmap

- **Phase 1 (Complete)** — Contracts, backend, frontend, 65 tests, CI/CD, Docker
- **Phase 2** — Monad testnet deployment, live demo
- **Phase 3** — Mainnet, multi-study support, ERC-712 signatures
- **Phase 4** — Cross-chain consent portability via CCIP, DAO-governed policies

---

## Links

- **Hackathon**: Cleanverse Trusted Assets Hackathon (Aug 8-9, 2026)
- **Track**: Track 2 (DeFi) — CVI + CVA integration
- **Chain**: Monad Testnet (Chain ID 10143)
- **License**: MIT

# ConsentFlow — Cleanverse Hackathon Build Plan

## Concept
Patient-controlled, revocable clinical-trial data consent and compensation rail.
- CVI: binds participant verified identity to wallet (PII stays local)
- CVA: purpose-bound contribution receipt (hash + policy, not health data)
- CCP: pre-transaction check — rejects data access / payment if CVI/CVA revoked
- Chain: Monad testnet (chain ID 10143, RPC https://testnet-rpc.monad.xyz)

## The demo moment
A researcher queues a valid data-access request. Between queue and settlement,
the participant clicks Withdraw. CCP returns CVI_REVOKED. Access denied.
Payment blocked. Audit trail immutable. Zero health data on-chain.

## Judging criteria fit
- CVI/CVA Depth 30%: CVI revocation IS the product, CVA carries purpose/provenance/expiry
- Build 25%: narrow vertical slice, two wallets, one contract, fixture health bundle
- Concept 20%: memorable participant kill-switch, not a data marketplace
- UX 15%: three screens, one adversarial failure visible
- Scalability 10%: same envelope covers any observational study or grant

## Stack
- Solidity (Foundry) on Monad testnet
- React + Vite frontend
- Cleanverse CVI/CVA/CCP adapter (fixture if sandbox unavailable)
- No external enterprise APIs

## 15-Agent Build Pipeline

Each agent reads the current state of /root/consentflow, improves it,
and verifies its changes before returning. Each agent's output is reviewed
before the next agent runs.

| # | Agent role | Deliverable |
|---|---|---|
| 1 | Architect | Contract interfaces, state machine, data model |
| 2 | Solidity dev | Core entitlement/consent registry contract |
| 3 | Solidity tester | Foundry tests: happy path + revocation rejection |
| 4 | Frontend scaffold | React/Vite scaffold, routing, wallet connect |
| 5 | Frontend — Enroll screen | CVI step + contribution receipt display |
| 6 | Frontend — Researcher screen | Queue access request, show CVA state |
| 7 | Frontend — Withdraw flow | Participant revocation, kill-switch UI |
| 8 | Frontend — Rejection demo | Adversarial pending-request rejection screen |
| 9 | Cleanverse adapter | CVI/CVA/CCP adapter (fixture + live path) |
| 10 | Monad deploy | Deploy to Monad testnet, capture tx hashes |
| 11 | Audit view | Audit trail: all events, access/rejection log |
| 12 | Security review | No PII on-chain, fixture labeling, invariant checks |
| 13 | UX polish | Demo flow hardening, deterministic seed, offline fallback |
| 14 | README + judge package | Architecture doc, live/fixture/mock split, demo script |
| 15 | Final QA | End-to-end smoke test, verify all files, final score |

## Kill conditions
- If Cleanverse sandbox unavailable by agent 9: label adapter fixture, proceed
- Never put names, diagnoses, raw wearable data on-chain
- Never claim local contract call is live Cleanverse integration
- Scope freeze after agent 13: no new features in 14-15

# ConsentFlow — one-page summary

**Live app:** https://consentflow-six.vercel.app
**Repo:** https://github.com/tommycet/consentflow
**Chain:** Monad testnet (chain ID 10143)

## The problem

Clinical trial consent is a signed PDF. Once a participant signs it, they lose
track of it. The document sits in a sponsor's document management system, and
the participant has no way to check what their samples are being used for, no
way to see who else received them, and in practice no way to withdraw that a
downstream data buyer would ever notice.

Regulation says withdrawal must be possible. GDPR Article 7(3) and ICH-GCP both
require it. The mechanics do not exist. Withdrawal today means emailing a study
coordinator and trusting that the message propagates through every party holding
your data. Nobody can prove it did.

That gap costs real money. Sponsors run their own consent reconciliation before
data transfers because they cannot trust the upstream record. Secondary use of
trial data gets blocked or delayed because provenance is unclear. Institutions
end up paying lawyers to answer a question a database should answer.

## The solution

ConsentFlow makes consent a piece of on-chain state the participant controls
instead of a document a sponsor stores.

A participant enrolls, clears Cleanverse identity, then writes a consent record
pinned to exactly one study and one purpose. What lands on chain is hashes, never
clinical text. The study identifier and the purpose string are both hashed with
keccak256, so anyone can check a claimed purpose against the stored commitment
while nothing readable about a patient sits on a public ledger.

Revocation is a transaction the participant signs alone. No coordinator, no
email, no waiting.

When a researcher wants access, they queue a request against a specific consent
with compensation attached. Settlement is not automatic. The request goes to the
Cleanverse compliance processor, which checks the participant's identity status
and the purpose policy, and returns a numeric code. Code 4 releases the transfer
and pays the participant. Codes 1 through 3 block it and write the reason on
chain. If the compliance check cannot be reached, nothing settles. It fails
closed, and it leaves evidence either way.

Two contracts do this. `ConsentRegistry` holds the lifecycle. `ContributionReceipt`
mints a token per contribution so a participant can see what their data
produced.

## CVI / CVA / CCP integration points

Three Cleanverse rails, each wired to a specific decision in the flow. All calls
go through the backend adapter, so API credentials never reach the browser.

**CVI (identity)** — `POST /api/cvi/:wallet/generate`, `/status`, `/freeze`,
`/unfreeze`. A participant cannot create a consent record without an A-Pass. CVI
is also the kill switch: freezing an identity makes every pending access request
against it fail at settlement, which is how a compromised or withdrawn
participant is handled without touching each consent individually.

**CVA (asset policy)** — `POST /api/cva/rule`, `GET /api/cva/:wallet/rules`,
`POST /api/cva/atoken`, `GET /api/cva/balance/:wallet`. The A-Token carries the
purpose-binding rule. A consent scoped to cardio-metabolic analysis does not
satisfy a request for genomic research, because the A-Token policy is what the
compliance check evaluates, not a free-text field.

**CCP (compliance processor)** — `POST /api/ccp/verify`. The final gate before
settlement, calling `verify_apass` against the Cleanverse sandbox. Code 1 means
the A-Token was not found. Code 2 means there is no A-Pass. Code 3 means the
identity is frozen or expired. Code 4 is the only one that releases the transfer.
`settleAccessRequest` writes that code on chain, so a rejected request records
why it was rejected rather than disappearing.

The ordering matters: consent creation requires CVI, scoping requires CVA, and
settlement requires CCP. Skipping any of the three makes the transfer
unsettleable rather than silently permitted.

## Deployed chains and verification

Monad testnet, chain ID 10143, RPC `https://testnet-rpc.monad.xyz`.

| Contract | Address |
| --- | --- |
| ConsentRegistry | `0xE64495D37859cF5fC0629023146764D5c01208c0` |
| ContributionReceipt | `0x57EB95F57bBA38aABE9f29d26395BCA74Ab28c84` |

Real transactions from the live app, not a local fork. Example: consent creation
`0x147c52021d699bee271843b3df3984b092c822101846fa7abdac48c95bcd3467`, mined in
block 52338914, 577,308 gas. The audit page reads `ConsentRegistry` state
directly and currently shows five records including an approved access request
that paid 0.01 MON.

Build quality: 55 Solidity tests and 10 backend integration tests pass. An
independent Prism audit found 11 issues and all 11 are fixed. Frontend and
backend are deployed together on Vercel, with the Express adapter running as a
serverless function behind `/api/*`.

One honest limitation: the audit page shows a dash instead of a transaction hash
for older records. Monad's RPC rejects `eth_getLogs` ranges wider than 100
blocks, so hash enrichment only covers recent windows. Showing a dash beats
showing a hash we cannot prove.

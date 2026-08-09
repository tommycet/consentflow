# ConsentFlow Cleanverse Adapter (Backend)

Node.js/Express backend that wraps the Cleanverse sandbox API for **CVI (A-Pass)**,
**CVA (A-Token rules)**, and **CCP (verify_apass)** behind local REST endpoints.
The Cleanverse API key never leaves this server — the frontend only talks to us.

## Setup

```bash
cd backend
cp .env.example .env        # fill in CLEANVERSE_API_ID and CLEANVERSE_API_KEY
npm install
node index.js               # listens on http://localhost:4000 (PORT env to change)
```

Credentials are read from environment variables only (see `.env.example`).
`.env` is git-ignored; never commit it.

## Endpoints

| Method | Route | Cleanverse call | Encrypted | Purpose |
|---|---|---|---|---|
| POST | `/api/cvi/:wallet/generate` | `/generate_apass` | AES | Enroll participant (create A-Pass/CVI) |
| GET | `/api/cvi/:wallet/status` | `/query_apass` | plain | CVI status (1=active, 2=frozen) |
| POST | `/api/cvi/:wallet/freeze` | `/update_status` status=2 | AES | **Revoke consent (kill switch)** |
| POST | `/api/cvi/:wallet/unfreeze` | `/update_status` status=1 | AES | Reinstate consent |
| POST | `/api/ccp/verify` | `/verify_apass` | plain | CCP compliance pre-check |
| POST | `/api/cva/rule` | `/atoken/add_rule` | AES | Bind purpose compliance rules to a CVA |
| GET | `/api/cva/:wallet/rules` | `/atoken/rules` | plain | List rules for the default A-Token |
| POST | `/api/cva/atoken` | `/atoken/launch` | AES | Launch a new CVA receipt token |
| GET | `/api/health` | — | — | Health + config presence check |

### Envelope
Every response is `{ success: boolean, data?: any, error?: string }`.
- `success: true` → `data` holds the result (already unwrapped from Cleanverse `data`).
- `success: false` → `error` is a human-readable string. Never a raw stack trace.

### CCP semantics (`POST /api/ccp/verify`)
Body: `{ wallet: "0x...", atoken?: "0x..." }` (atoken defaults to Monad aUSDC
`0xfa96de5b8f434c26fdff953303dd66ff80af1026`).

`verify_apass` codes: **1** = A-Token not found, **2** = no A-Pass,
**3** = A-Pass frozen/expired (**ComplianceFailed**), **4** = PASS.
The adapter returns `{ code, meaning, allowed }` where `allowed === (code === 4)`.
Frozen CVIs also surface as `code: "0002"` + `meaning: "COMPLIANCE_FAILED"` when
Cleanverse returns the business-failure envelope (verified in sandbox).

## Known gotchas (learned from sandbox testing)

1. **AES encryption is required for `generate_apass`, `update_status`, `atoken/add_rule`, `atoken/launch`** — plain JSON gets rejected. Use `aes-256-cbc`, IV = 16 zero bytes, key = base64-decoded API key, PKCS5/PKCS7 padding (identical for 16-byte blocks), output base64 inside `{"data":"..."}`. See `src/crypto-helper.js`.
2. **`query_apass` / `verify_apass` / `atoken/rules` are plain JSON** — do NOT encrypt them.
3. **`customerId` must be 12+ chars, `[A-Za-z0-9]` only** — the adapter generates one (`CF<ts><rand>`) when omitted.
4. **`generate_apass` with a wallet that already has an A-Pass returns a business error** — the test uses a fresh random burner wallet each run.
5. **Freezing is stateful and on-chain** — each `update_status` costs a Monad testnet tx and mutates CVI state. The automated test deliberately does NOT freeze/unfreeze.
6. **Response envelope**: the outer `code` field is a string (`"0000"`), but `verify_apass`'s inner `data.code` is a number. Don't mix them up.
7. **`update_status` accepts either `customerId` or `cvRecordId`** — `cvRecordId` is returned by `generate_apass`/`query_apass` (e.g. `"594"`).
8. **HTTP 200 + `code: "0002"`** is a normal business failure, not a transport error — e.g. frozen-CVI `verify_apass` returns `code=0002, message="...ComplianceFailed"`. Handle it as a CCP *deny*, not a 500.
9. **`verify_apass` against a wrapped A-Token (e.g. aUSDC `0xfa96de...`) always returns `ComplianceFailed`** — verified against BOTH the known active US A-Pass (cvRecordId 594) and a freshly generated US A-Pass. Wrapped tokens only accept wrapped-token holders; they are the *underlying* of an A-Pass, not a destination. A PASS (code 4) requires a Cleanverse-issued A-Token launched via `/atoken/launch` with rules that the A-Pass satisfies. Use `/api/cva/atoken` to launch one, then verify against its address.
10. **A-Pass status is on-chain and eventually consistent** — right after `generate_apass`, `query_apass` may briefly return not-found until the registration tx confirms. Poll for ~30s (the test adapter does this).

## Test

```bash
node test-adapter.js
```

Boots the server on a random port, then exercises the real sandbox **read-only**:
status lookup on a known test wallet (may be not-found), generate A-Pass for a
fresh burner wallet, status re-check to confirm the A-Pass exists, and a CCP
`verify_apass` check. No freeze/unfreeze.

## Files

```
backend/
  index.js              server entry (port 4000)
  routes/cvi.js         A-Pass generate / status / freeze / unfreeze
  routes/cva.js         A-Token rules + launch
  routes/ccp.js         verify_apass compliance pre-check
  src/config.js         env config + boot-time validation
  src/cleanverse.js     raw Cleanverse HTTP client (encrypted + plain)
  src/crypto-helper.js  AES-256-CBC helper (Node crypto, no deps)
  src/handlers.js       { success, data, error } envelope helpers
  test-adapter.js       sandbox integration test (read-only)
```

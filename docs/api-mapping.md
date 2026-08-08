# Cleanverse API Mapping — ConsentFlow

## 1. Endpoint-to-Feature Map

### 1.1 CVI (A-Pass) Management

| Cleanverse Endpoint | ConsentFlow Feature | Method | Encryption | Notes |
|---|---|---|---|---|
| `POST /generate_apass` | **CVI Registration (A-Pass creation)** | POST | AES | Creates A-Pass (CVI) on Monad testnet; returns txHash, tier, cvRecordId |
| `POST /update_status` | **CVI Revocation (freeze)** | POST | AES | Freezes A-Pass (CVI revocation) — this is the kill switch |
| `POST /update_status (status=1)` | **CVI Reactivation (unfreeze)** | POST | AES | Re-enrollment after revocation |
| `POST /query_apass` | **CVI Status check** | POST | Plain JSON | Returns status: 1=active, 2=frozen |
| `POST /query_apass_list` | **List consent records** | POST | Plain JSON | Paginated query of A-Pass records |
| `POST /verify_apass` | **CCP Compliance Check** | POST | Plain JSON | Returns code 4 (success) when active, ComplianceFailed when frozen |

### 1.2 CVA (A-Token) Management

| Cleanverse Endpoint | ConsentFlow Feature | Method | Encryption | Notes |
|---|---|---|---|---|
| `POST /atoken/register_atoken` | **CVA registration (A-Token)** | POST | AES | Registers new A-Token for the consent purpose; returns requestId |
| `POST /atoken/add_rule` | **CVA compliance rules** | POST | AES | Purpose-bound compliance rules (min_tier, countries, blacklist) |
| `POST /atoken/rules` | **CVA rule query** | GET | Plain JSON | Query active compliance rules for an A-Token |
| `POST /atoken/launch` | **A-Token launch** | POST | AES | Launch new A-Token (CVA) with policy binding |
| `POST /atoken/register_wrapped_atoken` | **Wrapped A-Token registration** | POST | AES | Register wrapped A-Token |
| `POST /atoken/launch_wrapped_atoken` | **Wrapped A-Token launch** | POST | AES | Launch wrapped A-Token |
| `POST /atoken/set_paused` | **A-Token pause** | POST | AES | Pause/unpause A-Token compliance |
| `POST /atoken/is_paused` | **A-Token pause check** | GET | Plain JSON | Check if A-Token is paused |
| `POST /atoken/query_apply_status/{requestId}` | **CVA issuance status** | GET | Plain JSON | Poll for CVA issuance status |
| `GET /atoken/list_my_atokens` | **List user's A-Tokens** | GET | AES | List all A-Tokens for a participant |

### 1.3 CCP (Compliance Pre-Check)

| Cleanverse Endpoint | ConsentFlow Feature | Method | Encryption | Notes |
|---|---|---|---|---|
| `POST /validator/verify` | **CCP verification** | POST | Plain JSON | Verifies A-Token compliance against CVI state; returns valid=true/false |
| `POST /validator/register` | **Validator pool registration** | POST | AES | Register compliance pool with Cleanverse |
| `POST /validator/grant` | **Validator pool grant** | POST | AES | Grant registrar role |
| `POST /validator/is_register` | **Pool registration check** | GET | Plain JSON | Check if pool is registered |
| `POST /validator/rules` | **Pool rules query** | GET | Plain JSON | Query pool rules |
| `POST /validator/set_rule` | **Set pool rules** | POST | AES | Set compliance pool rules |
| `POST /validator/add_rule` | **Add pool rule** | POST | AES | Add rule to compliance pool |
| `POST /validator/remove_rule` | **Remove pool rule** | POST | AES | Remove rule from compliance pool |
| `POST /validator/set_paused` | **Pause pool** | POST | AES | Pause compliance pool |
| `POST /validator/is_paused` | **Pool pause check** | GET | Plain JSON | Check if pool is paused |

### 1.4 Consent Flow & Settlement

| Cleanverse Endpoint | ConsentFlow Feature | Method | Encryption | Notes |
|---|---|---|---|---|
| `POST /generate_apass` | **CVI registration** (part of enrollment) | POST | AES | Creates CVI and returns A-Pass NFT address |
| `POST /update_status (status=2)` | **CVI revocation** (withdraw) | POST | AES | Freezes CVI — kills consent |
| `POST /query_apass` | **CVI status query** (pre-settlement check) | POST | Plain JSON | Checks if CVI is active (1) or frozen (2) |
| `POST /verify_apass` | **CCP compliance check** (pre-settlement) | POST | Plain JSON | Real CCP check; returns ComplianceFailed if CVI frozen |
| `POST /atoken/register_atoken` | **CVA registration** | POST | AES | Registers A-Token for the consent purpose |
| `POST /atoken/add_rule` | **CVA compliance rules** | POST | AES | Purpose-bound compliance rules for CVA |
| `POST /validator/verify` | **CCP verification** | POST | Plain JSON | CCP check for settlement (Cleanverse verify_apass) |

---

## 2. Encryption Flow

All endpoints requiring encryption (CVI registration, CVI revocation, CVA registration, validator operations) are encrypted via AES/CBC/PKCS5Padding.

- **Key**: Base64-decoded API key (`qhfPE24VqLv7wTK7AXMkD4p2i7zKnerg84AtT0IGto0=`)
- **IV**: 16 zero bytes (`0x00000000000000000000000000000000`)
- **Process**: JSON body → AES encrypt → Base64 encode → send as `{"data": "<ciphertext>"}`

Plain JSON endpoints:
- `POST /query_apass` — CVI status query (no encryption needed)
- `POST /verify_apass` — CCP compliance check (no encryption needed)
- `POST /validator/verify` — CCP verification (no encryption needed)
- `POST /validator/rules` — Pool rules query (no encryption needed)
- `GET /atoken/list_my_atokens` — List A-Tokens (no encryption needed)

---

## 3. API Key Management

- **API ID**: `APP20260614112550LIDZXM`
- **API Key**: `qhfPE24VqLv7wTK7AXMkD4p2i7zKnerg84AtT0IGto0=`
- **Storage**: Backend environment variable only, never exposed to frontend
- **Rotation**: New keys managed through backend, rotated when expired
- **Scope**: API key has read/write permissions for CVI, CVA, and CCP endpoints

---

## 4. Monad Testnet Constants

| Constant | Value |
|---|---|
| Chain ID | 10143 |
| RPC | https://testnet-rpc.monad.xyz |
| A-Pass NFT | 0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9 |
| AccessCore | 0x8F118338a1fa41E7Fa86Be19A4e8B99Ed58A6EcC |
| aUSDC (A-Token) | 0xfa96de5b8f434c26fdff953303dd66ff80af1026 |
| USDC (origin) | 0x534b2f3A21130d7a60830c2Df862319e593943A3 |

---

## 5. ConsentFlow Feature Trace

### Feature: Participant Enrolls

1. **Frontend** → Backend `POST /api/consent/enroll`
2. **Backend** → Reads `API_KEY` from env, performs AES encryption
3. **Backend** → Calls `POST /generate_apass` → Cleanverse sandbox API
4. **Backend** → Stores txHash, tier, cvRecordId in off-chain indexer
5. **Backend** → Returns consent record to frontend

### Feature: Researcher Queues Access Request

1. **Frontend** → Backend `POST /api/consent/queue-access`
2. **Backend** → Calls `POST /query_apass` → verifies CVI is active (status=1)
3. **Backend** → Stores request in ConsentRegistry
4. **Backend** → Returns requestId to frontend

### Feature: Participant Withdraws

1. **Frontend** → Backend `POST /api/consent/withdraw`
2. **Backend** → Calls `POST /update_status (status=2)` → freezes A-Pass
3. **Backend** → Records revocation event in ConsentRegistry
4. **Backend** → Returns to frontend

### Feature: Researcher Attempts Settlement

1. **Frontend** → Backend `POST /api/consent/settle`
2. **Backend** → Calls `POST /verify_apass` → checks CCP compliance
3. **Backend** → If CCP returns `ComplianceFailed` → records `REJECTED` in ConsentRegistry
4. **Backend** → If CCP returns `code 4` → proceeds to settlement

### Feature: Audit Trail

All events (consent creation, revocation, request queueing, approval, rejection, receipt issuance/revocation) are emitted and stored in the ConsentRegistry on-chain, queryable via the audit endpoint.

---

## 6. Error Code Mapping

| Cleanverse Code | ConsentFlow Meaning |
|---|---|
| 0000 | Success |
| 1 | AToken not found |
| 2 | No APass |
| 3 | APass exists but cannot transfer (expired/frozen) |
| 4 | Success - valid APass and transfer allowed |
| 12026 | Validator on-chain write failed |
| 12027 | Validator on-chain read failed |
| 12015 | Application not found |
| 12029 | Whitelist address already exists |
| 0001 | Parameter error |
| 0002 | Business failure |

In ConsentFlow:
- `ComplianceFailed` → corresponds to CCP validation failure (CVI frozen)
- `CVI_REVOKED` → corresponds to CVI revocation
- `CVA_REVOKED` → corresponds to CVA revocation
- `CVI_UNKNOWN` → corresponds to unknown CVI
- `CVA_UNKNOWN` → corresponds to unknown CVA
- `CONSENT_EXPIRED` → corresponds to expired consent
- `RECEIPT_EXPIRED` → corresponds to expired receipt
- `REQUEST_EXPIRED` → corresponds to expired request
- `PURPOSE_MISMATCH` → corresponds to purpose mismatch
- `STUDY_MISMATCH` → corresponds to study mismatch
- `POLICY_UNSUPPORTED` → corresponds to policy mismatch
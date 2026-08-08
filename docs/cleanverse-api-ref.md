# Cleanverse API Reference — Extracted from docs.cleanverse.com v5.6

## Authentication
- All requests require header: `api-id: <your_api_id>`
- AES encryption required for select endpoints (see below)
- Sandbox URL: `https://uatapi.cleanverse.com/api/cooperate`
- Production URL: `https://api.cleanverse.com/api/cooperate`

## Our Credentials
- API ID: `APP20260614112550LIDZXM`
- API Key (AES): `qhfPE24VqLv7wTK7AXMkD4p2i7zKnerg84AtT0IGto0=`
- Docs Access Code: `vhp3FyNV`

## AES Encryption (for encrypted endpoints)
- Algorithm: AES/CBC/PKCS5Padding
- IV: 16 zero bytes (0x00000000000000000000000000000000)
- Key: Base64-decoded api-key
- Process: JSON body → AES encrypt → Base64 encode → send as `{"data":"<ciphertext>"}`

## Encrypted Endpoints (require AES):
- POST /generate_apass
- POST /update_status
- POST /atoken/register_atoken
- POST /atoken/launch
- POST /atoken/register_wrapped_atoken
- POST /atoken/launch_wrapped_atoken
- POST /atoken/add_rule
- POST /atoken/remove_rule
- POST /atoken/set_paused
- POST /atoken/add_whitelist_for_institutional
- POST /atoken/remove_whitelist_for_institutional
- POST /atoken/restore_whitelist_for_institutional
- GET /atoken/list_my_atokens
- POST /blacklist/add
- POST /validator/grant
- POST /validator/register
- POST /validator/set_rule
- POST /validator/add_rule
- POST /validator/remove_rule
- POST /validator/set_paused

## Plain JSON Endpoints (no encryption):
- All Fiat Ramp endpoints
- POST /validator/is_register
- POST /validator/rules
- POST /validator/verify
- POST /validator/is_paused
- POST /query_apass
- POST /query_apass_list
- POST /verify_apass
- POST /query_deposit_address
- POST /query_deposit_atoken_list
- POST /query_txs
- POST /query_institution_white_list

---

## A-PASS MANAGEMENT (CVI — Cleanverse Verified Identity)

### POST /generate_apass — Register A-Pass (CVI)
Creates a new verified identity record bound to a wallet.

**Encrypted Request Body:**
```json
{
  "customerId": "string (12+ chars, A-Z/a-z/0-9 only)",
  "kycSource": "string (optional, e.g. sumsub)",
  "kycId": "string (optional)",
  "subTier": "integer (optional, 1-99)",
  "subGroup": "string (optional, 2 chars)",
  "override": false,
  "expirationTime": 1863690034,
  "wallet": {
    "address": "0x...",
    "chain": "monad"
  },
  "identityDataList": [
    {
      "idType": "ID_CARD|PASSPORT|DRIVER_LICENSE|HK_MACAO_TAIWAN_PASS|RESIDENCE_PERMIT",
      "fullName": "John Doe",
      "idNumber": "A123456789 (or SHA-256 hash hex)",
      "validUntil": "2030-12-31",
      "issuingCountryISO2": "US"
    }
  ],
  "bankAccountList": []
}
```

**Response:**
```json
{
  "code": "0000",
  "message": "success",
  "data": {
    "customerId": "...",
    "cvRecordId": "...",
    "tier": "3",
    "wallet": {
      "operate": "update",
      "address": "0x...",
      "chain": "monad",
      "txHash": "0x...",
      "depositUSDCWallet": "...",
      "depositUSDTWallet": "..."
    }
  }
}
```

### POST /update_status — Freeze/Unfreeze A-Pass (CVI Revocation)
**Encrypted Request Body:**
```json
{
  "customerId": "string (optional)",
  "cvRecordId": "string (optional)",
  "status": "1",  // "1" = Activate, "2" = Freeze
  "blacklistReason": "string (optional)",
  "wallet": {
    "chain": "monad",
    "address": "0x..."
  }
}
```

### POST /query_apass — Query A-Pass Status
**Plain JSON:**
```json
{
  "chain": "monad",
  "address": "0x..."
}
```
**Response:**
```json
{
  "code": "0000",
  "data": {
    "cvRecordId": "2",
    "subTier": 1,
    "status": 1,  // 1=Active, 2=Frozen
    "tier": "26",
    "expirationTime": 1863690034,
    "subGroup": "zz",
    "currentKycHash": "0x...",
    "group": "aa",
    "countries": ["SG", "US"]
  }
}
```

### POST /query_apass_list — List A-Pass Records
**Plain JSON, paginated** — fields: customerId, chain, walletAddress, status, page, pageSize, createdFrom, createdTo

### POST /verify_apass — Verify A-Pass for A-Token
**Plain JSON:**
```json
{
  "chain": "monad",
  "atoken": "0x...",
  "address": "0x..."
}
```
**Response data.code:** 1=AToken not found, 2=No APass, 3=APass frozen/expired, 4=Success

---

## A-TOKEN MANAGEMENT (CVA — Cleanverse Verified Assets)

### POST /atoken/launch — Launch New A-Token (CVA)
**Encrypted Request Body:**
```json
{
  "chain": "monad",
  "token_name": "ConsentFlow Receipt",
  "token_symbol": "CFREC001",
  "decimals": 6,
  "admin_address": "0x...",
  "rule": {
    "allowed_group": "",
    "allowed_sub_group": "",
    "min_tier": 0,
    "min_sub_tier": 0,
    "is_black_list": false,
    "countries": []
  },
  "icon": "https://..."
}
```
Returns `requestId` → poll `GET /atoken/query_apply_status/{requestId}` until `ISSUED`

### POST /atoken/add_rule — Add Compliance Rule
**Encrypted:**
```json
{
  "chain": "monad",
  "atoken_address": "0x...",
  "rule": {
    "min_tier": 30,
    "countries": ["US"],
    "is_black_list": false
  }
}
```

### POST /atoken/rules — Query Rules (Plain JSON)
### POST /atoken/set_paused — Pause/Unpause A-Token (Encrypted)
### POST /atoken/is_paused — Check Pause State (Plain JSON)
### GET /atoken/query_apply_status/{requestId} — Poll Issuance Status
### GET /atoken/list_my_atokens — List My A-Tokens (Encrypted)

---

## VALIDATOR COMPLIANCE (CCP — Pre-transaction Checks)

### POST /validator/verify — Verify User Compliance
**Plain JSON:**
```json
{
  "chain": "monad",
  "contract_address": "0x... (registered pool address)",
  "user_address": "0x..."
}
```
**Response:**
```json
{
  "code": "0000",
  "message": "success",
  "data": {
    "chain": "monad",
    "contract_address": "0x...",
    "user_address": "0x...",
    "valid": true  // true=eligible, false=not eligible
  }
}
```
**KEY**: HTTP 200 + code 0000 + valid=true/false. valid=false means user fails compliance rules (frozen CVI, insufficient tier, wrong country, etc.)

### POST /validator/register — Register Compliance Pool (Encrypted + owner_signature)
### POST /validator/grant — Grant Registrar Role (Encrypted + owner_signature)
### POST /validator/is_register — Check Pool Registration (Plain JSON)
### POST /validator/rules — Query Pool Rules (Plain JSON)
### POST /validator/set_rule — Set Pool Rules (Encrypted)
### POST /validator/add_rule — Add Pool Rule (Encrypted)
### POST /validator/remove_rule — Remove Pool Rule (Encrypted)
### POST /validator/set_paused — Pause Pool (Encrypted)
### POST /validator/is_paused — Check Pool Pause (Plain JSON)

---

## COMMON QUERIES

### POST /query_deposit_atoken_list — List Supported A-Tokens
### POST /query_deposit_address — Get Deposit Addresses
### POST /query_txs — Query Transaction History
### POST /query_institution_white_list — Query Institution Whitelist

---

## Supported Chains
solana, base, avalanche, arbitrum, ethereum, polygon, bsc, monad, hashkey, platon

## Response Codes
- 0000 = Success
- 0001 = Parameter error
- 0002 = Business failure
- 12026 = Validator on-chain write failed
- 12027 = Validator on-chain read failed
- 12015 = Application not found
- 12029 = Whitelist address already exists

## Response Codes for verify_apass
- 1 = AToken not found
- 2 = User does not have APass
- 3 = APass exists but cannot transfer (expired/frozen)
- 4 = Success - valid APass and transfer allowed

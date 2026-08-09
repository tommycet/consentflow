# ConsentFlow API Reference

Complete REST API reference for the ConsentFlow Cleanverse adapter backend.

**Base URL:** `http://localhost:4000`  
**Response format:** `{ success: boolean, data?: any, error?: string }`

---

## Table of Contents
1. [Health](#health)
2. [CVI — Cleanverse Verified Identity (A-Pass)](#cvi)
3. [CVA — Cleanverse Verified Asset (A-Token)](#cva)
4. [CCP — Cleanverse Compliance Protocol](#ccp)
5. [Contract — On-Chain Interactions](#contract)
6. [Webhook — Event Subscriptions](#webhook)

---

## Health

### `GET /api/health`
Returns service status and configuration info.

**Response:**
```json
{
  "success": true,
  "data": {
    "service": "consentflow-cleanverse-adapter",
    "cleanverseConfigured": true,
    "baseUrl": "https://uatapi.cleanverse.com/api/cooperate",
    "chain": "monad-testnet"
  }
}
```

---

## CVI

Cleanverse Verified Identity — A-Pass NFT lifecycle management.

### `POST /api/cvi/generate`
Mint a new A-Pass identity for a wallet.

**Request:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "countries": ["US"],
  "tier": "50"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cvRecordId": 594,
    "status": 1,
    "contractAddress": "0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9"
  }
}
```

### `GET /api/cvi/query/:wallet`
Query A-Pass status for a wallet.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": 1,
    "tier": "50",
    "countries": ["US"],
    "cvRecordId": 594
  }
}
```

### `POST /api/cvi/update-status`
Freeze or unfreeze an A-Pass identity.

**Request:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "status": 2
}
```

| Status | Meaning |
|--------|---------|
| 1 | Active |
| 2 | Frozen |

---

## CVA

Cleanverse Verified Asset — A-Token compliance token management.

### `GET /api/cva/balance/:wallet`
Get aUSDC balance for a wallet.

### `POST /api/cva/transfer`
Transfer aUSDC between wallets.

**Request:**
```json
{
  "from": "0x...",
  "to": "0x...",
  "amount": "1000000"
}
```

### `POST /api/cva/approve`
Approve a spender for aUSDC.

### `GET /api/cva/verify-receipt/:receiptId`
Verify a contribution receipt against on-chain A-Token state.

---

## CCP

Cleanverse Compliance Protocol — verify_apass enforcement.

### `POST /api/ccp/verify`
Verify that an A-Pass identity passes compliance checks.

**Request:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
}
```

**Response (passing):**
```json
{
  "success": true,
  "data": {
    "compliant": true,
    "status": 1
  }
}
```

**Response (frozen A-Pass):**
```json
{
  "success": true,
  "data": {
    "compliant": false,
    "reason": "ComplianceFailed"
  }
}
```

---

## Contract

On-chain ConsentRegistry interactions via ethers v6.

### `POST /api/contract/create-consent`
Create a new consent record on-chain. Requires a signed transaction from the participant.

**Request:**
```json
{
  "cviAttestationHash": "0x1234...",
  "studyId": "0x1111...",
  "purposeHash": "0x2222...",
  "policyVersion": "0x3333...",
  "expiresAt": 1723593600
}
```

### `POST /api/contract/queue-request`
Queue an access request as a researcher. Includes ETH compensation.

**Request:**
```json
{
  "consentId": 1,
  "studyId": "0x1111...",
  "purposeHash": "0x2222...",
  "expiresAt": 1723593600,
  "compensation": "100000000000000"
}
```

### `POST /api/contract/settle-request`
Settle an access request after CCP verification.

**Request:**
```json
{
  "requestId": 1,
  "ccpPassed": true,
  "reasonCode": "0x0000000000000000000000000000000000000000000000000000000000000000"
}
```

### `POST /api/contract/batch-settle`
Settle multiple access requests in a single transaction (gas optimization).

**Request:**
```json
{
  "requestIds": [1, 2, 3],
  "ccpResults": [true, false, true],
  "reasonCodes": ["0x...", "0x...", "0x..."]
}
```

### `GET /api/contract/consent/:id`
Get consent details by ID.

### `GET /api/contract/request/:id`
Get access request details by ID.

### `GET /api/contract/consents/:address`
Get all consent IDs for a participant wallet.

### `GET /api/contract/events`
Query indexed on-chain events.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Event type: `ConsentCreated`, `ConsentRevoked`, `AccessRequested`, `AccessApproved`, `AccessRejected` |
| `participant` | address | Filter by participant/researcher address |
| `consentId` | uint256 | Filter by consent ID |

### `GET /api/contract/stats`
Get aggregate protocol statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalConsents": 3,
    "activeConsents": 2,
    "revokedConsents": 1,
    "expiredConsents": 0,
    "totalRequests": 5,
    "approvedRequests": 3,
    "rejectedRequests": 1,
    "pendingRequests": 1,
    "totalCompensation": "300000000000000",
    "byStudy": {
      "0x1111...": { "consents": 3, "requests": 5, "compensation": "300000000000000" }
    }
  }
}
```

---

## Webhook

Event subscription system for real-time notifications.

### `POST /api/webhook/subscribe`
Subscribe to webhook events.

**Request:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["ConsentCreated", "ConsentRevoked", "AccessApproved", "AccessRejected"]
}
```

### `GET /api/webhook/subscriptions`
List all active webhook subscriptions.

### `DELETE /api/webhook/subscribe/:id`
Remove a webhook subscription.

---

## Rate Limits

| Scope | Limit | Window |
|-------|-------|--------|
| All endpoints | 100 req | 15 min |
| Write endpoints | 10 req | 1 min |

Rate-limited responses return `429 Too Many Requests` with `{ success: false, error: "too many requests" }`.

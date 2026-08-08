# Cleanverse Sandbox API Integration Test Results
Date: Aug 8, 2026
API ID: APP20260614112550LIDZXM
Environment: Sandbox (https://uatapi.cleanverse.com/api/cooperate)

## Test Wallet
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0

## Verified Operations

### 1. Generate A-Pass (CVI Registration) ✅
- Endpoint: POST /generate_apass
- customerId: ConsentFlowTest001
- Response: code=0000, cvRecordId=594, tier=50
- txHash: 0x9728159cda447d22ee260412f1f9abb587720a2bab6e1b91b337c0e54124d824
- On-chain registration confirmed on Monad testnet

### 2. Query A-Pass (Active) ✅
- Endpoint: POST /query_apass
- Response: status=1 (Active), tier=50, countries=["US"], expirationTime=1863690034

### 3. Freeze A-Pass (Consent Withdrawal) ✅  
- Endpoint: POST /update_status (status=2)
- Response: txHash=0x8c1dc31d0b14f7b7990bd05cc33303118dfff119b0d2de5bd6a67b6c0f6618c0

### 4. Verify A-Pass (Frozen → CCP Rejection) ✅
- Endpoint: POST /verify_apass
- A-Token: 0xfa96de5b8f434c26fdff953303dd66ff80af1026 (aUSDC on Monad)
- Response: code=0002, message="Failed to validate atoken: failed to check apass: custom err name ComplianceFailed"
- **This proves CCP enforcement works — frozen CVI automatically blocks A-Token operations**

### 5. Unfreeze A-Pass (Reinstate Consent) ✅
- Endpoint: POST /update_status (status=1)
- txHash: 0xa09707496b98458acc0ea8ac0ffbcf4e87906e1eb2c63817f96fa2a85425dbb4

### 6. Query A-Pass (After Unfreeze) ✅
- Response: status=1 (Active), confirmed reactivation

## Monad Testnet Constants
- A-Pass NFT: 0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9
- AccessCore: 0x8F118338a1fa41E7Fa86Be19A4e8B99Ed58A6EcC
- aUSDC (A-Token): 0xfa96de5b8f434c26fdff953303dd66ff80af1026
- USDC (origin): 0x534b2f3A21130d7a60830c2Df862319e593943A3

## Key Insight
The Cleanverse `verify_apass` endpoint performs a real on-chain compliance check.
When CVI (A-Pass) is frozen, the A-Token compliance check automatically returns
ComplianceFailed. This is real CCP enforcement, not a UI boolean.

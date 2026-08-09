/**
 * CVA (A-Token / Cleanverse Verified Asset) routes.
 *
 *  POST /api/cva/rule                -> atoken/add_rule (AES)  bind purpose compliance rules
 *  GET  /api/cva/:wallet/rules       -> atoken/rules    (plain) list rules for an A-Token
 *  POST /api/cva/atoken              -> atoken/launch   (AES)  launch a new CVA receipt token
 *  GET  /api/cva/balance/:wallet     -> aUSDC balance via on-chain read
 *  POST /api/cva/transfer            -> transfer aUSDC (body: to, amount)
 *  POST /api/cva/approve             -> approve spender (body: spender, amount)
 *  GET  /api/cva/receipt/:id         -> get receipt details from ContributionReceipt
 *  GET  /api/cva/receipts/:participant -> get all receipts for a participant
 *  POST /api/cva/verify-receipt      -> verify a receipt is valid and unexpired
 */

const { Router } = require('express');
const { postEncrypted, postPlain } = require('../src/cleanverse');
const { config } = require('../src/config');
const { ok, fail, wrap, normalizeAddress } = require('../src/handlers');
const {
  getAtokenBalance,
  transferAtoken,
  approveAtoken,
  getAtokenAllowance,
  transferAtokenViaAccessCore,
} = require('../src/cva-token');
const { getContributionReceipt } = require('../src/ethers-provider');
const { writeLimiter } = require('../src/middleware');

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/cva/rule
// ---------------------------------------------------------------------------
router.post(
  '/rule',
  writeLimiter,
  wrap(async (req, res) => {
    const b = req.body || {};
    const atoken = b.atoken || config.defaultAtoken;
    if (!b.rule || typeof b.rule !== 'object') {
      return fail(res, 'body.rule is required (object with min_tier/countries/is_black_list)');
    }
    const payload = {
      chain: b.chain || config.chain,
      atoken_address: atoken,
      rule: b.rule,
    };
    const result = await postEncrypted('/atoken/add_rule', payload);
    if (result.code === '0000') {
      return ok(res, { ...result.data, atoken, rule: b.rule });
    }
    return fail(res, result.message || `add_rule failed (code ${result.code})`, 502);
  })
);

// ---------------------------------------------------------------------------
// GET /api/cva/:wallet/rules
// ---------------------------------------------------------------------------
router.get(
  '/:wallet/rules',
  wrap(async (req, res) => {
    const b = req.body || {};
    const atoken = b.atoken || config.defaultAtoken;
    const payload = { chain: config.chain, atoken_address: atoken };
    const result = await postPlain('/atoken/rules', payload);
    if (result.code === '0000') {
      return ok(res, { atoken, ...result.data });
    }
    return fail(res, result.message || `atoken/rules failed (code ${result.code})`, 502);
  })
);

// ---------------------------------------------------------------------------
// POST /api/cva/atoken — launch a new CVA receipt token (optional helper).
// ---------------------------------------------------------------------------
router.post(
  '/atoken',
  writeLimiter,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.token_name || !b.token_symbol) {
      return fail(res, 'token_name and token_symbol are required');
    }
    const payload = {
      chain: b.chain || config.chain,
      token_name: b.token_name,
      token_symbol: b.token_symbol,
      decimals: b.decimals ?? 6,
      admin_address: b.admin_address || '',
      rule: b.rule || { allowed_group: '', allowed_sub_group: '', min_tier: 0, min_sub_tier: 0, is_black_list: false, countries: [] },
      icon: b.icon || '',
    };
    const result = await postEncrypted('/atoken/launch', payload);
    if (result.code === '0000') {
      return ok(res, result.data);
    }
    return fail(res, result.message || `atoken/launch failed (code ${result.code})`, 502);
  })
);

// ---------------------------------------------------------------------------
// GET /api/cva/balance/:wallet
// Query aUSDC balance directly from the on-chain ERC20 contract.
// ---------------------------------------------------------------------------
router.get(
  '/balance/:wallet',
  wrap(async (req, res) => {
    const { valid, address, error } = normalizeAddress(req.params.wallet);
    if (!valid) return fail(res, error || 'invalid wallet address');
    try {
      const raw = await getAtokenBalance(address);
      return ok(res, { wallet: address, balance: raw, decimals: 6 });
    } catch (e) {
      return fail(res, `aUSDC balance query failed: ${e.message}`, 502);
    }
  })
);

// ---------------------------------------------------------------------------
// POST /api/cva/transfer
// Body: { to: "0x...", amount: "1000000", viaAccessCore?: boolean }
// Transfer aUSDC from the backend wallet.
// ---------------------------------------------------------------------------
router.post(
  '/transfer',
  writeLimiter,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.to) return fail(res, 'body.to is required');
    if (!b.amount && b.amount !== 0) return fail(res, 'body.amount is required');
    try {
      let tx;
      if (b.viaAccessCore) {
        tx = await transferAtokenViaAccessCore(b.to, String(b.amount));
      } else {
        tx = await transferAtoken(b.to, String(b.amount));
      }
      const receipt = await tx.wait();
      return ok(res, { txHash: receipt.hash, to: b.to, amount: String(b.amount) });
    } catch (e) {
      return fail(res, `aUSDC transfer failed: ${e.message}`, 502);
    }
  })
);

// ---------------------------------------------------------------------------
// POST /api/cva/approve
// Body: { spender: "0x...", amount: "1000000" }
// Approve a spender (typically AccessCore) to spend aUSDC.
// ---------------------------------------------------------------------------
router.post(
  '/approve',
  writeLimiter,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.spender) return fail(res, 'body.spender is required');
    if (!b.amount && b.amount !== 0) return fail(res, 'body.amount is required');
    try {
      const tx = await approveAtoken(b.spender, String(b.amount));
      const receipt = await tx.wait();
      return ok(res, { txHash: receipt.hash, spender: b.spender, amount: String(b.amount) });
    } catch (e) {
      return fail(res, `aUSDC approve failed: ${e.message}`, 502);
    }
  })
);

// ---------------------------------------------------------------------------
// GET /api/cva/receipt/:id
// Fetch a single ContributionReceipt by receiptId from on-chain contract.
// ---------------------------------------------------------------------------
router.get(
  '/receipt/:id',
  wrap(async (req, res) => {
    const receiptId = Number(req.params.id);
    if (!Number.isInteger(receiptId) || receiptId < 0) {
      return fail(res, 'invalid receipt id');
    }
    try {
      const receipt = getContributionReceipt();
      const data = await receipt.getReceipt(receiptId);
      return ok(res, {
        receiptId: Number(data.receiptId),
        consentId: Number(data.consentId),
        participant: data.participant,
        fixtureHash: data.fixtureHash,
        studyId: data.studyId,
        purposeHash: data.purposeHash,
        policyVersion: data.policyVersion,
        issuedAt: Number(data.issuedAt),
        expiresAt: Number(data.expiresAt),
        revokedAt: Number(data.revokedAt),
        status: Number(data.status),
      });
    } catch (e) {
      return fail(res, `receipt query failed: ${e.message}`, 502);
    }
  })
);

// ---------------------------------------------------------------------------
// GET /api/cva/receipts/:participant
// List all receipt IDs issued for a participant via the event indexer.
// ---------------------------------------------------------------------------
router.get(
  '/receipts/:participant',
  wrap(async (req, res) => {
    const { valid, address, error } = normalizeAddress(req.params.participant);
    if (!valid) return fail(res, error || 'invalid participant address');
    try {
      const receipt = getContributionReceipt();
      // ContributionReceipt has a counter _receiptIds we can use to enumerate.
      const totalRaw = await receipt._receiptIds();
      const total = Number(totalRaw);
      const receipts = [];
      for (let i = 1; i <= total; i++) {
        try {
          const r = await receipt.receipts(i);
          if (r.participant.toLowerCase() === address) {
            receipts.push({
              receiptId: Number(r.receiptId),
              consentId: Number(r.consentId),
              studyId: r.studyId,
              purposeHash: r.purposeHash,
              policyVersion: r.policyVersion,
              issuedAt: Number(r.issuedAt),
              expiresAt: Number(r.expiresAt),
              revokedAt: Number(r.revokedAt),
              status: Number(r.status),
            });
          }
        } catch {
          // Skip missing receipts (e.g. burned or out-of-range).
        }
      }
      return ok(res, { participant: address, receipts, total: receipts.length });
    } catch (e) {
      return fail(res, `receipts query failed: ${e.message}`, 502);
    }
  })
);

// ---------------------------------------------------------------------------
// POST /api/cva/verify-receipt
// Body: { receiptId: 1 }
// Verify a receipt is valid (not expired, not revoked) via on-chain isValid().
// ---------------------------------------------------------------------------
router.post(
  '/verify-receipt',
  wrap(async (req, res) => {
    const b = req.body || {};
    const receiptId = Number(b.receiptId);
    if (!Number.isInteger(receiptId) || receiptId < 0) {
      return fail(res, 'body.receiptId is required (positive integer)');
    }
    try {
      const receipt = getContributionReceipt();
      const valid = await receipt.isValid(receiptId);
      const status = await receipt.receiptStatus(receiptId);
      return ok(res, {
        receiptId,
        valid,
        status: Number(status),
      });
    } catch (e) {
      return fail(res, `verify-receipt failed: ${e.message}`, 502);
    }
  })
);

module.exports = router;

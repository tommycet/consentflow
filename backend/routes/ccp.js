/**
 * CCP (Compliance Pre-Check) routes — the real compliance gate.
 *
 *  POST /api/ccp/verify -> verify_apass (plain JSON)
 *
 * verify_apass response codes:
 *   1 = A-Token not found, 2 = user has no A-Pass,
 *   3 = A-Pass frozen/expired (ComplianceFailed), 4 = success, transfer allowed.
 */
const { Router } = require('express');
const { postPlain } = require('../src/cleanverse');
const { config } = require('../src/config');
const { ok, fail, normalizeAddress, wrap } = require('../src/handlers');

const router = Router();

const CODE_TO_MEANING = {
  1: 'ATOKEN_NOT_FOUND',
  2: 'NO_APASS',
  3: 'COMPLIANCE_FAILED', // A-Pass frozen/expired -> CCP blocks the operation
  4: 'PASS',
};

/**
 * POST /api/ccp/verify
 * Body: { wallet: "0x...", atoken?: "0x..." }
 * Returns { code, meaning, allowed, raw } — allowed=true only when code === 4.
 */
router.post(
  '/verify',
  wrap(async (req, res) => {
    const b = req.body || {};
    const { valid, address, error } = normalizeAddress(b.wallet || b.address);
    if (!valid) return fail(res, error || 'body.wallet is required');

    const atoken = b.atoken || config.defaultAtoken;
    const payload = { chain: b.chain || config.chain, atoken, address };

    const result = await postPlain('/verify_apass', payload);

    // Cleanverse returns code 0000 envelope with the verify result in data.code.
    if (result.code === '0000' && result.data) {
      const vcode = result.data.code ?? result.data.status;
      const meaning = CODE_TO_MEANING[vcode] || `UNKNOWN(${vcode})`;
      return ok(res, {
        code: vcode,
        meaning,
        allowed: vcode === 4,
        complianceCheck: 'verify_apass',
        atoken,
        wallet: address,
        raw: result.data,
      });
    }
    // Business-failure envelope (e.g. code 0002 with ComplianceFailed message)
    // still carries the CCP decision — surface it, don't drop it.
    if (result.code === '0002' || result.message) {
      const failed = /compliancefailed|frozen|expired/i.test(result.message || '');
      return ok(res, {
        code: result.code,
        meaning: failed ? 'COMPLIANCE_FAILED' : 'BUSINESS_FAILURE',
        allowed: false,
        complianceCheck: 'verify_apass',
        atoken,
        wallet: address,
        raw: result,
      });
    }
    return fail(res, result.message || `verify_apass failed (code ${result.code})`, 502);
  })
);

module.exports = router;

/**
 * CVA (A-Token / Cleanverse Verified Asset) routes.
 *
 *  POST /api/cva/rule            -> atoken/add_rule (AES)  bind purpose compliance rules
 *  GET  /api/cva/:wallet/rules   -> atoken/rules    (plain) list rules for an A-Token
 *  POST /api/cva/atoken          -> atoken/launch   (AES)  launch a new CVA receipt token
 */
const { Router } = require('express');
const { postEncrypted, postPlain } = require('../src/cleanverse');
const { config } = require('../src/config');
const { ok, fail, wrap } = require('../src/handlers');

const router = Router();

/**
 * POST /api/cva/rule
 * Body:
 *   { atoken?: string (default aUSDC), rule: { min_tier?, countries?, is_black_list? } }
 * Purpose-bound compliance rule for a CVA.
 */
router.post(
  '/rule',
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

/**
 * GET /api/cva/:wallet/rules
 * Queries the compliance rules bound to the wallet's CVA (A-Token).
 * The :wallet param is used to select the token; body optional:
 *   { atoken?: string } overrides the default A-Token address.
 */
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

/**
 * POST /api/cva/atoken — launch a new CVA receipt token (optional helper).
 * Body: { token_name, token_symbol, decimals?, admin_address?, rule?, icon? }
 */
router.post(
  '/atoken',
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

module.exports = router;

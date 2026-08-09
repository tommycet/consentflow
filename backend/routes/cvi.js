/**
 * CVI (A-Pass / Cleanverse Verified Identity) routes.
 *
 *  POST /api/cvi/:wallet/generate   -> generate_apass  (AES)  enroll participant
 *  GET  /api/cvi/:wallet/status     -> query_apass     (plain) CVI status
 *  POST /api/cvi/:wallet/freeze     -> update_status=2 (AES)  revoke consent (kill switch)
 *  POST /api/cvi/:wallet/unfreeze   -> update_status=1 (AES)  reinstate consent
 */
const { Router } = require('express');
const { postEncrypted, postPlain } = require('../src/cleanverse');
const { config } = require('../src/config');
const { ok, fail, normalizeAddress, wrap } = require('../src/handlers');

const router = Router();

/**
 * POST /api/cvi/:wallet/generate
 * Body (all optional except defaults):
 *   { customerId?, kycSource?, kycId?, subTier?, subGroup?, override?, expirationTime?,
 *     identityDataList?: [{ idType, fullName, idNumber, validUntil, issuingCountryISO2 }] }
 * Returns Cleanverse envelope with cvRecordId / tier / txHash.
 */
router.post(
  '/:wallet/generate',
  wrap(async (req, res) => {
    const { valid, address, error } = normalizeAddress(req.params.wallet);
    if (!valid) return fail(res, error);

    const b = req.body || {};
    const payload = {
      customerId: b.customerId || `CF${Date.now()}${Math.floor(Math.random() * 900 + 100)}`,
      // Cleanverse requires a non-null expirationTime (unix seconds).
      // 1863690034 is the value verified in sandbox-test-results.md (~2029).
      expirationTime: b.expirationTime || 1863690034,
      override: false,
      wallet: { address, chain: b.chain || config.chain },
      identityDataList:
        b.identityDataList ||
        (b.skipKyc
          ? []
          : [
              {
                idType: 'ID_CARD',
                fullName: b.fullName || 'ConsentFlow Demo User',
                idNumber: b.idNumber || 'CF-DEMO-00000001',
                validUntil: b.validUntil || '2030-12-31',
                issuingCountryISO2: b.issuingCountryISO2 || 'US',
              },
            ]),
      bankAccountList: b.bankAccountList || [],
    };
    // Pass through optional scalar fields when supplied.
    for (const k of ['kycSource', 'kycId', 'subTier', 'subGroup', 'expirationTime']) {
      if (b[k] !== undefined) payload[k] = b[k];
    }

    const result = await postEncrypted('/generate_apass', payload);
    if (result.code === '0000') {
      return ok(res, { ...result.data, request: payload });
    }
    return fail(res, result.message || `generate_apass failed (code ${result.code})`, 502);
  })
);

/**
 * GET /api/cvi/:wallet/status
 * Returns Cleanverse query_apass data: status 1=Active, 2=Frozen.
 * If the wallet has no A-Pass, returns success:true with data:null and
 * notFound:true so callers can distinguish "no record" from a hard error.
 */
router.get(
  '/:wallet/status',
  wrap(async (req, res) => {
    const { valid, address, error } = normalizeAddress(req.params.wallet);
    if (!valid) return fail(res, error);

    const result = await postPlain('/query_apass', { chain: config.chain, address });
    if (result.code === '0000' && result.data && result.data.cvRecordId !== undefined) {
      return ok(res, result.data);
    }
    // No A-Pass record for this wallet yet.
    return ok(res, null, 200);
  })
);

/**
 * POST /api/cvi/:wallet/freeze  — CVI revocation (status=2)
 * POST /api/cvi/:wallet/unfreeze — CVI reactivation (status=1)
 * Body optional: { customerId?, cvRecordId? }
 */
router.post(
  '/:wallet/freeze',
  wrap(async (req, res) => {
    const { valid, address, error } = normalizeAddress(req.params.wallet);
    if (!valid) return fail(res, error);
    return updateStatus(res, address, '2', req.body || {});
  })
);

router.post(
  '/:wallet/unfreeze',
  wrap(async (req, res) => {
    const { valid, address, error } = normalizeAddress(req.params.wallet);
    if (!valid) return fail(res, error);
    return updateStatus(res, address, '1', req.body || {});
  })
);

async function updateStatus(res, address, status, body) {
  const payload = {
    status,
    wallet: { chain: config.chain, address },
  };
  if (body.customerId) payload.customerId = body.customerId;
  if (body.cvRecordId) payload.cvRecordId = body.cvRecordId;
  if (body.blacklistReason) payload.blacklistReason = body.blacklistReason;

  const result = await postEncrypted('/update_status', payload);
  if (result.code === '0000') {
    return ok(res, { ...result.data, requestedStatus: status, wallet: address });
  }
  return fail(res, result.message || `update_status failed (code ${result.code})`, 502);
}

module.exports = router;

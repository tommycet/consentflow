/**
 * On-chain ConsentRegistry + ContributionReceipt routes.
 *
 *  POST /api/contract/create-consent  -> createConsent (issues receipt + creates consent)
 *  POST /api/contract/queue-request   -> queueAccessRequest
 *  POST /api/contract/settle-request  -> verify_apass FIRST, then settleAccessRequest
 *  GET  /api/contract/consent/:id     -> getConsent
 *  GET  /api/contract/request/:id     -> getAccessRequest
 */

const { Router } = require('express');
const { postPlain } = require('../src/cleanverse');
const { config } = require('../src/config');
const { ok, fail, normalizeAddress, wrap } = require('../src/handlers');
const { getConsentRegistry, getContributionReceipt } = require('../src/ethers-provider');
const { getEvents } = require('../src/event-indexer');
const { writeLimiter } = require('../src/middleware');
const {
  validateAddress,
  validateBytes32,
  validateTimestamp,
  validateConsentId,
} = require('../src/validate');

const router = Router();

// ---------------------------------------------------------------------------
// POST /create-consent
// Body:
//   {
//     participant: "0x...",
//     cviAttestationHash: "0x...",
//     studyId: "0x...",
//     purposeHash: "0x...",
//     policyVersion: "0x...",
//     expiresAt: 1234567890,          // unix seconds (uint64)
//     receiptData?: "0x..."           // optional bytes payload forwarded to createConsent
//   }
// Steps: issue receipt on ContributionReceipt, then createConsent on ConsentRegistry.
// ---------------------------------------------------------------------------
router.post(
  '/create-consent',
  writeLimiter,
  wrap(async (req, res) => {
    const b = req.body || {};
    const { valid, address, error } = validateAddress(b.participant);
    if (!valid) return fail(res, error || 'body.participant is required');

    const cvi = validateBytes32(b.cviAttestationHash);
    if (!cvi.valid) return fail(res, cvi.error);

    const study = validateBytes32(b.studyId);
    if (!study.valid) return fail(res, study.error);

    const purpose = validateBytes32(b.purposeHash);
    if (!purpose.valid) return fail(res, purpose.error);

    const policy = validateBytes32(b.policyVersion);
    if (!policy.valid) return fail(res, policy.error);

    const ts = validateTimestamp(b.expiresAt, true);
    if (!ts.valid) return fail(res, ts.error);

    const receipt = getContributionReceipt();
    const registry = getConsentRegistry();

    // 1. Issue a ContributionReceipt.
    // fixtureHash is currently passed as an optional body field; default to zero hash.
    const fixtureHash = b.fixtureHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
    const receiptTx = await receipt.issue(
      address,
      0, // consentId placeholder — the contract may map it; pass 0 if unused
      fixtureHash,
      study.value,
      purpose.value,
      policy.value,
      BigInt(ts.value)
    );
    const receiptReceipt = await receiptTx.wait();
    // The issue() event ReceiptIssued(receiptId, cviRecordId, owner, ...) gives us receiptId.
    const receiptId = receiptReceipt.logs
      .filter((l) => l.fragment && l.fragment.name === 'ReceiptIssued')
      .map((l) => Number(l.args[0]))[0];

    // 2. Create the consent, forwarding the optional receiptData.
    const createTx = await registry.createConsent(
      cvi.value,
      study.value,
      purpose.value,
      policy.value,
      BigInt(ts.value),
      b.receiptData || '0x'
    );
    const createReceipt = await createTx.wait();
    const consentId = createReceipt.logs
      .filter((l) => l.fragment && l.fragment.name === 'ConsentCreated')
      .map((l) => Number(l.args[0]))[0];

    recordAudit('on-chain', 'ConsentCreated', {
      consentId: consentId ?? null,
      receiptId: receiptId ?? null,
      participant: address,
      txHash: createReceipt.hash,
    });

    return ok(res, {
      consentId: consentId ?? null,
      receiptId: receiptId ?? null,
      participant: address,
      txHash: createReceipt.hash,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /queue-request
// Body:
//   {
//     consentId: 1,
//     researcher: "0x...",
//     studyId: "0x...",
//     purposeHash: "0x...",
//     expiresAt: 1234567890
//   }
// ---------------------------------------------------------------------------
router.post(
  '/queue-request',
  writeLimiter,
  wrap(async (req, res) => {
    const b = req.body || {};
    const cid = validateConsentId(b.consentId);
    if (!cid.valid) return fail(res, cid.error);

    const study = validateBytes32(b.studyId);
    if (!study.valid) return fail(res, study.error);

    const purpose = validateBytes32(b.purposeHash);
    if (!purpose.valid) return fail(res, purpose.error);

    const ts = validateTimestamp(b.expiresAt, true);
    if (!ts.valid) return fail(res, ts.error);

    const { valid: rValid, address: researcher, error: rError } = validateAddress(b.researcher);
    if (!rValid) return fail(res, rError || 'body.researcher is required');

    const registry = getConsentRegistry();

    // queueAccessRequest is payable; pass 0 value unless overridden.
    const value = b.value || '0';
    const tx = await registry.queueAccessRequest(
      BigInt(cid.value),
      study.value,
      purpose.value,
      BigInt(ts.value),
      { value }
    );
    const receipt = await tx.wait();
    const requestId = receipt.logs
      .filter((l) => l.fragment && l.fragment.name === 'AccessRequested')
      .map((l) => Number(l.args[0]))[0];

    recordAudit('on-chain', 'AccessRequested', {
      requestId: requestId ?? null,
      consentId: cid.value,
      researcher,
      txHash: receipt.hash,
    });

    return ok(res, {
      requestId: requestId ?? null,
      consentId: cid.value,
      researcher,
      txHash: receipt.hash,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /settle-request
// Body:
//   {
//     requestId: 1,
//     wallet: "0x..."               // wallet to run verify_apass against
//     atoken?: "0x...",
//     reasonCode?: "0x..."          // optional bytes32 reason for rejection context
//   }
// Flow:
//   1. Call Cleanverse /verify_apass (plain JSON).
//   2. allowed = (result.data.code === 4)  — only true when CCP says PASS.
//   3. Call settleAccessRequest(requestId, allowed, reasonCode).
// ---------------------------------------------------------------------------
router.post(
  '/settle-request',
  writeLimiter,
  wrap(async (req, res) => {
    const b = req.body || {};
    const rid = validateConsentId(b.requestId);
    if (!rid.valid) return fail(res, rid.error);

    if (!b.wallet) return fail(res, 'body.wallet is required');

    // Step 1 — Cleanverse CCP check FIRST.
    const { valid, address, error } = validateAddress(b.wallet);
    if (!valid) return fail(res, error || 'invalid body.wallet');

    const atoken = b.atoken || config.defaultAtoken;
    const payload = { chain: config.chain, atoken, address };

    const result = await postPlain('/verify_apass', payload);

    // Normalize CCP outcome: allowed=true only when Cleanverse returns code 4.
    let ccpPassed = false;
    if (result.code === '0000' && result.data) {
      const vcode = result.data.code ?? result.data.status;
      ccpPassed = vcode === 4;
    }

    // Step 2 — settle on-chain with the CCP result.
    const registry = getConsentRegistry();
    const reasonCode = b.reasonCode || '0x0000000000000000000000000000000000000000000000000000000000000000';

    const tx = await registry.settleAccessRequest(
      BigInt(rid.value),
      ccpPassed,
      reasonCode
    );
    const receipt = await tx.wait();

    // Webhook + audit: notify subscribers if CCP failed.
    if (!ccpPassed && req.webhook && req.webhook.emit) {
      req.webhook.emit('CCP_RESULT', {
        requestId: rid.value,
        wallet: address,
        atoken,
        allowed: false,
        meaning: 'COMPLIANCE_FAILED',
        txHash: receipt.hash,
      }).catch(() => {});
    }

    const { recordAudit } = require('../src/audit-trail');
    recordAudit('on-chain', 'AccessSettled', {
      requestId: rid.value,
      ccpPassed,
      txHash: receipt.hash,
      wallet: address,
    });

    // Step 3 (optional) — pay compensation in aUSDC instead of raw ETH.
    let atokenCompensation = null;
    if (b.compensateInAtoken && ccpPassed) {
      try {
        const { transferAtoken } = require('../src/cva-token');
        const compensationAmount = b.atokenCompensationAmount;
        if (!compensationAmount) {
          return fail(res, 'body.atokenCompensationAmount is required when compensateInAtoken is true');
        }
        const compTx = await transferAtoken(address, String(compensationAmount));
        const compReceipt = await compTx.wait();
        atokenCompensation = {
          txHash: compReceipt.hash,
          amount: String(compensationAmount),
          token: process.env.ATOKEN_ADDRESS || config.defaultAtoken,
        };
      } catch (e) {
        return fail(res, `aUSDC compensation transfer failed: ${e.message}`, 502);
      }
    }

    return ok(res, {
      requestId: rid.value,
      ccpPassed,
      txHash: receipt.hash,
      cleanverseRaw: result,
      atokenCompensation,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /consent/:id
// ---------------------------------------------------------------------------
router.get(
  '/consent/:id',
  wrap(async (req, res) => {
    const cid = validateConsentId(req.params.id);
    if (!cid.valid) return fail(res, cid.error);
    const id = BigInt(cid.value);
    const registry = getConsentRegistry();
    const consent = await registry.getConsent(id);
    return ok(res, {
      consentId: Number(consent[0]),
      participant: consent[1],
      cviAttestationHash: consent[2],
      receiptId: Number(consent[3]),
      studyId: consent[4],
      purposeHash: consent[5],
      policyVersion: consent[6],
      createdAt: Number(consent[7]),
      expiresAt: Number(consent[8]),
      revokedAt: Number(consent[9]),
      status: Number(consent[10]),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /request/:id
// ---------------------------------------------------------------------------
router.get(
  '/request/:id',
  wrap(async (req, res) => {
    const rid = validateConsentId(req.params.id);
    if (!rid.valid) return fail(res, rid.error);
    const id = BigInt(rid.value);
    const registry = getConsentRegistry();
    const reqData = await registry.getAccessRequest(id);
    return ok(res, {
      requestId: Number(reqData[0]),
      consentId: Number(reqData[1]),
      receiptId: Number(reqData[2]),
      researcher: reqData[3],
      studyId: reqData[4],
      purposeHash: reqData[5],
      queuedAt: Number(reqData[6]),
      expiresAt: Number(reqData[7]),
      compensation: reqData[8].toString(),
      status: Number(reqData[9]),
      rejectionCode: Number(reqData[10]),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /verify/:id
// Unified on-chain consent + Cleanverse CVI + receipt validation.
// ---------------------------------------------------------------------------
router.get(
  '/verify/:id',
  wrap(async (req, res) => {
    const cid = validateConsentId(req.params.id);
    if (!cid.valid) return fail(res, cid.error);

    const id = BigInt(cid.value);
    const registry = getConsentRegistry();
    const receiptContract = getContributionReceipt();
    const atoken = config.defaultAtoken;

    // 1. Read consent from on-chain.
    let consent;
    try {
      consent = await registry.getConsent(id);
    } catch (e) {
      return fail(res, `Failed to read consent ${cid.value}: ${e.message}`, 503);
    }

    const consentId = Number(consent[0]);
    const participant = consent[1];
    const studyId = consent[4];
    const purposeHash = consent[5];
    const receiptId = Number(consent[3]);

    // 2. Check consent existence.
    if (consentId === 0) {
      return fail(res, `Consent ${cid.value} not found`, 404);
    }

    // 3. Get dynamic consent status (handles expiry automatically).
    let consentStatus = 'ACTIVE';
    try {
      const dynamicStatus = await registry.consentStatus(id);
      const statusNum = Number(dynamicStatus);
      if (statusNum === 2) consentStatus = 'REVOKED';
      else if (statusNum === 3) consentStatus = 'EXPIRED';
      else if (statusNum === 0) consentStatus = 'NONE';
    } catch (e) {
      // Fallback to raw struct status if consentStatus reverts.
      const rawStatus = Number(consent[10]);
      if (rawStatus === 2) consentStatus = 'REVOKED';
      else if (rawStatus === 3) consentStatus = 'EXPIRED';
      else if (rawStatus === 0) consentStatus = 'NONE';
    }

    if (consentStatus === 'NONE') {
      return fail(res, `Consent ${cid.value} not found`, 404);
    }

    // 4. Check ContributionReceipt validity.
    let receiptValid = false;
    try {
      receiptValid = await receiptContract.isValid(BigInt(receiptId));
    } catch (e) {
      receiptValid = false;
    }

    // 5. Call Cleanverse verify_apass for CVI compliance.
    let cviCompliant = false;
    let aPassStatus = null;
    try {
      const verifyResult = await postPlain('/verify_apass', {
        chain: config.chain,
        atoken,
        address: participant,
      });
      if (verifyResult.code === '0000' && verifyResult.data) {
        const vcode = verifyResult.data.code ?? verifyResult.data.status;
        cviCompliant = vcode === 4;
        aPassStatus = vcode;
      }
    } catch (e) {
      cviCompliant = false;
    }

    // 6. Call Cleanverse query_apass for A-Pass details.
    let tier = null;
    let countries = [];
    try {
      const queryResult = await postPlain('/query_apass', {
        chain: config.chain,
        address: participant,
      });
      if (queryResult.code === '0000' && queryResult.data) {
        tier = queryResult.data.tier || null;
        countries = Array.isArray(queryResult.data.countries) ? queryResult.data.countries : [];
        // Infer from query if verify wasn't conclusive.
        if (aPassStatus === null && queryResult.data.status !== undefined) {
          aPassStatus = queryResult.data.status;
          cviCompliant = queryResult.data.status === 1;
        }
      }
    } catch (e) {
      // Cleanverse API down — leave defaults.
    }

    // 7. Determine overall verdict.
    let overallVerdict = 'VERIFIED';
    if (consentStatus === 'REVOKED') {
      overallVerdict = 'CONSENT_REVOKED';
    } else if (consentStatus === 'EXPIRED') {
      overallVerdict = 'CONSENT_EXPIRED';
    } else if (!receiptValid) {
      overallVerdict = 'RECEIPT_INVALID';
    } else if (!cviCompliant) {
      overallVerdict = 'CVI_FAILED';
    }

    return ok(res, {
      consentId,
      participant,
      studyId,
      purposeHash,
      consentStatus,
      receiptValid,
      cviStatus: {
        compliant: cviCompliant,
        aPassStatus,
        tier,
        countries,
      },
      overallVerdict,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /events
// Query params: ?type=ConsentCreated&participant=0x...&consentId=1
// ---------------------------------------------------------------------------
router.get(
  '/events',
  wrap(async (req, res) => {
    const filters = {};
    if (req.query.type) filters.type = String(req.query.type);
    if (req.query.participant) filters.participant = String(req.query.participant);
    if (req.query.consentId) filters.consentId = Number(req.query.consentId);

    const events = getEvents(filters);
    return ok(res, { total: events.length, events });
  })
);

// ---------------------------------------------------------------------------
// GET /consents/:participant — get all consent IDs for a participant
// ---------------------------------------------------------------------------
router.get(
  '/consents/:address',
  wrap(async (req, res) => {
    const { valid, address, error } = normalizeAddress(req.params.address);
    if (!valid) return fail(res, error || 'invalid address');

    try {
      const registry = getConsentRegistry();
      const ids = await registry.getConsentsByParticipant(address);
      return ok(res, {
        participant: address,
        consentIds: ids.map((id) => Number(id)),
        total: ids.length,
      });
    } catch (e) {
      // If contract not deployed, fall back to event-indexed data
      const events = getEvents({ participant: address, type: 'ConsentCreated' });
      return ok(res, {
        participant: address,
        consentIds: events.map((e) => Number(e.args.consentId)),
        total: events.length,
        source: 'events',
      });
    }
  })
);

// ---------------------------------------------------------------------------
// GET /stats — aggregate protocol statistics
// ---------------------------------------------------------------------------
router.get(
  '/stats',
  wrap(async (req, res) => {
    const events = getEvents();
    const stats = {
      totalConsents: 0,
      activeConsents: 0,
      revokedConsents: 0,
      totalRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      totalCompensationVolume: '0',
    };

    let compensationWei = 0n;

    for (const evt of events) {
      const a = evt.args;
      switch (evt.type) {
        case 'ConsentCreated':
          stats.totalConsents++;
          stats.activeConsents++;
          break;
        case 'ConsentRevoked':
          stats.totalConsents++;
          stats.revokedConsents++;
          stats.activeConsents = Math.max(0, stats.activeConsents - 1);
          break;
        case 'AccessRequested':
          stats.totalRequests++;
          try { compensationWei += BigInt(a.compensation || '0'); } catch {}
          break;
        case 'AccessApproved':
          stats.approvedRequests++;
          break;
        case 'AccessRejected':
          stats.rejectedRequests++;
          break;
        default:
          break;
      }
    }

    stats.totalCompensationVolume = compensationWei.toString();
    return ok(res, stats);
  })
);

// ── Policy Engine endpoint ───────────────────────────────────
// GET /policy/run/:requestId?wallet=0x...
// Runs all policy checks (CVI + CVA + receipt + consent status) and returns results.
router.get('/policy/run/:requestId', async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    const wallet = req.query.wallet;

    if (!requestId || !wallet) {
      return res.status(400).json({
        success: false,
        error: 'requestId (path) and wallet (query) are required',
      });
    }

    const { runPolicyChecks } = require('../src/policy-engine');
    const result = await runPolicyChecks(requestId, wallet);

    return res.json({
      success: true,
      data: {
        requestId,
        wallet,
        overall: result.overall,
        reasonCode: result.reasonCode,
        checks: result.checks,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[policy] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Policy engine error: ' + err.message,
    });
  }
});

module.exports = router;

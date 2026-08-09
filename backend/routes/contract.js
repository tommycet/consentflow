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
      b.studyId,
      b.purposeHash,
      b.policyVersion,
      BigInt(Math.floor(Number(b.expiresAt) || 0))
    );
    const receiptReceipt = await receiptTx.wait();
    // The issue() event ReceiptIssued(receiptId, cviRecordId, owner, ...) gives us receiptId.
    const receiptId = receiptReceipt.logs
      .filter((l) => l.fragment && l.fragment.name === 'ReceiptIssued')
      .map((l) => Number(l.args[0]))[0];

    // 2. Create the consent, forwarding the optional receiptData.
    const createTx = await registry.createConsent(
      b.cviAttestationHash,
      b.studyId,
      b.purposeHash,
      b.policyVersion,
      BigInt(Math.floor(Number(b.expiresAt) || 0)),
      b.receiptData || '0x'
    );
    const createReceipt = await createTx.wait();
    const consentId = createReceipt.logs
      .filter((l) => l.fragment && l.fragment.name === 'ConsentCreated')
      .map((l) => Number(l.args[0]))[0];

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

    return ok(res, {
      requestId: requestId ?? null,
      consentId: Number(b.consentId),
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

    return ok(res, {
      requestId: Number(b.requestId),
      ccpPassed,
      txHash: receipt.hash,
      cleanverseRaw: result,
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
      expiredConsents: 0,
      totalRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      pendingRequests: 0,
      totalCompensation: '0',
      byStudy: {},
    };

    for (const evt of events) {
      switch (evt.type) {
        case 'ConsentCreated':
          stats.totalConsents++;
          stats.activeConsents++;
          break;
        case 'ConsentRevoked':
          stats.activeConsents--;
          stats.revokedConsents++;
          break;
        case 'ConsentExpired':
          stats.activeConsents--;
          stats.expiredConsents++;
          break;
        case 'AccessRequested':
          stats.totalRequests++;
          stats.pendingRequests++;
          if (evt.args.compensation) {
            stats.totalCompensation = (
              BigInt(stats.totalCompensation) + BigInt(evt.args.compensation)
            ).toString();
          }
          const studyKey = evt.args.studyId || 'unknown';
          if (!stats.byStudy[studyKey]) {
            stats.byStudy[studyKey] = { consents: 0, requests: 0, compensation: '0' };
          }
          stats.byStudy[studyKey].requests++;
          break;
        case 'AccessApproved':
          stats.pendingRequests--;
          stats.approvedRequests++;
          break;
        case 'AccessRejected':
          stats.pendingRequests--;
          stats.rejectedRequests++;
          break;
      }
    }

    return ok(res, stats);
  })
);

module.exports = router;

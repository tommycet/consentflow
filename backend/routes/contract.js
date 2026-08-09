/**
 * On-chain contract integration routes.
 *
 * Endpoints:
 *   POST /api/contract/create-consent   — ConsentRegistry.createConsent
 *   POST /api/contract/queue-request    — ConsentRegistry.queueAccessRequest (payable)
 *   POST /api/contract/settle-request   — Cleanverse verify_apass -> settleAccessRequest
 *   GET  /api/contract/consent/:id      — ConsentRegistry.getConsent
 *   GET  /api/contract/request/:id      — ConsentRegistry.getAccessRequest
 */

const { Router } = require('express');
const { ethers } = require('ethers');
const {
  consentRegistry,
  contributionReceipt,
} = require('../src/ethers-provider');
const { postPlain } = require('../src/cleanverse');
const { config } = require('../src/config');
const { ok, fail, normalizeAddress, wrap } = require('../src/handlers');

const router = Router();

/**
 * POST /api/contract/create-consent
 * Body: {
 *   cviAttestationHash: "0x...",
 *   studyId: "0x...",
 *   purposeHash: "0x...",
 *   policyVersion: "0x...",
 *   expiresAt: 1234567890,
 *   receiptData?: "0x..."
 * }
 *
 * Note: the contract internally ignores `receiptData` (it's part of the I* interface
 * but not used in the current implementation). We still pass it for forward compat.
 */
router.post('/create-consent', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.cviAttestationHash || !b.studyId || !b.purposeHash || !b.policyVersion || !b.expiresAt) {
    return fail(res, 'cviAttestationHash, studyId, purposeHash, policyVersion, and expiresAt are required');
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(b.cviAttestationHash)) return fail(res, 'cviAttestationHash must be 0x-prefixed 32-byte hex');
  if (!/^0x[0-9a-fA-F]{64}$/.test(b.studyId)) return fail(res, 'studyId must be 0x-prefixed 32-byte hex');
  if (!/^0x[0-9a-fA-F]{64}$/.test(b.purposeHash)) return fail(res, 'purposeHash must be 0x-prefixed 32-byte hex');
  if (!/^0x[0-9a-fA-F]{64}$/.test(b.policyVersion)) return fail(res, 'policyVersion must be 0x-prefixed 32-byte hex');
  if (typeof b.expiresAt !== 'number' || b.expiresAt <= Math.floor(Date.now() / 1000)) {
    return fail(res, 'expiresAt must be a future unix timestamp (seconds)');
  }

  const receiptData = b.receiptData || '0x';

  const tx = await consentRegistry.createConsent(
    b.cviAttestationHash,
    b.studyId,
    b.purposeHash,
    b.policyVersion,
    BigInt(b.expiresAt),
    receiptData
  );

  const receipt = await tx.wait();
  // Parse ConsentCreated event to surface consentId + receiptId.
  const event = receipt.logs
    .map((l) => {
      try { return consentRegistry.interface.parseLog(l); } catch { return null; }
    })
    .find((e) => e && e.name === 'ConsentCreated');

  const consentId = event ? event.args.consentId.toString() : null;
  const onchainReceiptId = event ? event.args.receiptId.toString() : null;

  return ok(res, {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    consentId,
    receiptId: onchainReceiptId,
  });
}));

/**
 * POST /api/contract/queue-request
 * Body: {
 *   consentId: 1,
 *   studyId: "0x...",
 *   purposeHash: "0x...",
 *   expiresAt: 1234567890,
 *   compensation: "0.01"   // human-readable ETH/MON amount
 * }
 */
router.post('/queue-request', wrap(async (req, res) => {
  const b = req.body || {};
  if (b.consentId == null) return fail(res, 'consentId is required');
  if (!b.studyId || !/^0x[0-9a-fA-F]{64}$/.test(b.studyId)) return fail(res, 'studyId must be 0x-prefixed 32-byte hex');
  if (!b.purposeHash || !/^0x[0-9a-fA-F]{64}$/.test(b.purposeHash)) return fail(res, 'purposeHash must be 0x-prefixed 32-byte hex');
  if (!b.expiresAt || typeof b.expiresAt !== 'number') return fail(res, 'expiresAt (future unix seconds) is required');
  if (b.compensation == null) return fail(res, 'compensation (human-readable ETH/MON string) is required');

  const wei = ethers.parseUnits(String(b.compensation), 'ether');

  const tx = await consentRegistry.queueAccessRequest(
    BigInt(b.consentId),
    b.studyId,
    b.purposeHash,
    BigInt(b.expiresAt),
    { value: wei }
  );

  const receipt = await tx.wait();
  const event = receipt.logs
    .map((l) => {
      try { return consentRegistry.interface.parseLog(l); } catch { return null; }
    })
    .find((e) => e && e.name === 'AccessRequested');

  const requestId = event ? event.args.requestId.toString() : null;

  return ok(res, {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    requestId,
    compensationWei: wei.toString(),
  });
}));

/**
 * POST /api/contract/settle-request
 * Body: {
 *   requestId: 1,
 *   wallet: "0x...",          // participant wallet for Cleanverse CCP check
 *   atoken?: "0x...",         // optional A-Token override
 *   reasonCode?: "0x..."      // optional bytes32 reason (defaults to 0x0)
 * }
 *
 * Orchestrates: Cleanverse verify_apass -> on-chain settleAccessRequest.
 */
router.post('/settle-request', wrap(async (req, res) => {
  const b = req.body || {};
  if (b.requestId == null) return fail(res, 'requestId is required');
  if (!b.wallet) return fail(res, 'wallet is required for CCP check');

  const { valid, address, error } = normalizeAddress(b.wallet);
  if (!valid) return fail(res, error);

  // Step 1: Cleanverse CCP (verify_apass)
  const atoken = b.atoken || config.defaultAtoken;
  const ccpPayload = {
    chain: b.chain || config.chain,
    atoken,
    address,
  };

  const ccpResult = await postPlain('/verify_apass', ccpPayload);
  let ccpPassed = false;

  if (ccpResult.code === '0000' && ccpResult.data) {
    ccpPassed = (ccpResult.data.code ?? ccpResult.data.status) === 4;
  } else if (/compliancefailed|frozen|expired/i.test(ccpResult.message || '')) {
    ccpPassed = false;
  } else if (ccpResult.code === '0002') {
    ccpPassed = false;
  } else {
    // Treat unexpected API envelope as a 502 so the caller knows the gate failed.
    return fail(res, ccpResult.message || `verify_apass failed (code ${ccpResult.code})`, 502);
  }

  // Step 2: On-chain settle
  const reasonCode = b.reasonCode && /^0x[0-9a-fA-F]{64}$/.test(b.reasonCode)
    ? b.reasonCode
    : '0x0000000000000000000000000000000000000000000000000000000000000000';

  const tx = await consentRegistry.settleAccessRequest(
    BigInt(b.requestId),
    ccpPassed,
    reasonCode
  );

  const receipt = await tx.wait();

  return ok(res, {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    requestId: b.requestId,
    ccpPassed,
    ccpAtoken: atoken,
    ccpWallet: address,
    ccpRaw: ccpResult.data || ccpResult,
  });
}));

/**
 * GET /api/contract/consent/:id
 * Reads consent from chain.
 */
router.get('/consent/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, 'consent id must be a positive integer');

  const consent = await consentRegistry.getConsent(id);
  const statusNum = await consentRegistry.consentStatus(id);

  return ok(res, {
    consentId: consent.consentId.toString(),
    participant: consent.participant,
    cviAttestationHash: consent.cviAttestationHash,
    receiptId: consent.receiptId.toString(),
    studyId: consent.studyId,
    purposeHash: consent.purposeHash,
    policyVersion: consent.policyVersion,
    createdAt: Number(consent.createdAt),
    expiresAt: Number(consent.expiresAt),
    revokedAt: Number(consent.revokedAt),
    status: Number(statusNum), // 0=NONE, 1=ACTIVE, 2=REVOKED
  });
}));

/**
 * GET /api/contract/request/:id
 * Reads access request from chain.
 */
router.get('/request/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, 'request id must be a positive integer');

  const req_ = await consentRegistry.getAccessRequest(id);

  return ok(res, {
    requestId: req_.requestId.toString(),
    consentId: req_.consentId.toString(),
    receiptId: req_.receiptId.toString(),
    researcher: req_.researcher,
    studyId: req_.studyId,
    purposeHash: req_.purposeHash,
    queuedAt: Number(req_.queuedAt),
    expiresAt: Number(req_.expiresAt),
    compensationWei: req_.compensation.toString(),
    status: Number(req_.status), // 0=PENDING, 1=APPROVED, 2=REJECTED
    rejectionCode: Number(req_.rejectionCode),
  });
}));

module.exports = router;

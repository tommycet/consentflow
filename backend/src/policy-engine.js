/**
 * ConsentFlow Multi-Step Policy Engine
 *
 * Runs SEPARATE compliance checks before settling an access request:
 *   1. CCP check     — Cleanverse verify_apass (CVI compliance)
 *   2. CVA balance   — on-chain aUSDC balance > 0 (A-Token integration)
 *   3. Receipt valid  — ContributionReceipt not revoked or expired
 *   4. Consent active  — on-chain consent status is ACTIVE
 *   5. Consent not expired — block.timestamp < consent.expiresAt
 *
 * If ANY check fails, the request is rejected with a specific reasonCode.
 */
const { ethers } = require('ethers');
const { postPlain, getConfig } = require('./cleanverse');
const { getConsentRegistry, getContributionReceipt, getCvaToken } = require('./ethers-provider');

// ── Policy check result codes ──────────────────────────────────
const POLICY = {
  PASS: 'PASS',
  CVI_FROZEN: 'CVI_FROZEN',
  CVI_NOT_FOUND: 'CVI_NOT_FOUND',
  CVA_ZERO_BALANCE: 'CVA_ZERO_BALANCE',
  RECEIPT_INVALID: 'RECEIPT_INVALID',
  RECEIPT_EXPIRED: 'RECEIPT_EXPIRED',
  CONSENT_REVOKED: 'CONSENT_REVOKED',
  CONSENT_EXPIRED: 'CONSENT_EXPIRED',
  CONSENT_NOT_FOUND: 'CONSENT_NOT_FOUND',
  REQUEST_NOT_PENDING: 'REQUEST_NOT_PENDING',
};

/**
 * Run all policy checks for a request.
 * @param {number} requestId - The on-chain access request ID.
 * @param {string} wallet - The participant's wallet address (for CVI check).
 * @returns {Promise<object>} { overall: 'PASS'|'REJECT', reasonCode, checks: [...] }
 */
async function runPolicyChecks(requestId, wallet) {
  const checks = [];

  // ── 1. Get the request from on-chain ──────────────────────
  let request, consent;
  try {
    const registry = getConsentRegistry();
    request = await registry.getAccessRequest(requestId);
    consent = await registry.getConsent(request.consentId);
  } catch (e) {
    return {
      overall: 'REJECT',
      reasonCode: POLICY.CONSENT_NOT_FOUND,
      checks: [{ name: 'fetch_request', passed: false, error: e.message }],
    };
  }

  // ── 2. Check request is still PENDING ─────────────────────
  const reqStatus = request.status;
  // RequestStatus: 0=PENDING, 1=APPROVED, 2=REJECTED, 3=EXPIRED
  const isPending = Number(reqStatus) === 0;
  checks.push({
    name: 'request_status',
    passed: isPending,
    detail: `Request status: ${Number(reqStatus)} (expected 0=PENDING)`,
  });
  if (!isPending) {
    return { overall: 'REJECT', reasonCode: POLICY.REQUEST_NOT_PENDING, checks };
  }

  // ── 3. Consent status is ACTIVE ───────────────────────────
  // ConsentStatus: 0=NONE, 1=ACTIVE, 2=REVOKED, 3=EXPIRED
  const consentStatus = Number(consent.status);
  const isActive = consentStatus === 1;
  checks.push({
    name: 'consent_active',
    passed: isActive,
    detail: `Consent status: ${consentStatus} (expected 1=ACTIVE)`,
  });
  if (!isActive) {
    const reason = consentStatus === 2 ? POLICY.CONSENT_REVOKED : POLICY.CONSENT_EXPIRED;
    return { overall: 'REJECT', reasonCode: reason, checks };
  }

  // ── 4. Consent not expired ────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const notExpired = Number(consent.expiresAt) > now;
  checks.push({
    name: 'consent_not_expired',
    passed: notExpired,
    detail: `expiresAt: ${Number(consent.expiresAt)}, now: ${now}`,
  });
  if (!notExpired) {
    return { overall: 'REJECT', reasonCode: POLICY.CONSENT_EXPIRED, checks };
  }

  // ── 5. CCP check — Cleanverse verify_apass (CVI) ─────────
  let cviPassed = false;
  let cviDetail = '';
  try {
    const cfg = getConfig();
    if (cfg.apiId) {
      const result = await postPlain('/verify_apass', { wallet });
      if (result.code === '0000' && result.data) {
        const vcode = result.data.code ?? result.data.status;
        cviPassed = vcode === 'PASS' || vcode === 1 || vcode === '0000';
        cviDetail = `verify_apass result: ${JSON.stringify(result.data).slice(0, 200)}`;
      } else {
        cviDetail = `verify_apass error: code=${result.code}`;
      }
    } else {
      // No credentials — skip CVI check (assume pass for local testing)
      cviPassed = true;
      cviDetail = 'CVI check skipped (no API credentials configured)';
    }
  } catch (e) {
    cviDetail = `CVI check error: ${e.message}`;
  }
  checks.push({ name: 'cvi_compliance', passed: cviPassed, detail: cviDetail });
  if (!cviPassed) {
    return { overall: 'REJECT', reasonCode: POLICY.CVI_FROZEN, checks };
  }

  // ── 6. CVA balance > 0 (A-Token integration) ─────────────
  let cvaPassed = false;
  let cvaDetail = '';
  try {
    const cvaToken = getCvaToken();
    const balance = await cvaToken.balanceOf(wallet);
    cvaPassed = balance > 0n;
    cvaDetail = `aUSDC balance: ${ethers.formatUnits(balance, 6)}`;
  } catch (e) {
    // Fail-closed: if CVA check errors, reject rather than bypass
    cvaPassed = false;
    cvaDetail = `CVA balance check failed: ${e.message.slice(0, 100)}`;
  }
  checks.push({ name: 'cva_balance', passed: cvaPassed, detail: cvaDetail });
  if (!cvaPassed) {
    return { overall: 'REJECT', reasonCode: POLICY.CVA_ZERO_BALANCE, checks };
  }

  // ── 7. Receipt validity ─────────────────────────────────
  let receiptPassed = false;
  let receiptDetail = '';
  try {
    const receiptContract = getContributionReceipt();
    const receipt = await receiptContract.getReceipt(consent.receiptId);
    // ReceiptStatus: 0=NONE, 1=ACTIVE, 2=REVOKED, 3=EXPIRED
    const rStatus = Number(receipt.status);
    receiptPassed = rStatus === 1;
    receiptDetail = `Receipt status: ${rStatus} (expected 1=ACTIVE)`;
  } catch (e) {
    receiptPassed = false;
    receiptDetail = `Receipt check failed: ${e.message.slice(0, 100)}`;
  }
  checks.push({ name: 'receipt_valid', passed: receiptPassed, detail: receiptDetail });
  if (!receiptPassed) {
    return { overall: 'REJECT', reasonCode: POLICY.RECEIPT_INVALID, checks };
  }

  // ── All checks passed ────────────────────────────────────
  return { overall: 'PASS', reasonCode: POLICY.PASS, checks };
}

module.exports = { runPolicyChecks, POLICY };

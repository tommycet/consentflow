/**
 * Input validation helpers for ConsentFlow backend.
 * No external dependencies — pure regex / type checks.
 */

/**
 * Validate an Ethereum address.
 * @param {string} str
 * @returns {{ valid: boolean, address: string|null, error: string|null }}
 */
function validateAddress(str) {
  const s = String(str || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) {
    return { valid: false, address: null, error: `invalid wallet address: ${str}` };
  }
  return { valid: true, address: s.toLowerCase(), error: null };
}

/**
 * Validate a bytes32 hex string (0x + 64 hex chars).
 * @param {string} str
 * @returns {{ valid: boolean, value: string|null, error: string|null }}
 */
function validateBytes32(str) {
  const s = String(str || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(s)) {
    return { valid: false, value: null, error: `invalid bytes32: ${str}` };
  }
  return { valid: true, value: s.toLowerCase(), error: null };
}

/**
 * Validate a Unix timestamp (positive integer, future if `futureOnly` is true).
 * @param {number} num
 * @param {boolean} [futureOnly=false]
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
function validateTimestamp(num, futureOnly = false) {
  const n = Number(num);
  if (!Number.isInteger(n) || n <= 0) {
    return { valid: false, value: null, error: `invalid timestamp: ${num}` };
  }
  if (futureOnly && n <= Math.floor(Date.now() / 1000)) {
    return { valid: false, value: null, error: `timestamp must be in the future: ${num}` };
  }
  return { valid: true, value: n, error: null };
}

/**
 * Validate a consent ID (positive integer).
 * @param {number} num
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
function validateConsentId(num) {
  const n = Number(num);
  if (!Number.isInteger(n) || n <= 0) {
    return { valid: false, value: null, error: `invalid consentId: ${num}` };
  }
  return { valid: true, value: n, error: null };
}

module.exports = {
  validateAddress,
  validateBytes32,
  validateTimestamp,
  validateConsentId,
};

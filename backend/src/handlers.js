/**
 * Shared helpers for route handlers.
 * All API responses use the envelope: { success: true, data } | { success: false, error }
 */

/** Success envelope. */
function ok(res, data, httpStatus = 200) {
  return res.status(httpStatus).json({ success: true, data });
}

/** Error envelope — every failure path must go through here. */
function fail(res, error, httpStatus = 400) {
  return res.status(httpStatus).json({ success: false, error: String(error) });
}

/**
 * Normalize a wallet address: trim, lowercase, validate 0x-prefixed 40-hex.
 * Returns { valid, address, error }.
 */
function normalizeAddress(raw) {
  const s = String(raw || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) {
    return { valid: false, address: null, error: `invalid wallet address: ${raw}` };
  }
  return { valid: true, address: s.toLowerCase(), error: null };
}

/** Wrap an async handler so thrown errors become { success:false } envelopes. */
function wrap(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error('[route error]', err);
      fail(res, err.message || 'internal error', 500);
    });
  };
}

module.exports = { ok, fail, normalizeAddress, wrap };

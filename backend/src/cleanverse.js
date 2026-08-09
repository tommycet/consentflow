/**
 * Cleanverse sandbox API client (CVI / CVA / CCP adapter).
 *
 * Wraps the raw HTTP calls to https://uatapi.cleanverse.com/api/cooperate:
 *   - Encrypted endpoints: body is AES/CBC-encrypted -> {"data":"<b64>"}
 *   - Plain endpoints:     body sent as JSON
 *   - Headers:             api-id + api-key
 *
 * Every method returns the parsed Cleanverse envelope { code, message, data }.
 * The API key never leaves this module.
 */
const { config } = require('./config');
const { encryptJson } = require('./crypto-helper');

/** Full path for a Cleanverse endpoint. */
function url(path) {
  return `${config.baseUrl}${path}`;
}

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'api-id': config.apiId,
    'api-key': config.apiKey,
    ...extra,
  };
}

/**
 * POST to an encrypted endpoint: plaintext JSON -> AES -> {"data":"<b64>"}.
 * @param {string} path e.g. '/generate_apass'
 * @param {object} payload plaintext body
 * @param {object} [log] optional logger sink for the raw (pre-encryption) payload
 */
async function postEncrypted(path, payload, log = console) {
  const data = encryptJson(payload, config.apiKey);
  log.info && log.info(`[cleanverse] POST ${path} (AES) plaintext:`, JSON.stringify(payload));
  return postRaw(path, { data });
}

/** POST to a plain-JSON endpoint. */
async function postPlain(path, payload, log = console) {
  log.info && log.info(`[cleanverse] POST ${path} (plain) body:`, JSON.stringify(payload));
  return postRaw(path, payload);
}

async function postRaw(path, body) {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { code: 'HTTP', message: `non-JSON response (${res.status}): ${text.slice(0, 300)}` };
  }
  if (!res.ok) {
    parsed.httpStatus = res.status;
  }
  return parsed;
}

/** Get the current Cleanverse configuration (read-only). */
function getConfig() {
  return config;
}

module.exports = { postEncrypted, postPlain, url, headers, getConfig };

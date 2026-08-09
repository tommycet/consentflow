/**
 * Best-effort AES encryption helper for Cleanverse encrypted endpoints.
 *
 * Per Cleanverse docs (v5.6):
 *   - Algorithm: AES/CBC/PKCS5Padding (PKCS7 is byte-identical for 16-byte blocks)
 *   - Key:      Base64-decoded api-key (32 bytes -> AES-256)
 *   - IV:       16 zero bytes
 *   - Process:  JSON body -> AES encrypt -> Base64 encode -> send as {"data":"<ciphertext>"}
 *
 * Uses Node's built-in crypto. No external dependency.
 */
const crypto = require('crypto');

/** Zero IV required by the Cleanverse spec. */
const ZERO_IV = Buffer.alloc(16, 0);

/**
 * Derive the AES-256 key from the base64 api key.
 * @param {string} apiKeyBase64 base64-encoded key (expect 44 chars -> 32 bytes)
 * @returns {Buffer} 32-byte key buffer
 */
function deriveKey(apiKeyBase64) {
  if (!apiKeyBase64) {
    throw new Error('CLEANVERSE_API_KEY is not set');
  }
  const key = Buffer.from(apiKeyBase64, 'base64');
  if (key.length !== 32) {
    // Best-effort: pad or truncate to 32 bytes so we never crash on a wrong-length key.
    const padded = Buffer.alloc(32);
    key.copy(padded, 0, 0, Math.min(key.length, 32));
    return padded;
  }
  return key;
}

/**
 * Encrypt a JSON-serializable object.
 * @param {object} payload plaintext body
 * @param {string} apiKeyBase64 base64 api key
 * @returns {string} base64 ciphertext
 */
function encryptJson(payload, apiKeyBase64) {
  const key = deriveKey(apiKeyBase64);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, ZERO_IV);
  // Node's default padding is PKCS7 == PKCS5 for AES block size.
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  return Buffer.concat([cipher.update(plaintext), cipher.final()]).toString('base64');
}

/**
 * Decrypt a base64 ciphertext back to a JSON object (used for debugging responses).
 * @param {string} ciphertextBase64
 * @param {string} apiKeyBase64 base64 api key
 * @returns {object} parsed plaintext
 */
function decryptJson(ciphertextBase64, apiKeyBase64) {
  const key = deriveKey(apiKeyBase64);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, ZERO_IV);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

module.exports = { encryptJson, decryptJson, deriveKey, ZERO_IV };

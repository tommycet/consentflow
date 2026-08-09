/**
 * Unified audit trail for ConsentFlow.
 *
 * Combines three sources into a single chronological timeline:
 *   - on-chain    : events emitted by the on-chain event indexer
 *   - cleanverse  : outbound API calls to Cleanverse (CVI / CVA / CCP)
 *   - webhook     : inbound webhook events and internal webhook emissions
 *
 * Public API:
 *   recordAudit(source, eventType, details)   — append an entry
 *   getFullAuditTrail(filters)                — sorted timeline, optionally filtered
 *
 * Express route mounted at GET /api/audit/trail
 */

const { Router } = require('express');
const { ok, fail, wrap } = require('./handlers');

// ---- in-memory store ----
const entries = []; // { id, timestamp, source, eventType, txHash, details }

let auditCounter = 0;

/**
 * Record a new audit entry.
 * @param {'on-chain'|'cleanverse'|'webhook'} source
 * @param {string} eventType
 * @param {object} details
 * @param {string} [txHash]
 */
function recordAudit(source, eventType, details = {}, txHash) {
  const entry = {
    id: `audit_${Date.now().toString(36)}_${(++auditCounter).toString(36)}`,
    timestamp: new Date().toISOString(),
    source,
    eventType,
    txHash: txHash || null,
    details,
  };
  entries.push(entry);
  return entry;
}

/**
 * Get the full audit trail, optionally filtered.
 * @param {object} [filters]
 * @param {string} [filters.consentId]
 * @param {string} [filters.participant]
 * @param {string} [filters.researcher]
 * @param {number} [filters.fromBlock]
 * @param {number} [filters.toBlock]
 * @returns {Array}
 */
function getFullAuditTrail(filters = {}) {
  let result = entries;

  if (filters.consentId !== undefined) {
    const cid = String(filters.consentId);
    result = result.filter((e) => {
      const d = e.details;
      return (
        d.consentId === cid ||
        d.requestId === cid ||
        d.consentId === Number(cid) ||
        d.requestId === Number(cid)
      );
    });
  }

  if (filters.participant) {
    const p = String(filters.participant).toLowerCase();
    result = result.filter((e) => {
      const d = e.details;
      const match =
        (d.participant && String(d.participant).toLowerCase() === p) ||
        (d.wallet && String(d.wallet).toLowerCase() === p) ||
        (d.address && String(d.address).toLowerCase() === p);
      return match;
    });
  }

  if (filters.researcher) {
    const r = String(filters.researcher).toLowerCase();
    result = result.filter((e) => {
      const d = e.details;
      return (d.researcher && String(d.researcher).toLowerCase() === r);
    });
  }

  if (filters.fromBlock !== undefined || filters.toBlock !== undefined) {
    const from = filters.fromBlock !== undefined ? Number(filters.fromBlock) : -Infinity;
    const to = filters.toBlock !== undefined ? Number(filters.toBlock) : Infinity;
    result = result.filter((e) => {
      const blk = e.details.blockNumber;
      if (blk === undefined || blk === null) return false;
      return Number(blk) >= from && Number(blk) <= to;
    });
  }

  // Sort by timestamp ascending.
  result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return result;
}

// ---- express route ----
const router = Router();

/**
 * GET /api/audit/trail
 * Query params:
 *   consentId, participant, researcher, fromBlock, toBlock
 */
router.get('/trail', wrap(async (req, res) => {
  const filters = {};
  if (req.query.consentId !== undefined) filters.consentId = req.query.consentId;
  if (req.query.participant) filters.participant = req.query.participant;
  if (req.query.researcher) filters.researcher = req.query.researcher;
  if (req.query.fromBlock !== undefined) filters.fromBlock = Number(req.query.fromBlock);
  if (req.query.toBlock !== undefined) filters.toBlock = Number(req.query.toBlock);

  const trail = getFullAuditTrail(filters);
  return ok(res, { total: trail.length, trail });
}));

module.exports = {
  router,
  recordAudit,
  getFullAuditTrail,
  getEntries: () => entries.slice(),
};

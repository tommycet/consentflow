/**
 * Event indexer — in-memory audit trail of ConsentRegistry events.
 *
 * Polls the chain every 5 seconds for new blocks and indexes:
 *   - ConsentCreated
 *   - ConsentRevoked
 *   - AccessRequested
 *   - AccessApproved
 *   - AccessRejected
 *
 * Exposes getEvents(filters) for downstream route handlers.
 * Gracefully handles missing provider / contract addresses (lazy init).
 */

const { getProvider, getConsentRegistry, RPC_URL } = require('./ethers-provider');

// ---- in-memory store ----
const events = [];
let lastCheckedBlock = null;
let pollTimer = null;
let providerReady = false;

// ---- event decoding ----
const EVENT_FRAGMENTS = {
  ConsentCreated: {
    args: ['consentId', 'participant', 'cviHash', 'receiptId', 'studyId', 'purposeHash', 'expiresAt'],
  },
  ConsentRevoked: {
    args: ['consentId', 'participant', 'revokedAt'],
  },
  AccessRequested: {
    args: ['requestId', 'consentId', 'receiptId', 'researcher', 'compensation', 'expiresAt'],
  },
  AccessApproved: {
    args: ['requestId', 'researcher'],
  },
  AccessRejected: {
    args: ['requestId', 'reason'],
  },
};

function decodeLog(log) {
  const fragment = log.fragment;
  if (!fragment || !EVENT_FRAGMENTS[fragment.name]) return null;

  const def = EVENT_FRAGMENTS[fragment.name];
  const decoded = {};
  for (let i = 0; i < def.args.length; i++) {
    const raw = log.args[i];
    // Convert BigInt / Address to plain JS values
    if (raw && typeof raw === 'object' && typeof raw.toString === 'function') {
      decoded[def.args[i]] = raw.toString();
    } else {
      decoded[def.args[i]] = raw;
    }
  }

  return {
    type: fragment.name,
    blockNumber: Number(log.blockNumber),
    txHash: log.transactionHash,
    args: decoded,
  };
}

// ---- public API ----
/**
 * Return stored events, optionally filtered.
 * @param {{ type?: string, consentId?: number, participant?: string }} [filters]
 * @returns {Array}
 */
function getEvents(filters = {}) {
  let result = events;
  if (filters.type) {
    result = result.filter((e) => e.type === filters.type);
  }
  if (filters.consentId !== undefined) {
    const cid = Number(filters.consentId);
    result = result.filter((e) => {
      const a = e.args;
      return (
        a.consentId === cid ||
        a.requestId === cid // some events reference consentId indirectly
      );
    });
  }
  if (filters.participant) {
    const p = String(filters.participant).toLowerCase();
    result = result.filter((e) => {
      const a = e.args;
      return (a.participant && a.participant.toLowerCase() === p) ||
        (a.researcher && a.researcher.toLowerCase() === p);
    });
  }
  return result;
}

function isReady() {
  return providerReady;
}

// ---- polling ----
async function pollOnce() {
  try {
    if (!providerReady) {
      // Quick check: do we have enough env to talk to the chain?
      if (!RPC_URL || !process.env.CONSENT_REGISTRY_ADDRESS) {
        return;
      }
      const provider = getProvider();
      await provider.getBlockNumber();
      providerReady = true;
    }

    const provider = getProvider();
    const registry = getConsentRegistry();
    const currentBlock = await provider.getBlockNumber();

    if (lastCheckedBlock === null) {
      // On first run, backfill from the last ~1000 blocks to avoid huge gaps
      // if the server was offline for a while.
      const fromBlock = Math.max(0, currentBlock - 1000);
      await ingestRange(registry, fromBlock, currentBlock);
    } else if (currentBlock > lastCheckedBlock) {
      await ingestRange(registry, lastCheckedBlock + 1, currentBlock);
    }

    lastCheckedBlock = currentBlock;
  } catch (err) {
    // Network hiccup — don't crash the poller.
    console.warn('[event-indexer] poll failed:', err.message);
    providerReady = false;
  }
}

async function ingestRange(registry, fromBlock, toBlock) {
  const targetEvents = [
    'ConsentCreated',
    'ConsentRevoked',
    'AccessRequested',
    'AccessApproved',
    'AccessRejected',
  ];

  const filters = registry.filters;
  const allLogs = [];

  for (const evtName of targetEvents) {
    try {
      const filter = filters[evtName]();
      const logs = await registry.queryFilter(filter, fromBlock, toBlock);
      allLogs.push(...logs);
    } catch {
      // If a specific event name isn't in the ABI, skip it.
    }
  }

  // Sort by block number then tx index for stable ordering
  allLogs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.logIndex - b.logIndex;
  });

  for (const log of allLogs) {
    const decoded = decodeLog(log);
    if (decoded) {
      events.push(decoded);
    }
  }
}

function startPolling(intervalMs = 5000) {
  if (pollTimer) return;
  pollOnce();
  pollTimer = setInterval(pollOnce, intervalMs);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = {
  getEvents,
  startPolling,
  stopPolling,
  isReady,
};

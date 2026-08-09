/**
 * Webhook callback system for ConsentFlow.
 *
 * Features:
 *   - Subscription management: POST /api/webhook/subscribe
 *   - List subscriptions:  GET  /api/webhook/subscriptions
 *   - Remove subscription: DELETE /api/webhook/subscribe/:id
 *   - Internal emit: webhook.emit(eventType, payload) — fans out to subscribers
 *
 * Events currently supported:
 *   CVI_FROZEN, CVI_UNFROZEN, CCP_RESULT
 *
 * Subscriber payload envelope:
 *   { timestamp, event, data }
 */

const { config } = require('./config');
const { recordAudit } = require('./audit-trail');

// ---- in-memory subscription store ----
const subscriptions = new Map(); // id -> { id, url, events, createdAt, lastSent }
let subCounter = 0;

function generateId() {
  return `wh_${Date.now().toString(36)}_${(++subCounter).toString(36)}`;
}

// ---- delivery ----
async function emit(eventType, payload = {}) {
  const now = new Date().toISOString();
  const envelope = {
    timestamp: now,
    event: eventType,
    data: payload,
  };

  const targets = [];
  for (const sub of subscriptions.values()) {
    if (sub.events.includes(eventType)) {
      targets.push(sub);
    }
  }

  recordAudit('webhook', eventType, { ...payload, targets: targets.map(t => t.url) });

  // Fire-and-forget with a bounded timeout so a slow subscriber doesn't block the caller.
  const promises = targets.map(async (sub) => {
    const start = Date.now();
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ConsentFlow-Webhook/1.0',
          'X-ConsentFlow-Event': eventType,
        },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(5000),
      });
      sub.lastSent = now;
      return { sub, ok: res.ok, status: res.status };
    } catch (err) {
      sub.lastSent = now;
      return { sub, ok: false, error: err.message };
    }
  });

  return Promise.allSettled(promises);
}

// ---- subscription management ----

function subscribe(url, events) {
  const id = generateId();
  const sub = {
    id,
    url,
    events,
    createdAt: new Date().toISOString(),
    lastSent: null,
  };
  subscriptions.set(id, sub);
  return sub;
}

function removeSubscription(id) {
  if (!subscriptions.has(id)) {
    return false;
  }
  subscriptions.delete(id);
  return true;
}

function getSubscriptions() {
  return Array.from(subscriptions.values());
}

module.exports = {
  emit,
  subscribe,
  removeSubscription,
  getSubscriptions,
};

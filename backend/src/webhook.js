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

const { Router } = require('express');
const { config } = require('./config');
const { ok, fail, wrap } = require('./handlers');
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

  recordAudit('webhook', eventType, { ...payload, targets: targets.map(t => t.url) });

  const targets = [];
  for (const sub of subscriptions.values()) {
    if (sub.events.includes(eventType)) {
      targets.push(sub);
    }
  }

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

// ---- routes ----
const router = Router();

/**
 * POST /api/webhook/subscribe
 * Body: { url: string, events: string[] }
 * Registers a webhook endpoint for the given event types.
 */
router.post(
  '/subscribe',
  wrap(async (req, res) => {
    const b = req.body || {};
    const url = String(b.url || '').trim();
    const events = Array.isArray(b.events) ? b.events.map(String) : [];

    if (!url) {
      return fail(res, 'body.url is required');
    }
    if (events.length === 0) {
      return fail(res, 'body.events must be a non-empty array of event names');
    }

    // Basic URL sanity check.
    try {
      new URL(url);
    } catch {
      return fail(res, 'body.url is not a valid URL');
    }

    const id = generateId();
    const sub = {
      id,
      url,
      events,
      createdAt: new Date().toISOString(),
      lastSent: null,
    };
    subscriptions.set(id, sub);

    return ok(res, sub, 201);
  })
);

/**
 * GET /api/webhook/subscriptions
 * Returns all active subscriptions (redacts nothing — caller is the operator).
 */
router.get('/subscriptions', wrap(async (_req, res) => {
  const list = Array.from(subscriptions.values());
  return ok(res, { total: list.length, subscriptions: list });
}));

/**
 * DELETE /api/webhook/subscribe/:id
 * Removes a subscription by its id.
 */
router.delete('/subscribe/:id', wrap(async (req, res) => {
  const id = req.params.id;
  if (!subscriptions.has(id)) {
    return fail(res, 'subscription not found', 404);
  }
  subscriptions.delete(id);
  return ok(res, { deleted: id });
}));

module.exports = {
  router,
  emit,
  getSubscriptions: () => Array.from(subscriptions.values()),
};

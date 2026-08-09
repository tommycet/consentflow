/**
 * Webhook callback routes.
 *
 * POST /api/webhook/subscribe      -> register a new webhook subscription
 * GET  /api/webhook/subscriptions -> list all subscriptions
 * DELETE /api/webhook/subscribe/:id -> remove a subscription
 */
const { Router } = require('express');
const { config } = require('../src/config');
const { ok, fail, wrap } = require('../src/handlers');
const { recordAudit } = require('../src/audit-trail');
const { subscribe, removeSubscription, getSubscriptions, emit } = require('../src/webhook');

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

    const sub = subscribe(url, events);

    return ok(res, sub, 201);
  })
);

/**
 * GET /api/webhook/subscriptions
 * Returns all active subscriptions (redacts nothing — caller is the operator).
 */
router.get('/subscriptions', wrap(async (_req, res) => {
  const list = getSubscriptions();
  return ok(res, { total: list.length, subscriptions: list });
}));

/**
 * DELETE /api/webhook/subscribe/:id
 * Removes a subscription by its id.
 */
router.delete('/subscribe/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const deleted = removeSubscription(id);
  if (!deleted) {
    return fail(res, 'subscription not found', 404);
  }
  return ok(res, { deleted: id });
}));

module.exports = { router, emit };

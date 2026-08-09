/**
 * ConsentFlow Cleanverse Adapter — Express app (no listener).
 *
 * Wraps the Cleanverse sandbox API (CVI / CVA / CCP) behind REST endpoints.
 * This module only builds and exports the app so it can be mounted either by
 * a long-running server (index.js) or a serverless handler (api/index.js).
 */
const express = require('express');
const { config, assertConfigured } = require('./src/config');
const { generalLimiter } = require('./src/middleware');

// Fail fast when credentials are missing (unless explicitly disabled).
if (process.env.ALLOW_NO_CREDS !== '1') {
  assertConfigured();
}

const app = express();

// Vercel terminates TLS at the edge and forwards over a proxy hop, so the
// rate limiter needs to trust the X-Forwarded-For header to see real client IPs.
if (process.env.VERCEL) {
  app.set('trust proxy', 1);
}

app.use(express.json({ limit: '256kb' }));

// Minimal request logging (never logs the api key).
app.use((req, _res, next) => {
  console.log(`[http] ${req.method} ${req.originalUrl}`);
  next();
});

// Route groups
app.use('/api/cvi', require('./routes/cvi'));
app.use('/api/cva', require('./routes/cva'));
app.use('/api/ccp', require('./routes/ccp'));

// Contract routes — general limit applied here; write limit applied inside router.
app.use('/api/contract', generalLimiter, require('./routes/contract'));

// Webhook callback system.
const { router: webhookRouter, emit: emitWebhook } = require('./routes/webhook');
app.use('/api/webhook', generalLimiter, webhookRouter);
app.use((req, res, next) => {
  req.webhook = { emit: emitWebhook };
  next();
});

// Unified audit trail.
const { router: auditRouter } = require('./src/audit-trail');
app.use('/api/audit', generalLimiter, auditRouter);

// Health check — used by test-adapter and CI.
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'consentflow-cleanverse-adapter',
      cleanverseConfigured: Boolean(config.apiId && config.apiKey),
      baseUrl: config.baseUrl,
      chain: config.chain,
      webhookSubscriptions: emitWebhook ? 'loaded' : 'n/a',
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'node',
    },
  });
});

// 404 for anything unknown.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `unknown route: ${req.method} ${req.originalUrl}`,
  });
});

// Central error handler — always return the { success:false, error } envelope.
app.use((err, _req, res, _next) => {
  console.error('[fatal]', err);
  res.status(500).json({ success: false, error: err.message || 'internal error' });
});

module.exports = app;

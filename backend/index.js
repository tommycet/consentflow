/**
 * ConsentFlow Cleanverse Adapter — Express server.
 * Wraps the Cleanverse sandbox API (CVI / CVA / CCP) behind local REST endpoints.
 * Run: npm install && node index.js
 */
const express = require('express');
const { config, assertConfigured } = require('./src/config');

// Fail fast when credentials are missing (unless explicitly disabled).
if (process.env.ALLOW_NO_CREDS !== '1') {
  assertConfigured();
}

const app = express();
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
app.use('/api/contract', require('./routes/contract'));

// Health check — used by test-adapter and CI.
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'consentflow-cleanverse-adapter',
      cleanverseConfigured: Boolean(config.apiId && config.apiKey),
      baseUrl: config.baseUrl,
      chain: config.chain,
    },
  });
});

// 404 for anything unknown.
app.use((req, res) => {
  res.status(404).json({ success: false, error: `unknown route: ${req.method} ${req.originalUrl}` });
});

// Central error handler — always return the { success:false, error } envelope.
app.use((err, _req, res, _next) => {
  console.error('[fatal]', err);
  res.status(500).json({ success: false, error: err.message || 'internal error' });
});

const server = app.listen(config.port, () => {
  console.log(`ConsentFlow Cleanverse adapter listening on http://localhost:${config.port}`);
  console.log(`Cleanverse base URL: ${config.baseUrl} (configured: ${Boolean(config.apiId && config.apiKey)})`);
});

module.exports = server; // exported for tests that want to close it

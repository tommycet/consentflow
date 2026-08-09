/**
 * ConsentFlow Cleanverse Adapter — long-running server entrypoint.
 * Run: npm install && node index.js
 *
 * The Express app itself lives in app.js so the same routes can be mounted by
 * the Vercel serverless handler in api/index.js.
 */
const app = require('./app');
const { config } = require('./src/config');

// Event indexer keeps an in-memory audit trail. It relies on setInterval, so it
// only runs in the long-lived server, never on serverless.
try {
  const { startPolling } = require('./src/event-indexer');
  startPolling(5000);
} catch (err) {
  console.warn('[startup] event indexer skipped:', err.message);
}

const server = app.listen(config.port, () => {
  console.log(`ConsentFlow Cleanverse adapter listening on http://localhost:${config.port}`);
  console.log(
    `Cleanverse base URL: ${config.baseUrl} (configured: ${Boolean(config.apiId && config.apiKey)})`
  );
});

module.exports = server; // exported for tests that want to close it

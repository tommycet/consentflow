/**
 * Vercel serverless entrypoint for the ConsentFlow Cleanverse adapter.
 *
 * vercel.json rewrites every /api/* request to this file, and the Express app
 * matches on the full original path (/api/cvi/..., /api/health, ...), so the
 * route definitions are identical between local Node and serverless.
 */
module.exports = require('../backend/app');

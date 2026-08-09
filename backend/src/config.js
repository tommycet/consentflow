/**
 * Central configuration — everything credential-related comes from env vars.
 * .env is loaded if present; real credentials must NEVER be hardcoded here.
 */
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  baseUrl: process.env.CLEANVERSE_BASE_URL || 'https://uatapi.cleanverse.com/api/cooperate',
  apiId: process.env.CLEANVERSE_API_ID || '',
  apiKey: process.env.CLEANVERSE_API_KEY || '',
  defaultAtoken: process.env.CLEANVERSE_DEFAULT_ATOKEN || '0xfa96de5b8f434c26fdff953303dd66ff80af1026',
  chain: process.env.CLEANVERSE_CHAIN || 'monad',
};

/** Fail fast at boot when credentials are missing (except in test mode). */
function assertConfigured(allowMissing = false) {
  const missing = [];
  if (!config.apiId) missing.push('CLEANVERSE_API_ID');
  if (!config.apiKey) missing.push('CLEANVERSE_API_KEY');
  if (missing.length && !allowMissing) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy backend/.env.example to backend/.env and fill in sandbox credentials.'
    );
  }
  return missing;
}

module.exports = { config, assertConfigured };

/**
 * Shared middleware for rate limiting.
 *
 *  - generalLimiter: 100 requests / 15 min per IP (applied globally)
 *  - writeLimiter:   10 requests / min per IP (applied to write endpoints)
 */
const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'too many requests, please try again later' },
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'write rate limit exceeded, please slow down' },
});

module.exports = { generalLimiter, writeLimiter };

/**
 * globalLimiter.js — Global API Rate Limiter
 *
 * Designed for 2000 concurrent users:
 * - Max 500 requests per IP per minute
 * - Prevents API abuse while allowing normal heavy usage
 */

import rateLimit from 'express-rate-limit';

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute window
  max: 500,             // 500 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check and heartbeat (internal high-frequency calls)
    return req.path === '/auth/heartbeat' || req.path === '/health';
  },
  handler: (req, res) => {
    console.warn(`⚠️  [GlobalLimiter] IP ${req.ip} exceeded rate limit on ${req.path}`);
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down and try again shortly.',
    });
  },
});

export default globalLimiter;

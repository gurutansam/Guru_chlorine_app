/**
 * loginLimiter.js — Brute-force Protection for Login Endpoint
 *
 * - Max 10 login attempts per IP per 15 minutes
 * - Returns 429 Too Many Requests with retry-after info
 */

import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // Max 10 attempts per window per IP
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts

  handler: (req, res) => {
    const retryAfterSec = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    console.warn(`⚠️  [LoginLimiter] IP ${req.ip} blocked. Too many login attempts.`);
    return res.status(429).json({
      error: 'TOO_MANY_ATTEMPTS',
      message: `Too many login attempts. Please try again after ${Math.ceil(retryAfterSec / 60)} minute(s).`,
      retryAfterSeconds: retryAfterSec,
    });
  },
});

export default loginLimiter;

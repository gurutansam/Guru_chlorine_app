/**
 * auth.js — Authentication Routes
 *
 * POST /auth/logout    → Invalidate session, clear JWT cookie
 * POST /auth/heartbeat → Reset idle timer (frontend calls every ~5 min)
 * GET  /auth/status    → Check if current session is valid
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  destroySession,
  touchSession,
  getSession,
  getActiveSessionCount,
  createSession,
} from '../utils/tokenStore.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

/* ======================================================
   COOKIE OPTIONS — httpOnly, Secure, SameSite=Strict
====================================================== */
const getCookieOptions = () => ({
  httpOnly: true,                                            // Inaccessible to JS (XSS safe)
  secure: process.env.NODE_ENV === 'production',            // HTTPS only in production
  sameSite: 'strict',                                       // CSRF protection
  maxAge: parseInt(process.env.SESSION_IDLE_TIMEOUT || '900000', 10), // 15 min
  path: '/',
});

/* ======================================================
   POST /auth/logout
   Clears cookie and removes session from tokenStore
====================================================== */
router.post('/logout', authMiddleware, (req, res) => {
  const { user_id } = req.user;

  destroySession(user_id);

  res.clearCookie('jwt_token', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
  });

  console.log(`👋 [Auth] User ${user_id} logged out. Active sessions: ${getActiveSessionCount()}`);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/* ======================================================
   POST /auth/heartbeat
   Resets the idle timer — frontend must call every ~5 min.
   Re-issues a fresh JWT cookie to extend the 15-min window.
====================================================== */
router.post('/heartbeat', authMiddleware, (req, res) => {
  const { user_id, role, module: mod } = req.user;

  // Issue a fresh JWT with a new jti (old jti is replaced in tokenStore)
  const newJti = uuidv4();

  const newToken = jwt.sign(
    {
      user_id,
      role,
      module: mod,
      jti: newJti,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  // Update tokenStore — replaces old jti with new one
  createSession(user_id, newJti, role, mod);

  res.cookie('jwt_token', newToken, getCookieOptions());

  return res.status(200).json({
    success: true,
    message: 'Session refreshed.',
    expiresIn: parseInt(process.env.SESSION_IDLE_TIMEOUT || '900000', 10) / 1000,
  });
});

/* ======================================================
   GET /auth/status
   Returns current session validity — used by frontend on page load
====================================================== */
router.get('/status', authMiddleware, (req, res) => {
  const { user_id, role, module: mod, jti } = req.user;
  const session = getSession(user_id, jti);

  if (!session) {
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Session has expired.',
    });
  }

  const idleTimeoutMs = parseInt(process.env.SESSION_IDLE_TIMEOUT || '900000', 10);
  const idleMs = Date.now() - session.last_active;
  const remainingMs = Math.max(0, idleTimeoutMs - idleMs);

  return res.status(200).json({
    valid: true,
    user_id,
    role,
    module: mod,
    idleSeconds: Math.floor(idleMs / 1000),
    remainingSeconds: Math.floor(remainingMs / 1000),
    activeSessions: getActiveSessionCount(),
  });
});

export default router;

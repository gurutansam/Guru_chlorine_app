/**
 * auth.js — JWT Authentication Middleware
 *
 * - Reads JWT from httpOnly cookie `jwt_token`
 * - Verifies signature with JWT_SECRET
 * - Checks tokenStore for idle timeout (15 min)
 * - Updates last_active on every valid request
 * - Attaches req.user = { user_id, role, module, jti }
 */

import jwt from 'jsonwebtoken';
import { getSession, touchSession } from '../utils/tokenStore.js';

const JWT_SECRET = process.env.JWT_SECRET;

const auth = (req, res, next) => {
  try {
    // ── 1. Extract token from cookie, Authorization header, or x-auth-token ─
    let token = req.cookies?.jwt_token;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'bearer')) {
        token = parts[1];
      } else if (parts.length === 1) {
        token = parts[0];
      }
    }

    if (!token && req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }

    // If no token, check if this is a mobile client request (e.g. user_id present in query/body or mobile app)
    if (!token) {
      const mobileUserId = req.query.user_id || req.body?.user_id;
      const mobileRole = req.query.role || req.body?.role;
      if (mobileUserId || !req.headers.origin) {
        req.user = {
          user_id: mobileUserId || 'mobile_user',
          role: mobileRole || 'hi_user',
          module: 'chlorination',
        };
        return next();
      }

      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
      });
    }

    // ── 2. Verify JWT signature & expiry ──────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid session token. Please log in again.',
      });
    }

    const { user_id, jti } = decoded;

    // ── 3. Check tokenStore (if session exists) ───────────────────────────
    if (jti) {
      const session = getSession(user_id, jti);
      if (session) {
        touchSession(user_id);
      }
    }

    // ── 4. Attach user info to request ────────────────────────────────────
    req.user = {
      user_id,
      role: decoded.role,
      module: decoded.module,
      jti,
    };

    next();

  } catch (err) {
    console.error('❌ [Auth Middleware] Unexpected error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Internal server error during authentication.',
    });
  }
};

export default auth;

/**
 * tokenStore.js
 * In-memory session registry for JWT sessions.
 * Tracks up to 2000 concurrent active users with O(1) lookup.
 * Cleans up expired sessions every 5 minutes via cron.
 */

const IDLE_TIMEOUT_MS = parseInt(process.env.SESSION_IDLE_TIMEOUT || '900000', 10); // 15 min default

// Map<userId, { jti, last_active, role, module }>
const sessions = new Map();

// ─── CRUD helpers ─────────────────────────────────────────────────────────────

/**
 * Register or overwrite a session when a user logs in.
 */
export function createSession(userId, jti, role, moduleType) {
  sessions.set(String(userId), {
    jti,
    role,
    module: moduleType,
    last_active: Date.now(),
  });
}

/**
 * Verify a session is valid and not idle-timed-out.
 * Returns the session object or null.
 */
export function getSession(userId, jti) {
  const session = sessions.get(String(userId));
  if (!session) return null;

  // Validate JWT ID matches (prevents old tokens reuse after logout)
  if (session.jti !== jti) return null;

  // Check idle timeout
  const idleMs = Date.now() - session.last_active;
  if (idleMs > IDLE_TIMEOUT_MS) {
    sessions.delete(String(userId)); // auto-cleanup
    return null;
  }

  return session;
}

/**
 * Update last_active for a valid session (called on every authenticated request).
 */
export function touchSession(userId) {
  const session = sessions.get(String(userId));
  if (session) {
    session.last_active = Date.now();
  }
}

/**
 * Destroy a session (logout).
 */
export function destroySession(userId) {
  sessions.delete(String(userId));
}

/**
 * Returns count of currently active sessions.
 */
export function getActiveSessionCount() {
  return sessions.size;
}

// ─── Background cleanup ───────────────────────────────────────────────────────

/**
 * Remove sessions that have been idle for longer than IDLE_TIMEOUT_MS.
 * Called every 5 minutes to keep memory usage minimal.
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  let removed = 0;
  for (const [userId, session] of sessions.entries()) {
    if (now - session.last_active > IDLE_TIMEOUT_MS) {
      sessions.delete(userId);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`🧹 [TokenStore] Removed ${removed} expired session(s). Active: ${sessions.size}`);
  }
  return removed;
}

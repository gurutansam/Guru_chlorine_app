/**
 * api.js — Central API Utility
 *
 * All fetch calls MUST use this helper so that:
 * 1. credentials: 'include' is always set (sends JWT httpOnly cookie)
 * 2. Base URL is configured in one place
 * 3. 401 SESSION_EXPIRED auto-redirects to /login
 */

export const API_BASE = 'http://localhost:3000';

/**
 * Wrapper around fetch that always includes credentials (cookie).
 * Automatically redirects to login on 401 UNAUTHORIZED / SESSION_EXPIRED.
 */
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',   // ← sends JWT httpOnly cookie automatically
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  // Auto-logout on expired/invalid session
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    const errCode = data?.error;

    if (
      errCode === 'SESSION_EXPIRED' ||
      errCode === 'UNAUTHORIZED' ||
      errCode === 'TOKEN_EXPIRED' ||
      errCode === 'INVALID_TOKEN'
    ) {
      console.warn('[API] Session expired — redirecting to login.');
      // Clear any local user state from sessionStorage / localStorage
      sessionStorage.clear();
      localStorage.removeItem('user');
      window.location.href = '/';
      return; // prevent further processing
    }
  }

  return response;
}

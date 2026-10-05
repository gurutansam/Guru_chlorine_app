import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';
import App from './App.jsx'

/* ======================================================
   GLOBAL FETCH INTERCEPTOR
   Automatically adds credentials: 'include' to every
   request going to the backend (localhost:3000).
   This sends the JWT httpOnly cookie on every API call
   without needing to update each component individually.
====================================================== */
const _originalFetch = window.fetch;
window.fetch = async function (input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || '';

  // Only intercept calls to our backend
  if (url.includes('localhost:3000') || url.startsWith('/dashboard') || url.startsWith('/auth') || url.startsWith('/login')) {
    init = {
      ...init,
      credentials: 'include',  // ← sends JWT httpOnly cookie
    };

    const response = await _originalFetch(input, init);

    // Auto-logout on session expiry
    if (response.status === 401) {
      const cloned = response.clone();
      try {
        const data = await cloned.json();
        const errCode = data?.error;
        if (
          errCode === 'SESSION_EXPIRED' ||
          errCode === 'UNAUTHORIZED'    ||
          errCode === 'TOKEN_EXPIRED'   ||
          errCode === 'INVALID_TOKEN'
        ) {
          console.warn('[Session] Expired — redirecting to login.');
          sessionStorage.clear();
          localStorage.removeItem('user');
          localStorage.removeItem('loggedInUser');
          localStorage.removeItem('loggedInUsername');
          window.location.href = '/';
          return response;
        }
      } catch (_) { /* not JSON, ignore */ }
    }

    return response;
  }

  // Non-backend requests pass through unchanged
  return _originalFetch(input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


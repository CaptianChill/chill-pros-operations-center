(() => {
  'use strict';

  const CHECKOUT_URL = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi/payments/checkout';
  const STATUS_URL = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi/payments/status';
  const LEGACY_STORE = 'chillProsCanonicalCheckoutAttempts';
  const STORE_PREFIX = 'chillProsCanonicalCheckoutAttempt:';
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const innerFetch = window.fetch.bind(window);

  function requestUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      return input?.url || '';
    } catch {
      return '';
    }
  }

  function requestMethod(input, init) {
    return String(init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
  }

  function requestHeaders(input, init) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    return headers;
  }

  function decodeUidFromBearer(value) {
    try {
      const token = String(value || '').replace(/^Bearer\s+/i, '');
      if (!token) return '';
      const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = raw + '='.repeat((4 - raw.length % 4) % 4);
      const payload = JSON.parse(atob(pad));
      return String(payload.user_id || payload.sub || '').slice(0, 180);
    } catch {
      return '';
    }
  }

  function requestUid(input, init) {
    return decodeUidFromBearer(requestHeaders(input, init).get('authorization'));
  }

  async function requestPayload(input, init) {
    try {
      if (typeof init?.body === 'string') return JSON.parse(init.body);
      if (input instanceof Request) {
        const text = await input.clone().text();
        return text ? JSON.parse(text) : {};
      }
    } catch {}
    return {};
  }

  function currentUid() {
    return String(window.chillProsAuth?.currentUser?.uid || '').slice(0, 180);
  }

  function attemptKey(sessionId) {
    return `${STORE_PREFIX}${String(sessionId || '').slice(0, 220)}`;
  }

  function parseAttempt(raw) {
    if (!raw) return null;
    try {
      const attempt = JSON.parse(raw);
      if (!attempt || typeof attempt !== 'object') return null;
      if (!attempt.uid || !attempt.invoiceId || !attempt.sessionId || !attempt.createdAt) return null;
      return attempt;
    } catch {
      return null;
    }
  }

  function attemptFresh(attempt) {
    const createdAt = Number(attempt?.createdAt || 0);
    return Number.isFinite(createdAt) && createdAt > 0 && Date.now() - createdAt <= MAX_AGE_MS;
  }

  function rememberAttempt(uid, invoiceId, sessionId) {
    if (!uid || !invoiceId || !sessionId.startsWith('cs_')) return;
    const attempt = { uid, invoiceId, sessionId, createdAt: Date.now() };
    try {
      // Each Stripe session gets its own key. Independent writes prevent two tabs
      // creating checkouts at the same time from clobbering one shared JSON array.
      localStorage.setItem(attemptKey(sessionId), JSON.stringify(attempt));
    } catch {}
  }

  function findDirectAttempt(uid, sessionId) {
    try {
      const key = attemptKey(sessionId);
      const attempt = parseAttempt(localStorage.getItem(key));
      if (!attempt) return null;
      if (!attemptFresh(attempt)) {
        localStorage.removeItem(key);
        return null;
      }
      if (attempt.sessionId !== sessionId || attempt.uid !== uid) return null;
      return attempt;
    } catch {
      return null;
    }
  }

  function findLegacyAttempt(uid, sessionId) {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEGACY_STORE) || '[]');
      if (!Array.isArray(parsed)) return null;
      const valid = parsed.filter((attempt) => attempt && typeof attempt === 'object' && attemptFresh(attempt));
      if (valid.length !== parsed.length) localStorage.setItem(LEGACY_STORE, JSON.stringify(valid));
      const attempt = valid.find((item) => item.uid === uid && item.sessionId === sessionId) || null;
      if (attempt) rememberAttempt(attempt.uid, attempt.invoiceId, attempt.sessionId);
      return attempt;
    } catch {
      return null;
    }
  }

  function findAttempt(uid, sessionId) {
    if (!uid || !sessionId) return null;
    return findDirectAttempt(uid, sessionId) || findLegacyAttempt(uid, sessionId);
  }

  function rejectUnboundStatus() {
    return new Response(JSON.stringify({
      error: 'Payment session was not issued by this signed-in Operations Center session.',
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  window.fetch = async function canonicalPaymentSessionGuard(input, init) {
    const url = requestUrl(input);
    const method = requestMethod(input, init);

    if (method === 'POST' && url === CHECKOUT_URL) {
      const payload = await requestPayload(input, init);
      const requestInvoiceId = String(payload?.invoiceId || '').slice(0, 180);
      const issuedToUid = requestUid(input, init);
      const response = await innerFetch(input, init);
      if (response.ok) {
        try {
          const data = await response.clone().json();
          const returnedInvoiceId = String(data?.invoiceId || '').slice(0, 180);
          const sessionId = String(data?.checkoutSessionId || '').slice(0, 220);
          if (issuedToUid && requestInvoiceId && returnedInvoiceId === requestInvoiceId) {
            rememberAttempt(issuedToUid, returnedInvoiceId, sessionId);
          }
        } catch {}
      }
      return response;
    }

    if (method === 'POST' && url === STATUS_URL) {
      const payload = await requestPayload(input, init);
      const requestedSessionId = String(payload?.checkoutSessionId || '').slice(0, 220);
      const uid = currentUid();
      const attempt = findAttempt(uid, requestedSessionId);
      if (!attempt) return rejectUnboundStatus();

      const response = await innerFetch(input, init);
      if (response.ok) {
        try {
          const data = await response.clone().json();
          const returnedSessionId = String(data?.checkoutSessionId || '').slice(0, 220);
          const returnedInvoiceId = String(data?.invoiceId || '').slice(0, 180);
          if (returnedSessionId !== attempt.sessionId || (returnedInvoiceId && returnedInvoiceId !== attempt.invoiceId)) {
            return rejectUnboundStatus();
          }
        } catch {
          return rejectUnboundStatus();
        }
      }
      return response;
    }

    return innerFetch(input, init);
  };
})();

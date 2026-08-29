(() => {
  'use strict';

  const CHECKOUT_URL = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi/payments/checkout';
  const STATUS_URL = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi/payments/status';
  const STORE = 'chillProsCanonicalCheckoutAttempt';
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

  function loadAttempt() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.uid || !parsed.invoiceId || !parsed.sessionId || !parsed.createdAt) return null;
      if (Date.now() - Number(parsed.createdAt) > MAX_AGE_MS) {
        sessionStorage.removeItem(STORE);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function rememberAttempt(uid, invoiceId, sessionId) {
    if (!uid || !invoiceId || !sessionId.startsWith('cs_')) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ uid, invoiceId, sessionId, createdAt: Date.now() }));
    } catch {}
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
      const response = await innerFetch(input, init);
      if (response.ok) {
        try {
          const data = await response.clone().json();
          const uid = currentUid();
          const invoiceId = String(data?.invoiceId || payload?.invoiceId || '').slice(0, 180);
          const sessionId = String(data?.checkoutSessionId || '').slice(0, 220);
          rememberAttempt(uid, invoiceId, sessionId);
        } catch {}
      }
      return response;
    }

    if (method === 'POST' && url === STATUS_URL) {
      const payload = await requestPayload(input, init);
      const requestedSessionId = String(payload?.checkoutSessionId || '').slice(0, 220);
      const attempt = loadAttempt();
      const uid = currentUid();
      if (!uid || !attempt || attempt.uid !== uid || attempt.sessionId !== requestedSessionId) {
        return rejectUnboundStatus();
      }

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

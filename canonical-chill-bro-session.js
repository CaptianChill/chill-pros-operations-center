(() => {
  'use strict';

  const CHAT_PREFIX = 'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi/chat';
  const innerFetch = window.fetch.bind(window);
  const issuedSessions = new Map();
  let observedUid;

  function requestUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      return input?.url || '';
    } catch {
      return '';
    }
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

  function authenticatedUid(input, init) {
    const fromToken = decodeUidFromBearer(requestHeaders(input, init).get('authorization'));
    if (fromToken) return fromToken;
    return String(window.chillProsAuth?.currentUser?.uid || '').slice(0, 180);
  }

  function remember(uid, sessionId) {
    if (!uid || !sessionId) return;
    let sessions = issuedSessions.get(uid);
    if (!sessions) {
      sessions = new Set();
      issuedSessions.set(uid, sessions);
    }
    sessions.add(sessionId);
    while (sessions.size > 8) sessions.delete(sessions.values().next().value);
  }

  function sessionIssuedTo(uid, sessionId) {
    return Boolean(uid && sessionId && issuedSessions.get(uid)?.has(sessionId));
  }

  window.chillProsAuth?.onAuthStateChanged?.((user) => {
    const nextUid = user?.uid || null;
    if (observedUid !== undefined && nextUid !== observedUid) issuedSessions.clear();
    observedUid = nextUid;
  });

  window.fetch = async function canonicalChillBroSessionFetch(input, init) {
    const url = requestUrl(input);
    if (!url.startsWith(CHAT_PREFIX) || String(init?.method || 'GET').toUpperCase() !== 'POST' || typeof init?.body !== 'string') {
      return innerFetch(input, init);
    }

    const uid = authenticatedUid(input, init);
    if (!uid) return innerFetch(input, init);

    let payload;
    try {
      payload = JSON.parse(init.body);
    } catch {
      return innerFetch(input, init);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return innerFetch(input, init);

    const requestedSessionId = String(payload.sessionId || '').slice(0, 120);
    let nextInit = init;
    if (requestedSessionId && !sessionIssuedTo(uid, requestedSessionId)) {
      payload = { ...payload };
      delete payload.sessionId;
      nextInit = { ...init, body: JSON.stringify(payload) };
    }

    const response = await innerFetch(input, nextInit);
    if (response.ok) {
      try {
        const data = await response.clone().json();
        const returnedSessionId = String(data?.sessionId || '').slice(0, 120);
        if (returnedSessionId && String(window.chillProsAuth?.currentUser?.uid || '') === uid) {
          remember(uid, returnedSessionId);
        }
      } catch {}
    }
    return response;
  };
})();

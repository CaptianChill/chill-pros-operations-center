(() => {
  'use strict';

  const API_KEY = 'AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc';
  const STORE = 'chillProsCanonicalSession';
  const listeners = new Set();
  let session = null;
  let sessionRevision = 0;
  let refreshInFlight = null;

  function decodeExp(token) {
    try {
      const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = raw + '='.repeat((4 - raw.length % 4) % 4);
      return Number(JSON.parse(atob(pad)).exp || 0) * 1000;
    } catch {
      return 0;
    }
  }

  function sessionExpiredError() {
    const error = new Error('Session expired. Sign in again.');
    error.code = 'SESSION_EXPIRED';
    return error;
  }

  function sessionChangedError() {
    const error = new Error('Authentication session changed. Retry the request.');
    error.code = 'SESSION_CHANGED';
    return error;
  }

  function parseStoredSession(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function load() {
    try {
      session = parseStoredSession(localStorage.getItem(STORE));
    } catch {
      session = null;
    }
  }

  function persist() {
    try {
      if (session) localStorage.setItem(STORE, JSON.stringify(session));
      else localStorage.removeItem(STORE);
    } catch {}
  }

  function user() {
    if (!session?.idToken) return null;
    const uid = session.localId || '';
    const email = session.email || '';
    return {
      uid,
      email,
      async getIdToken(forceRefresh = false) {
        if (!session?.idToken) throw sessionExpiredError();
        if (uid && session.localId && session.localId !== uid) throw sessionChangedError();
        if (forceRefresh || Date.now() >= decodeExp(session.idToken) - 60000) await refresh();
        if (!session?.idToken) throw sessionExpiredError();
        if (uid && session.localId && session.localId !== uid) throw sessionChangedError();
        return session.idToken;
      },
    };
  }

  function notify() {
    const current = user();
    listeners.forEach((fn) => {
      try { fn(current); } catch {}
    });
  }

  function sameSession(left, right) {
    return (left?.idToken || '') === (right?.idToken || '')
      && (left?.refreshToken || '') === (right?.refreshToken || '')
      && (left?.localId || '') === (right?.localId || '')
      && (left?.email || '') === (right?.email || '');
  }

  function adoptExternalSession(raw) {
    const next = parseStoredSession(raw);
    if (sameSession(session, next)) return;
    session = next;
    sessionRevision += 1;
    notify();
  }

  function clearSession() {
    session = null;
    sessionRevision += 1;
    persist();
    notify();
  }

  function terminalRefreshError(error) {
    const code = String(error?.code || error?.message || '');
    return /INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_GRANT|HTTP_400|HTTP_401/i.test(code);
  }

  async function fetchJson(url, options, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = data?.error?.message || `HTTP_${response.status}`;
        const error = new Error(code);
        error.code = code;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function refresh() {
    if (!session?.refreshToken) {
      if (session) clearSession();
      throw sessionExpiredError();
    }

    const refreshToken = session.refreshToken;
    const refreshRevision = sessionRevision;
    if (refreshInFlight?.revision === refreshRevision && refreshInFlight?.refreshToken === refreshToken) {
      return refreshInFlight.promise;
    }

    const promise = (async () => {
      try {
        const data = await fetchJson(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
        });

        if (sessionRevision !== refreshRevision || !session || session.refreshToken !== refreshToken) {
          throw sessionChangedError();
        }

        session = {
          ...session,
          idToken: data.id_token,
          refreshToken: data.refresh_token || session.refreshToken,
          localId: data.user_id || session.localId,
        };
        sessionRevision += 1;
        persist();
        return session;
      } catch (error) {
        const stillOwnsSession = sessionRevision === refreshRevision && Boolean(session) && session.refreshToken === refreshToken;
        if (terminalRefreshError(error) && stillOwnsSession) {
          clearSession();
          throw sessionExpiredError();
        }
        throw error;
      }
    })();

    refreshInFlight = { revision: refreshRevision, refreshToken, promise };
    try {
      return await promise;
    } finally {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    }
  }

  async function signInWithEmailAndPassword(email, password) {
    const signInRevision = sessionRevision;
    const data = await fetchJson(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    if (sessionRevision !== signInRevision) throw sessionChangedError();
    session = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      email: data.email,
      localId: data.localId,
    };
    sessionRevision += 1;
    persist();
    notify();
    return { user: user() };
  }

  async function signOut() {
    clearSession();
  }

  function onAuthStateChanged(fn) {
    listeners.add(fn);
    queueMicrotask(async () => {
      if (session?.refreshToken && Date.now() >= decodeExp(session.idToken) - 60000) {
        try { await refresh(); } catch {}
      }
      if (listeners.has(fn)) fn(user());
    });
    return () => listeners.delete(fn);
  }

  load();
  window.addEventListener?.('storage', (event) => {
    if (event.key !== STORE) return;
    if (event.storageArea && event.storageArea !== localStorage) return;
    adoptExternalSession(event.newValue);
  });

  window.chillProsAuth = {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    get currentUser() { return user(); },
  };
})();
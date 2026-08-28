(() => {
  'use strict';

  const API_KEY = 'AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc';
  const STORE = 'chillProsCanonicalSession';
  const listeners = new Set();
  let session = null;
  let refreshPromise = null;

  function decodeExp(token) {
    try {
      const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = raw + '='.repeat((4 - raw.length % 4) % 4);
      return Number(JSON.parse(atob(pad)).exp || 0) * 1000;
    } catch {
      return 0;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      session = raw ? JSON.parse(raw) : null;
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
    return {
      uid: session.localId || '',
      email: session.email || '',
      async getIdToken(forceRefresh = false) {
        if (forceRefresh || Date.now() >= decodeExp(session.idToken) - 60000) await refresh();
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

  function clearSession() {
    session = null;
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
      clearSession();
      const error = new Error('Session expired. Sign in again.');
      error.code = 'SESSION_EXPIRED';
      throw error;
    }
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const data = await fetchJson(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken }),
      });
      session = {
        ...session,
        idToken: data.id_token,
        refreshToken: data.refresh_token || session.refreshToken,
        localId: data.user_id || session.localId,
      };
      persist();
      return session;
    })();
    try {
      return await refreshPromise;
    } catch (error) {
      if (terminalRefreshError(error)) {
        clearSession();
        const expired = new Error('Session expired. Sign in again.');
        expired.code = 'SESSION_EXPIRED';
        throw expired;
      }
      throw error;
    } finally {
      refreshPromise = null;
    }
  }

  async function signInWithEmailAndPassword(email, password) {
    const data = await fetchJson(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    session = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      email: data.email,
      localId: data.localId,
    };
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
      fn(user());
    });
    return () => listeners.delete(fn);
  }

  load();
  window.chillProsAuth = {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    get currentUser() { return user(); },
  };
})();

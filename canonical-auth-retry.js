(() => {
  'use strict';

  const PROTECTED_APIS = [
    'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/nativeOpsApi/',
    'https://us-central1-chill-pros-ice-stream.cloudfunctions.net/chillBroApi/',
  ];
  const originalFetch = window.fetch.bind(window);
  let refreshPromise = null;

  function requestUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      return input?.url || '';
    } catch {
      return '';
    }
  }

  function isProtectedApi(url) {
    return PROTECTED_APIS.some((prefix) => String(url || '').startsWith(prefix));
  }

  function requestHeaders(input, init) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    return headers;
  }

  async function freshCanonicalToken() {
    const user = window.chillProsAuth?.currentUser;
    if (!user) throw new Error('No canonical session.');
    if (!refreshPromise) {
      refreshPromise = Promise.resolve(user.getIdToken(true)).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  window.fetch = async function canonicalFetchWithAuthRecovery(input, init) {
    const url = requestUrl(input);
    const retryable = isProtectedApi(url);
    const replayableInput = retryable && input instanceof Request ? input.clone() : input;
    const response = await originalFetch(input, init);

    if (!retryable || response.status !== 401) return response;

    const headers = requestHeaders(replayableInput, init);
    const authorization = headers.get('authorization') || '';
    if (!/^Bearer\s+.+/i.test(authorization)) return response;

    const user = window.chillProsAuth?.currentUser;
    if (!user) return response;

    let currentToken;
    try {
      currentToken = await user.getIdToken(false);
    } catch {
      return response;
    }

    if (authorization !== `Bearer ${currentToken}`) return response;

    let refreshedToken;
    try {
      refreshedToken = await freshCanonicalToken();
    } catch {
      return response;
    }
    if (!refreshedToken) return response;

    headers.set('Authorization', `Bearer ${refreshedToken}`);

    if (replayableInput instanceof Request) {
      return originalFetch(new Request(replayableInput, { ...init, headers }));
    }
    return originalFetch(replayableInput, { ...init, headers });
  };
})();

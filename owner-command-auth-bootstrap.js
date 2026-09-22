(function initOwnerCommandAuthBootstrap(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsOwnerCommandAuthBootstrap = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function ownerCommandAuthBootstrapFactory() {
  "use strict";

  const DEFAULT_AUTH_STATE_TIMEOUT_MS = 10000;

  function bootstrapError(code, message, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function reportCleanupFailure(error) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("Owner Command Center auth-state cleanup failed.", error);
    }
  }

  function waitForAuthState(auth, options) {
    return new Promise((resolve, reject) => {
      if (!auth || typeof auth.onAuthStateChanged !== "function") {
        reject(bootstrapError("auth/dependency-unavailable", "Firebase Authentication state monitoring is unavailable."));
        return;
      }

      const settings = options && typeof options === "object" ? options : {};
      const timeoutMs = Number.isFinite(settings.timeoutMs) && settings.timeoutMs > 0
        ? settings.timeoutMs
        : DEFAULT_AUTH_STATE_TIMEOUT_MS;
      const scheduleTimeout = typeof settings.setTimeout === "function" ? settings.setTimeout : setTimeout;
      const cancelTimeout = typeof settings.clearTimeout === "function" ? settings.clearTimeout : clearTimeout;
      let unsubscribe;
      let cleanupPending = false;
      let timeoutId;
      let settled = false;

      function cleanup() {
        if (timeoutId !== undefined) {
          const timerToCancel = timeoutId;
          timeoutId = undefined;
          try {
            cancelTimeout(timerToCancel);
          } catch (error) {
            reportCleanupFailure(error);
          }
        }
        if (typeof unsubscribe === "function") {
          const release = unsubscribe;
          unsubscribe = null;
          cleanupPending = false;
          try {
            release();
          } catch (error) {
            reportCleanupFailure(error);
          }
          return;
        }
        cleanupPending = true;
      }

      function resolveOnce(user) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(user || null);
      }

      function rejectOnce(cause) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(bootstrapError("auth/session-unavailable", "The authentication session could not be verified.", cause));
      }

      function rejectTimeout() {
        if (settled) return;
        settled = true;
        cleanup();
        reject(bootstrapError("auth/session-timeout", "The authentication session did not resolve in time."));
      }

      try {
        unsubscribe = auth.onAuthStateChanged(resolveOnce, rejectOnce);
        if (!settled && typeof unsubscribe !== "function") {
          rejectOnce(new TypeError("Firebase Authentication state monitoring did not return an unsubscribe function."));
        }
        if (cleanupPending) cleanup();
        if (!settled) {
          const scheduledTimeoutId = scheduleTimeout(rejectTimeout, timeoutMs);
          if (settled) {
            try {
              cancelTimeout(scheduledTimeoutId);
            } catch (error) {
              reportCleanupFailure(error);
            }
          } else {
            timeoutId = scheduledTimeoutId;
          }
        }
      } catch (cause) {
        rejectOnce(cause);
      }
    });
  }

  function requireDependency(value, label) {
    if (!value) throw bootstrapError("auth/dependency-unavailable", `${label} is unavailable.`);
    return value;
  }

  function createOwnerCommandAuthBootstrap(options) {
    const settings = options && typeof options === "object" ? options : {};
    const scope = requireDependency(settings.scope, "Browser scope");
    const authorizationApi = requireDependency(settings.authorizationApi, "Owner authorization module");
    if (typeof authorizationApi.authorizeOwnerSession !== "function") {
      throw bootstrapError("auth/dependency-unavailable", "Owner authorization function is unavailable.");
    }

    const onAuthorized = typeof settings.onAuthorized === "function" ? settings.onAuthorized : function noop() {};
    const onRejected = typeof settings.onRejected === "function" ? settings.onRejected : function noop() {};
    const authStateResolver = typeof settings.waitForAuthState === "function"
      ? settings.waitForAuthState
      : waitForAuthState;
    const authStateOptions = Object.freeze({
      timeoutMs: settings.authStateTimeoutMs,
      setTimeout: settings.setTimeout,
      clearTimeout: settings.clearTimeout
    });
    let state = "idle";

    async function start() {
      if (state !== "idle") {
        throw bootstrapError("auth/bootstrap-already-started", "Owner authorization bootstrap has already started.");
      }
      state = "running";

      try {
        const firebase = requireDependency(scope.firebase, "Firebase SDK");
        if (typeof firebase.auth !== "function" || typeof firebase.firestore !== "function") {
          throw bootstrapError("auth/dependency-unavailable", "Firebase Authentication and Firestore SDKs are required.");
        }

        const auth = settings.auth || firebase.auth();
        const firestore = settings.firestore || firebase.firestore();
        const session = await authorizationApi.authorizeOwnerSession({
          auth,
          firestore,
          profileTimeoutMs: settings.profileTimeoutMs,
          setTimeout: settings.setTimeout,
          clearTimeout: settings.clearTimeout,
          waitForAuthState(currentAuth) {
            return authStateResolver(currentAuth, authStateOptions);
          }
        });

        await onAuthorized(session);
        state = "authorized";
        return session;
      } catch (error) {
        state = "idle";
        try {
          await onRejected(error);
        } catch (handlerError) {
          if (scope.console && typeof scope.console.error === "function") {
            scope.console.error("Owner authorization rejection handler failed.", handlerError);
          }
        }
        throw error;
      }
    }

    return Object.freeze({ start });
  }

  return Object.freeze({ createOwnerCommandAuthBootstrap, waitForAuthState });
});

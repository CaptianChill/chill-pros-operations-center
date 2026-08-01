(function initOwnerCommandAuthBootstrap(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsOwnerCommandAuthBootstrap = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function ownerCommandAuthBootstrapFactory() {
  "use strict";

  function bootstrapError(code, message, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function waitForAuthState(auth) {
    return new Promise((resolve, reject) => {
      if (!auth || typeof auth.onAuthStateChanged !== "function") {
        reject(bootstrapError("auth/dependency-unavailable", "Firebase Authentication state monitoring is unavailable."));
        return;
      }

      let unsubscribe;
      try {
        unsubscribe = auth.onAuthStateChanged(
          (user) => {
            if (typeof unsubscribe === "function") unsubscribe();
            resolve(user || null);
          },
          (cause) => {
            if (typeof unsubscribe === "function") unsubscribe();
            reject(bootstrapError("auth/session-unavailable", "The authentication session could not be verified.", cause));
          }
        );
      } catch (cause) {
        reject(bootstrapError("auth/session-unavailable", "The authentication session could not be verified.", cause));
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
    let started = false;

    async function start() {
      if (started) throw bootstrapError("auth/bootstrap-already-started", "Owner authorization bootstrap has already started.");
      started = true;

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
          waitForAuthState: settings.waitForAuthState || waitForAuthState
        });

        await onAuthorized(session);
        return session;
      } catch (error) {
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

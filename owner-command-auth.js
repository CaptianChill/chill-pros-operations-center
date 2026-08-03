(function initOwnerCommandAuth(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsOwnerCommandAuth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function ownerCommandAuthFactory() {
  "use strict";

  const OWNER_ROLE = "owner";
  const DEFAULT_PROFILE_TIMEOUT_MS = 10000;
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  function authError(code, message, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function requireFunction(value, label) {
    if (typeof value !== "function") {
      throw authError("auth/dependency-unavailable", `${label} is unavailable.`);
    }
    return value;
  }

  function preserveAuthError(cause, fallbackCode, fallbackMessage) {
    if (cause && typeof cause.code === "string" && cause.code.startsWith("auth/")) {
      return cause;
    }
    return authError(fallbackCode, fallbackMessage, cause);
  }

  function reportTimerCleanupFailure(error) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("Owner Command Center profile timer cleanup failed.", error);
    }
  }

  function normalizeProfile(snapshot) {
    let exists;
    try {
      exists = snapshot && snapshot.exists;
    } catch (cause) {
      throw authError(
        "auth/owner-profile-invalid",
        "The owner profile is malformed.",
        cause
      );
    }

    if (typeof exists !== "boolean" || !exists) {
      throw authError("auth/owner-profile-missing", "The signed-in account has no authoritative owner profile.");
    }

    let data;
    try {
      data = typeof snapshot.data === "function" ? snapshot.data() : null;
    } catch (cause) {
      throw authError(
        "auth/owner-profile-invalid",
        "The owner profile is malformed.",
        cause
      );
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw authError("auth/owner-profile-invalid", "The owner profile is malformed.");
    }

    let role;
    try {
      role = hasOwn(data, "role") ? data.role : undefined;
    } catch (cause) {
      throw authError(
        "auth/owner-profile-invalid",
        "The owner profile is malformed.",
        cause
      );
    }

    if (role !== OWNER_ROLE) {
      throw authError("auth/not-owner-account", "This account is not authorized for the Owner Command Center.");
    }
    return Object.freeze({ role: OWNER_ROLE });
  }

  function waitForProfileSnapshot(profileRef, options) {
    const settings = options && typeof options === "object" ? options : {};
    const timeoutMs = Number.isFinite(settings.timeoutMs) && settings.timeoutMs > 0
      ? settings.timeoutMs
      : DEFAULT_PROFILE_TIMEOUT_MS;
    const scheduleTimeout = typeof settings.setTimeout === "function" ? settings.setTimeout : setTimeout;
    const cancelTimeout = typeof settings.clearTimeout === "function" ? settings.clearTimeout : clearTimeout;

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId;

      function settle(callback, value) {
        if (settled) return;
        settled = true;
        if (timeoutId !== undefined) {
          const timerToCancel = timeoutId;
          timeoutId = undefined;
          try {
            cancelTimeout(timerToCancel);
          } catch (error) {
            reportTimerCleanupFailure(error);
          }
        }
        callback(value);
      }

      timeoutId = scheduleTimeout(() => {
        settle(reject, authError(
          "auth/owner-profile-timeout",
          "The owner profile verification did not resolve in time."
        ));
      }, timeoutMs);

      Promise.resolve()
        .then(() => profileRef.get())
        .then(
          snapshot => settle(resolve, snapshot),
          cause => settle(reject, cause)
        );
    });
  }

  async function rejectSession(auth, error) {
    try {
      if (auth && typeof auth.signOut === "function") await auth.signOut();
    } catch (signOutError) {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error("Owner Command Center sign-out failed after authorization rejection.", signOutError);
      }
    }
    throw error;
  }

  function sessionMatches(auth, uid) {
    try {
      const currentUser = auth && auth.currentUser;
      return Boolean(
        currentUser &&
        typeof currentUser.uid === "string" &&
        currentUser.uid === uid
      );
    } catch (cause) {
      return false;
    }
  }

  async function authorizeOwnerSession(options) {
    const settings = options && typeof options === "object" ? options : {};
    const auth = settings.auth;
    const firestore = settings.firestore;

    if (!auth || !firestore) {
      throw authError("auth/dependency-unavailable", "Firebase Authentication and Firestore are required.");
    }

    const waitForAuthState = requireFunction(settings.waitForAuthState, "Authentication state resolver");
    let user;
    try {
      user = await waitForAuthState(auth);
    } catch (cause) {
      throw preserveAuthError(
        cause,
        "auth/session-unavailable",
        "The current authentication session could not be verified."
      );
    }

    let uid;
    try {
      uid = user && user.uid;
    } catch (cause) {
      return rejectSession(auth, authError(
        "auth/session-changed",
        "The authenticated account changed before owner access could be verified. Sign in again.",
        cause
      ));
    }

    if (
      typeof uid !== "string" ||
      !uid.trim() ||
      uid.trim() !== uid
    ) {
      throw authError("auth/signed-out", "Sign in with the owner account to continue.");
    }

    if (!sessionMatches(auth, uid)) {
      return rejectSession(auth, authError(
        "auth/session-changed",
        "The authenticated account changed before owner access could be verified. Sign in again."
      ));
    }

    let snapshot;
    try {
      const usersCollection = requireFunction(firestore.collection, "Firestore collection resolver").call(firestore, "Users");
      if (!usersCollection || typeof usersCollection.doc !== "function") {
        throw authError("auth/dependency-unavailable", "Firestore user profile lookup is unavailable.");
      }
      const profileRef = usersCollection.doc(uid);
      if (!profileRef || typeof profileRef.get !== "function") {
        throw authError("auth/dependency-unavailable", "Firestore owner profile lookup is unavailable.");
      }
      snapshot = await waitForProfileSnapshot(profileRef, {
        timeoutMs: settings.profileTimeoutMs,
        setTimeout: settings.setTimeout,
        clearTimeout: settings.clearTimeout
      });
    } catch (cause) {
      const error = preserveAuthError(
        cause,
        "auth/owner-profile-unavailable",
        "The owner profile could not be verified. Retry after checking network access and Firestore rules."
      );
      return rejectSession(auth, error);
    }

    let profile;
    try {
      profile = normalizeProfile(snapshot);
    } catch (error) {
      return rejectSession(auth, error);
    }

    if (!sessionMatches(auth, uid)) {
      return rejectSession(auth, authError(
        "auth/session-changed",
        "The authenticated account changed while owner access was being verified. Sign in again."
      ));
    }

    return Object.freeze({
      authorized: true,
      uid,
      role: profile.role
    });
  }

  return Object.freeze({ authorizeOwnerSession, normalizeProfile, waitForProfileSnapshot });
});

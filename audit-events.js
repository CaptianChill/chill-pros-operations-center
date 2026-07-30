(function initAuditEvents(globalScope) {
  "use strict";

  const ALLOWED_ACTOR_ROLES = new Set(["owner", "office"]);
  const RESERVED_METADATA_FIELDS = new Set([
    "actorUid",
    "actorRole",
    "action",
    "targetPath",
    "createdAt"
  ]);
  const MAX_ACTION_LENGTH = 100;
  const MAX_TARGET_PATH_LENGTH = 500;
  const MAX_METADATA_KEYS = 25;

  function requireBoundedString(value, fieldName, maxLength) {
    const normalized = String(value || "").trim();
    if (!normalized) throw new Error(`${fieldName} is required`);
    if (normalized.length > maxLength) {
      throw new Error(`${fieldName} exceeds ${maxLength} characters`);
    }
    return normalized;
  }

  function normalizeMetadata(metadata) {
    if (metadata == null) return undefined;
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new Error("metadata must be a plain object");
    }

    const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
    const reservedFields = entries
      .map(([key]) => key)
      .filter((key) => RESERVED_METADATA_FIELDS.has(key));
    if (reservedFields.length) {
      throw new Error(`metadata contains reserved audit fields: ${reservedFields.join(", ")}`);
    }
    if (entries.length > MAX_METADATA_KEYS) {
      throw new Error(`metadata exceeds ${MAX_METADATA_KEYS} keys`);
    }
    return Object.fromEntries(entries);
  }

  function createAuditEventWriter({ db, auth, serverTimestamp }) {
    if (!db || typeof db.collection !== "function") throw new Error("Firestore db is required");
    if (!auth) throw new Error("Firebase auth is required");
    if (typeof serverTimestamp !== "function") throw new Error("serverTimestamp is required");

    return async function writeAuditEvent({ action, targetPath, metadata }) {
      const user = auth.currentUser;
      if (!user?.uid) throw new Error("Authenticated user is required");

      const profileSnapshot = await db.collection("Users").doc(user.uid).get();
      if (!profileSnapshot.exists) throw new Error("Authoritative user profile is required");

      const actorRole = profileSnapshot.data()?.role;
      if (!ALLOWED_ACTOR_ROLES.has(actorRole)) {
        throw new Error("Only owner or office users may create audit events");
      }

      const event = {
        actorUid: user.uid,
        actorRole,
        action: requireBoundedString(action, "action", MAX_ACTION_LENGTH),
        targetPath: requireBoundedString(targetPath, "targetPath", MAX_TARGET_PATH_LENGTH),
        createdAt: serverTimestamp()
      };

      const normalizedMetadata = normalizeMetadata(metadata);
      if (normalizedMetadata !== undefined) event.metadata = normalizedMetadata;

      const reference = await db.collection("AuditEvents").add(event);
      return reference.id;
    };
  }

  const api = {
    createAuditEventWriter,
    normalizeMetadata,
    requireBoundedString
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsAuditEvents = api;
})(typeof window !== "undefined" ? window : globalThis);

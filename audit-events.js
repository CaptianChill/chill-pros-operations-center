(function initAuditEvents(globalScope) {
  "use strict";

  const ALLOWED_ACTOR_ROLES = new Set(["owner", "office"]);
  const ALLOWED_METADATA_FIELDS = new Set(["source", "workflow", "context", "changedFields"]);
  const RESERVED_METADATA_FIELDS = new Set([
    "actorUid",
    "actorRole",
    "action",
    "targetPath",
    "createdAt"
  ]);
  const SENSITIVE_METADATA_FIELD_PATTERN = /^(authorization|cookie|credentials?|password|secret|token|accessToken|refreshToken|idToken|apiKey|api_key|privateKey|private_key|seedPhrase|seed_phrase)$/i;
  const MAX_ACTION_LENGTH = 100;
  const MAX_TARGET_PATH_LENGTH = 500;
  const MAX_METADATA_KEYS = 25;
  const MAX_METADATA_DEPTH = 5;

  function requireBoundedString(value, fieldName, maxLength) {
    if (typeof value !== "string") throw new Error(`${fieldName} must be a string`);
    const normalized = value.trim();
    if (!normalized) throw new Error(`${fieldName} is required`);
    if (normalized.length > maxLength) {
      throw new Error(`${fieldName} exceeds ${maxLength} characters`);
    }
    return normalized;
  }

  function isPlainObject(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function inspectMetadata(value, path = "metadata", depth = 0, seen = new Set(), state = { keyCount: 0, unsafePaths: [] }) {
    if (value === null) return state;

    const valueType = typeof value;
    if (valueType !== "object") {
      if (valueType === "undefined" || valueType === "function" || valueType === "symbol" || valueType === "bigint") {
        throw new Error(`${path} contains an unsupported Firestore value`);
      }
      if (valueType === "number" && !Number.isFinite(value)) {
        throw new Error(`${path} must contain a finite number`);
      }
      return state;
    }

    if (depth > MAX_METADATA_DEPTH) {
      throw new Error(`metadata exceeds ${MAX_METADATA_DEPTH} nested levels`);
    }
    if (seen.has(value)) throw new Error("metadata must not contain circular references");
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        inspectMetadata(item, `${path}[${index}]`, depth + 1, seen, state);
      });
    } else {
      if (!isPlainObject(value)) throw new Error(`${path} must contain only plain objects and arrays`);
      Object.entries(value).forEach(([key, item]) => {
        state.keyCount += 1;
        if (state.keyCount > MAX_METADATA_KEYS) {
          throw new Error(`metadata exceeds ${MAX_METADATA_KEYS} keys total`);
        }
        const fieldPath = `${path}.${key}`;
        if (RESERVED_METADATA_FIELDS.has(key) || SENSITIVE_METADATA_FIELD_PATTERN.test(key)) {
          state.unsafePaths.push(fieldPath);
        }
        inspectMetadata(item, fieldPath, depth + 1, seen, state);
      });
    }

    seen.delete(value);
    return state;
  }

  function collectUnsafeMetadataPaths(value, path = "metadata", depth = 0, seen = new Set()) {
    return inspectMetadata(value, path, depth, seen).unsafePaths;
  }

  function validateMetadataSchema(metadata) {
    const unknownFields = Object.keys(metadata).filter((field) => !ALLOWED_METADATA_FIELDS.has(field));
    if (unknownFields.length) {
      throw new Error(`metadata contains unsupported fields: ${unknownFields.join(", ")}`);
    }

    const normalized = {};
    if ("source" in metadata) normalized.source = requireBoundedString(metadata.source, "metadata.source", 100);
    if ("workflow" in metadata) normalized.workflow = requireBoundedString(metadata.workflow, "metadata.workflow", 100);
    if ("context" in metadata) normalized.context = requireBoundedString(metadata.context, "metadata.context", 500);
    if ("changedFields" in metadata) {
      if (!Array.isArray(metadata.changedFields)) throw new Error("metadata.changedFields must be an array");
      if (metadata.changedFields.length > 25) throw new Error("metadata.changedFields exceeds 25 entries");
      normalized.changedFields = metadata.changedFields.map((field, index) =>
        requireBoundedString(field, `metadata.changedFields[${index}]`, 100)
      );
    }
    return normalized;
  }

  function normalizeMetadata(metadata) {
    if (metadata == null) return undefined;
    if (!isPlainObject(metadata)) {
      throw new Error("metadata must be a plain object");
    }

    const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
    const normalized = validateMetadataSchema(Object.fromEntries(entries));
    const unsafePaths = collectUnsafeMetadataPaths(normalized);
    if (unsafePaths.length) {
      throw new Error(`metadata contains reserved or sensitive audit fields: ${unsafePaths.join(", ")}`);
    }
    return normalized;
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
    collectUnsafeMetadataPaths,
    createAuditEventWriter,
    normalizeMetadata,
    requireBoundedString,
    validateMetadataSchema
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsAuditEvents = api;
})(typeof window !== "undefined" ? window : globalThis);

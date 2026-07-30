(function initAuditedCustomerMutations(globalScope) {
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
    const normalized = String(value || "").trim();
    if (!normalized) throw new Error(`${fieldName} is required`);
    if (normalized.length > maxLength) throw new Error(`${fieldName} exceeds ${maxLength} characters`);
    return normalized;
  }

  function requireDocumentId(value) {
    const documentId = String(value || "").trim();
    if (!documentId) throw new Error("Customer document ID is required");
    if (documentId.includes("/")) throw new Error("Customer document ID must not contain a slash");
    return documentId;
  }

  function isPlainObject(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function requirePlainObject(value, fieldName) {
    if (!isPlainObject(value)) throw new Error(`${fieldName} must be a plain object`);
    if (!Object.keys(value).length) throw new Error(`${fieldName} is required`);
    return value;
  }

  function inspectMetadata(value, path = "metadata", depth = 0, seen = new Set(), state = { keyCount: 0, unsafePaths: [] }) {
    if (value === null) return state;
    const valueType = typeof value;
    if (valueType !== "object") {
      if (valueType === "undefined" || valueType === "function" || valueType === "symbol" || valueType === "bigint") {
        throw new Error(`${path} contains an unsupported Firestore value`);
      }
      if (valueType === "number" && !Number.isFinite(value)) throw new Error(`${path} must contain a finite number`);
      return state;
    }
    if (depth > MAX_METADATA_DEPTH) throw new Error(`metadata exceeds ${MAX_METADATA_DEPTH} nested levels`);
    if (seen.has(value)) throw new Error("metadata must not contain circular references");
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspectMetadata(item, `${path}[${index}]`, depth + 1, seen, state));
    } else {
      if (!isPlainObject(value)) throw new Error(`${path} must contain only plain objects and arrays`);
      Object.entries(value).forEach(([key, item]) => {
        state.keyCount += 1;
        if (state.keyCount > MAX_METADATA_KEYS) throw new Error(`metadata exceeds ${MAX_METADATA_KEYS} keys total`);
        const fieldPath = `${path}.${key}`;
        if (RESERVED_METADATA_FIELDS.has(key) || SENSITIVE_METADATA_FIELD_PATTERN.test(key)) state.unsafePaths.push(fieldPath);
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
    if (unknownFields.length) throw new Error(`metadata contains unsupported fields: ${unknownFields.join(", ")}`);
    if ("source" in metadata) requireBoundedString(metadata.source, "metadata.source", 100);
    if ("workflow" in metadata) requireBoundedString(metadata.workflow, "metadata.workflow", 100);
    if ("context" in metadata) requireBoundedString(metadata.context, "metadata.context", 500);
    if ("changedFields" in metadata) {
      if (!Array.isArray(metadata.changedFields)) throw new Error("metadata.changedFields must be an array");
      if (metadata.changedFields.length > 25) throw new Error("metadata.changedFields exceeds 25 entries");
      metadata.changedFields.forEach((field, index) => requireBoundedString(field, `metadata.changedFields[${index}]`, 100));
    }
  }

  function normalizeMetadata(metadata) {
    if (metadata == null) return undefined;
    if (!isPlainObject(metadata)) throw new Error("metadata must be a plain object");
    const normalized = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
    validateMetadataSchema(normalized);
    const unsafePaths = collectUnsafeMetadataPaths(normalized);
    if (unsafePaths.length) throw new Error(`metadata contains reserved or sensitive audit fields: ${unsafePaths.join(", ")}`);
    return normalized;
  }

  function createAuditedCustomerMutations({ db, auth, serverTimestamp }) {
    if (!db || typeof db.collection !== "function" || typeof db.batch !== "function") throw new Error("Firestore db with batch support is required");
    if (!auth) throw new Error("Firebase auth is required");
    if (typeof serverTimestamp !== "function") throw new Error("serverTimestamp is required");

    async function authoritativeActor() {
      const user = auth.currentUser;
      if (!user?.uid) throw new Error("Authenticated user is required");
      const profileSnapshot = await db.collection("Users").doc(user.uid).get();
      if (!profileSnapshot.exists) throw new Error("Authoritative user profile is required");
      const actorRole = profileSnapshot.data()?.role;
      if (!ALLOWED_ACTOR_ROLES.has(actorRole)) throw new Error("Only owner or office users may mutate customer records");
      return { actorUid: user.uid, actorRole };
    }

    function auditPayload(actor, action, targetPath, metadata) {
      const payload = {
        ...actor,
        action: requireBoundedString(action, "action", MAX_ACTION_LENGTH),
        targetPath: requireBoundedString(targetPath, "targetPath", MAX_TARGET_PATH_LENGTH),
        createdAt: serverTimestamp()
      };
      const normalizedMetadata = normalizeMetadata(metadata);
      if (normalizedMetadata !== undefined) payload.metadata = normalizedMetadata;
      return payload;
    }

    async function createCustomer(customer, { metadata } = {}) {
      const payload = requirePlainObject(customer, "Customer record");
      const actor = await authoritativeActor();
      const customerRef = db.collection("Customers").doc();
      const documentId = requireDocumentId(customerRef?.id);
      const auditRef = db.collection("AuditEvents").doc();
      const batch = db.batch();
      batch.set(customerRef, payload);
      batch.set(auditRef, auditPayload(actor, "customer.created", `Customers/${documentId}`, metadata));
      await batch.commit();
      return documentId;
    }

    async function updateCustomer(documentIdValue, changes, { action = "customer.updated", metadata } = {}) {
      const documentId = requireDocumentId(documentIdValue);
      requirePlainObject(changes, "Customer changes");
      const actor = await authoritativeActor();
      const customerRef = db.collection("Customers").doc(documentId);
      const auditRef = db.collection("AuditEvents").doc();
      const batch = db.batch();
      batch.set(customerRef, changes, { merge: true });
      batch.set(auditRef, auditPayload(actor, action, `Customers/${documentId}`, metadata));
      await batch.commit();
      return auditRef.id;
    }

    async function deleteCustomer(documentIdValue, { metadata } = {}) {
      const documentId = requireDocumentId(documentIdValue);
      const actor = await authoritativeActor();
      const customerRef = db.collection("Customers").doc(documentId);
      const auditRef = db.collection("AuditEvents").doc();
      const batch = db.batch();
      batch.delete(customerRef);
      batch.set(auditRef, auditPayload(actor, "customer.deleted", `Customers/${documentId}`, metadata));
      await batch.commit();
      return auditRef.id;
    }

    return { createCustomer, updateCustomer, deleteCustomer };
  }

  const api = {
    collectUnsafeMetadataPaths,
    createAuditedCustomerMutations,
    normalizeMetadata,
    requireBoundedString,
    requireDocumentId,
    requirePlainObject,
    validateMetadataSchema
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsAuditedCustomerMutations = api;
})(typeof window !== "undefined" ? window : globalThis);
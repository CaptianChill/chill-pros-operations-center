(function initAuditedCustomerMutations(globalScope) {
  "use strict";

  const ALLOWED_ACTOR_ROLES = new Set(["owner", "office"]);
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

  function requireDocumentId(value) {
    const documentId = String(value || "").trim();
    if (!documentId) throw new Error("Customer document ID is required");
    if (documentId.includes("/")) throw new Error("Customer document ID must not contain a slash");
    return documentId;
  }

  function requirePlainObject(value, fieldName) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${fieldName} must be a plain object`);
    }
    if (!Object.keys(value).length) throw new Error(`${fieldName} is required`);
    return value;
  }

  function normalizeMetadata(metadata) {
    if (metadata == null) return undefined;
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new Error("metadata must be a plain object");
    }
    const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
    if (entries.length > MAX_METADATA_KEYS) {
      throw new Error(`metadata exceeds ${MAX_METADATA_KEYS} keys`);
    }
    return Object.fromEntries(entries);
  }

  function createAuditedCustomerMutations({ db, auth, serverTimestamp }) {
    if (!db || typeof db.collection !== "function" || typeof db.batch !== "function") {
      throw new Error("Firestore db with batch support is required");
    }
    if (!auth) throw new Error("Firebase auth is required");
    if (typeof serverTimestamp !== "function") throw new Error("serverTimestamp is required");

    async function authoritativeActor() {
      const user = auth.currentUser;
      if (!user?.uid) throw new Error("Authenticated user is required");

      const profileSnapshot = await db.collection("Users").doc(user.uid).get();
      if (!profileSnapshot.exists) throw new Error("Authoritative user profile is required");

      const actorRole = profileSnapshot.data()?.role;
      if (!ALLOWED_ACTOR_ROLES.has(actorRole)) {
        throw new Error("Only owner or office users may mutate customer records");
      }
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
    createAuditedCustomerMutations,
    normalizeMetadata,
    requireBoundedString,
    requireDocumentId,
    requirePlainObject
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsAuditedCustomerMutations = api;
})(typeof window !== "undefined" ? window : globalThis);

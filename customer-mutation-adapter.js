(function initCustomerMutationAdapter(globalScope) {
  "use strict";

  const adapterCache = new WeakMap();

  function requireScope(scope) {
    if (!scope || (typeof scope !== "object" && typeof scope !== "function")) {
      throw new Error("Browser scope is required");
    }
    return scope;
  }

  function resolveFirebaseDependencies(scope = globalScope) {
    requireScope(scope);
    const firebase = scope.firebase;
    const db = scope.chillProsDb;
    const auth = scope.chillProsAuth || (firebase?.auth ? firebase.auth() : null);
    const serverTimestamp = firebase?.firestore?.FieldValue?.serverTimestamp;
    const factory = scope.ChillProsAuditedCustomerMutations?.createAuditedCustomerMutations;

    if (!db) throw new Error("Firestore is unavailable");
    if (!auth) throw new Error("Firebase Auth is unavailable");
    if (typeof serverTimestamp !== "function") {
      throw new Error("Firestore server timestamp is unavailable");
    }
    if (typeof factory !== "function") {
      throw new Error("Audited customer mutation helper is unavailable");
    }

    return { db, auth, serverTimestamp, factory };
  }

  function createCustomerMutationAdapter(scope = globalScope) {
    const { db, auth, serverTimestamp, factory } = resolveFirebaseDependencies(scope);
    const mutations = factory({ db, auth, serverTimestamp });

    return {
      async updateCustomer(record, changes, options = {}) {
        const documentId = record?.firestoreId || record?.id;
        const auditId = await mutations.updateCustomer(documentId, changes, options);
        if (record && documentId) record.firestoreId = documentId;
        return auditId;
      },

      async deleteCustomer(record, options = {}) {
        const documentId = record?.firestoreId || record?.id;
        return mutations.deleteCustomer(documentId, options);
      }
    };
  }

  function getCustomerMutationAdapter(scope = globalScope) {
    requireScope(scope);
    if (!adapterCache.has(scope)) {
      adapterCache.set(scope, createCustomerMutationAdapter(scope));
    }
    return adapterCache.get(scope);
  }

  const api = {
    createCustomerMutationAdapter,
    getCustomerMutationAdapter,
    resolveFirebaseDependencies
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsCustomerMutationAdapter = api;
})(typeof window !== "undefined" ? window : globalThis);

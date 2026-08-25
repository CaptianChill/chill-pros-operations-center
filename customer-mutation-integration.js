(function initCustomerMutationIntegration(globalScope) {
  "use strict";

  function requireRecordDocumentId(record) {
    const documentId = String(record?.firestoreId || record?.id || "").trim();
    if (!documentId) throw new Error("Customer document ID is required");
    return documentId;
  }

  function summarizeChangedFields(changes) {
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
      throw new Error("Customer changes must be a plain object");
    }
    return Object.keys(changes).sort();
  }

  function captureRecordFields(record, changedFields) {
    if (!record || typeof record !== "object") {
      throw new Error("Customer record is required");
    }

    return changedFields.map((field) => ({
      field,
      existed: Object.prototype.hasOwnProperty.call(record, field),
      value: record[field]
    }));
  }

  function restoreRecordFields(record, snapshot) {
    snapshot.forEach(({ field, existed, value }) => {
      if (existed) record[field] = value;
      else delete record[field];
    });
  }

  function createQueueMutationIntegration({ adapter, scope = globalScope } = {}) {
    if (!adapter || typeof adapter.updateCustomer !== "function" || typeof adapter.deleteCustomer !== "function") {
      throw new Error("Audited customer mutation adapter is required");
    }

    async function updateCustomer(record, changes, options = {}) {
      const documentId = requireRecordDocumentId(record);
      const changedFields = summarizeChangedFields(changes);
      if (!changedFields.length) throw new Error("Customer changes are required");

      const action = String(options.action || "customer.updated").trim();
      const metadata = {
        source: String(options.source || "operations-center").trim(),
        changedFields,
        ...(options.metadata || {})
      };

      const auditEventId = await adapter.updateCustomer(documentId, changes, { action, metadata });
      if (record && typeof record === "object") record.firestoreId = documentId;
      return auditEventId;
    }

    async function updateCustomerOptimistically(record, changes, options = {}) {
      const changedFields = summarizeChangedFields(changes);
      if (!changedFields.length) throw new Error("Customer changes are required");
      const snapshot = captureRecordFields(record, changedFields);
      Object.assign(record, changes);

      try {
        return await updateCustomer(record, changes, options);
      } catch (error) {
        restoreRecordFields(record, snapshot);
        throw error;
      }
    }

    async function deleteCustomer(record, options = {}) {
      const documentId = requireRecordDocumentId(record);
      const metadata = {
        source: String(options.source || "operations-center").trim(),
        ...(options.metadata || {})
      };
      return adapter.deleteCustomer(documentId, { metadata });
    }

    return { updateCustomer, updateCustomerOptimistically, deleteCustomer };
  }

  function createBrowserQueueMutationIntegration(scope = globalScope) {
    const factory = scope?.ChillProsCustomerMutationAdapter?.createBrowserCustomerMutationAdapter;
    if (typeof factory !== "function") {
      throw new Error("Customer mutation adapter factory is unavailable");
    }
    return createQueueMutationIntegration({ adapter: factory(scope), scope });
  }

  const api = {
    captureRecordFields,
    createBrowserQueueMutationIntegration,
    createQueueMutationIntegration,
    requireRecordDocumentId,
    restoreRecordFields,
    summarizeChangedFields
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsCustomerMutationIntegration = api;
})(typeof window !== "undefined" ? window : globalThis);

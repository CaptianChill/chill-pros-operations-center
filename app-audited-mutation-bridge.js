(function initAppAuditedMutationBridge(globalScope) {
  "use strict";

  const INSTALL_MARKER = "__chillProsAuditedMutationBridgeInstalled";
  const PRICING_FIELDS = new Set([
    "cost",
    "internalCost",
    "unitCost",
    "supplierCost",
    "supplierPrice",
    "markup",
    "margin",
    "profit",
    "estimatedAmount",
    "quotedAmount",
    "salePrice",
    "priceOverride",
    "discount"
  ]);
  const APPROVAL_FIELDS = new Set([
    "approvalStatus",
    "approvedAt",
    "approvedBy",
    "quoteApprovalStatus",
    "overrideApprovedAt",
    "overrideApprovedBy"
  ]);
  const ORDER_FIELDS = new Set([
    "orderStatus",
    "partsOrderStatus",
    "purchaseOrderStatus",
    "orderedAt",
    "receivedAt"
  ]);

  function requireGateway(scope) {
    const gateway = scope?.chillProsCustomerMutations;
    if (
      !gateway ||
      typeof gateway.createCustomer !== "function" ||
      typeof gateway.updateCustomer !== "function" ||
      typeof gateway.deleteCustomer !== "function"
    ) {
      throw new Error("Authenticated audited customer mutation gateway is unavailable");
    }
    return gateway;
  }

  function hasAnyField(fields, candidates) {
    return fields.some((field) => candidates.has(field));
  }

  function classifyUpdateAction(changes) {
    const fields = Object.keys(changes || {});
    if (hasAnyField(fields, PRICING_FIELDS)) return "customer.pricing.updated";
    if (hasAnyField(fields, APPROVAL_FIELDS)) return "customer.approval.updated";
    if (hasAnyField(fields, ORDER_FIELDS)) return "customer.order-status.updated";
    if (fields.includes("assignedTechnician") || fields.includes("scheduledDate") || fields.includes("scheduledTime")) {
      return "customer.schedule.updated";
    }
    if (fields.includes("officeStatus")) return "customer.status.updated";
    return "customer.updated";
  }

  function getQueueStorageKey(scope) {
    const tenantId = scope?.FIELD_FORGED_CONFIG?.tenant?.id;
    return tenantId ? `fieldForged:${tenantId}:operations-center:v3` : "";
  }

  function readStoredRecord(scope, record) {
    const storageKey = getQueueStorageKey(scope);
    const storage = scope?.localStorage;
    if (!storageKey || !storage || typeof storage.getItem !== "function") return null;

    try {
      const queue = JSON.parse(storage.getItem(storageKey) || "[]");
      if (!Array.isArray(queue)) return null;
      const recordIds = new Set([record?.firestoreId, record?.id].filter(Boolean));
      return queue.find((candidate) => recordIds.has(candidate?.firestoreId) || recordIds.has(candidate?.id)) || null;
    } catch (error) {
      console.warn("Unable to read optimistic rollback snapshot:", error);
      return null;
    }
  }

  function snapshotChangedFields(scope, record, changes) {
    const storedRecord = readStoredRecord(scope, record);
    const source = storedRecord || record || {};
    const snapshot = {};

    Object.keys(changes || {}).forEach((field) => {
      snapshot[field] = {
        existed: Object.prototype.hasOwnProperty.call(source, field),
        value: source[field]
      };
    });
    return snapshot;
  }

  function restoreChangedFields(record, snapshot) {
    if (!record || typeof record !== "object") return;
    Object.entries(snapshot || {}).forEach(([field, previous]) => {
      if (previous.existed) record[field] = previous.value;
      else delete record[field];
    });
  }

  function reconcileRollback(scope) {
    if (!scope || typeof scope.persistQueue !== "function") return false;
    try {
      scope.persistQueue();
      return true;
    } catch (error) {
      console.error("Unable to reconcile rolled-back queue state:", error);
      return false;
    }
  }

  function emitRollback(scope, record, changes, error) {
    if (!scope || typeof scope.dispatchEvent !== "function" || typeof scope.CustomEvent !== "function") return;
    scope.dispatchEvent(new scope.CustomEvent("chillpros:customer-mutation-rollback", {
      detail: {
        record,
        changedFields: Object.keys(changes || {}),
        error: error instanceof Error ? error.message : String(error || "Mutation failed")
      }
    }));
  }

  function installBridge(scope = globalScope) {
    if (!scope || typeof scope !== "object") throw new Error("Browser scope is required");
    if (scope[INSTALL_MARKER]) return scope[INSTALL_MARKER];

    const legacyCreate = scope.saveCustomerToFirebase;
    const legacyUpdate = scope.updateCustomerInFirebase;
    const legacyDelete = scope.deleteCustomerFromFirebase;
    if (
      typeof legacyCreate !== "function" ||
      typeof legacyUpdate !== "function" ||
      typeof legacyDelete !== "function"
    ) {
      throw new Error("Legacy customer mutation functions are unavailable");
    }

    scope.saveCustomerToFirebase = async function auditedCreateCustomer(record) {
      if (!scope.chillProsDb) return legacyCreate(record);
      return requireGateway(scope).createCustomer(record, {
        action: "customer.created",
        source: "operations-center-app",
        metadata: { workflow: "customer-intake" }
      });
    };

    scope.updateCustomerInFirebase = async function auditedUpdateCustomer(record, changes) {
      if (!scope.chillProsDb) return legacyUpdate(record, changes);
      const rollbackSnapshot = snapshotChangedFields(scope, record, changes);
      try {
        return await requireGateway(scope).updateCustomer(record, changes, {
          action: classifyUpdateAction(changes),
          source: "operations-center-app",
          metadata: { workflow: "office-queue" }
        });
      } catch (error) {
        restoreChangedFields(record, rollbackSnapshot);
        reconcileRollback(scope);
        emitRollback(scope, record, changes, error);
        throw error;
      }
    };

    scope.deleteCustomerFromFirebase = async function auditedDeleteCustomer(record) {
      if (!scope.chillProsDb) return legacyDelete(record);
      return requireGateway(scope).deleteCustomer(record, {
        source: "operations-center-app",
        metadata: { workflow: "office-queue" }
      });
    };

    const installed = Object.freeze({
      saveCustomerToFirebase: scope.saveCustomerToFirebase,
      updateCustomerInFirebase: scope.updateCustomerInFirebase,
      deleteCustomerFromFirebase: scope.deleteCustomerFromFirebase
    });
    Object.defineProperty(scope, INSTALL_MARKER, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: installed
    });
    return installed;
  }

  function installAfterAppLoads(scope = globalScope) {
    if (!scope || typeof scope !== "object") throw new Error("Browser scope is required");
    if (scope.document?.readyState && scope.document.readyState !== "loading") {
      return installBridge(scope);
    }
    if (typeof scope.addEventListener !== "function") {
      throw new Error("Browser event target is required");
    }
    scope.addEventListener("DOMContentLoaded", () => {
      try {
        installBridge(scope);
      } catch (error) {
        console.error("Unable to install audited customer mutation bridge:", error);
      }
    }, { once: true });
    return null;
  }

  const api = {
    INSTALL_MARKER,
    classifyUpdateAction,
    emitRollback,
    getQueueStorageKey,
    hasAnyField,
    installAfterAppLoads,
    installBridge,
    readStoredRecord,
    reconcileRollback,
    requireGateway,
    restoreChangedFields,
    snapshotChangedFields
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsAppAuditedMutationBridge = api;

  if (typeof window !== "undefined" && globalScope === window) installAfterAppLoads(globalScope);
})(typeof window !== "undefined" ? window : globalThis);

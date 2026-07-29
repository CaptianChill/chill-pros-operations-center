(function initAppAuditedMutationBridge(globalScope) {
  "use strict";

  function requireGateway(scope) {
    const gateway = scope?.chillProsCustomerMutations;
    if (!gateway || typeof gateway.updateCustomer !== "function" || typeof gateway.deleteCustomer !== "function") {
      throw new Error("Authenticated audited customer mutation gateway is unavailable");
    }
    return gateway;
  }

  function classifyUpdateAction(changes) {
    const fields = Object.keys(changes || {});
    if (fields.includes("assignedTechnician") || fields.includes("scheduledDate") || fields.includes("scheduledTime")) {
      return "customer.schedule.updated";
    }
    if (fields.includes("officeStatus")) return "customer.status.updated";
    return "customer.updated";
  }

  function installBridge(scope = globalScope) {
    if (!scope || typeof scope !== "object") throw new Error("Browser scope is required");

    const legacyUpdate = scope.updateCustomerInFirebase;
    const legacyDelete = scope.deleteCustomerFromFirebase;
    if (typeof legacyUpdate !== "function" || typeof legacyDelete !== "function") {
      throw new Error("Legacy customer mutation functions are unavailable");
    }

    scope.updateCustomerInFirebase = async function auditedUpdateCustomer(record, changes) {
      if (!scope.chillProsDb) return legacyUpdate(record, changes);
      return requireGateway(scope).updateCustomer(record, changes, {
        action: classifyUpdateAction(changes),
        source: "operations-center-app",
        metadata: { workflow: "office-queue" }
      });
    };

    scope.deleteCustomerFromFirebase = async function auditedDeleteCustomer(record) {
      if (!scope.chillProsDb) return legacyDelete(record);
      return requireGateway(scope).deleteCustomer(record, {
        source: "operations-center-app",
        metadata: { workflow: "office-queue" }
      });
    };

    return {
      updateCustomerInFirebase: scope.updateCustomerInFirebase,
      deleteCustomerFromFirebase: scope.deleteCustomerFromFirebase
    };
  }

  function installAfterAppLoads(scope = globalScope) {
    if (!scope || typeof scope.addEventListener !== "function") {
      throw new Error("Browser event target is required");
    }
    scope.addEventListener("DOMContentLoaded", () => {
      try {
        installBridge(scope);
      } catch (error) {
        console.error("Unable to install audited customer mutation bridge:", error);
      }
    }, { once: true });
  }

  const api = { classifyUpdateAction, installAfterAppLoads, installBridge, requireGateway };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsAppAuditedMutationBridge = api;

  if (typeof window !== "undefined" && globalScope === window) installAfterAppLoads(globalScope);
})(typeof window !== "undefined" ? window : globalThis);

(function initSecurityRuntime(globalScope) {
  "use strict";

  function initializeSecurityRuntime(scope = globalScope) {
    if (!scope || typeof scope !== "object") {
      throw new Error("Browser scope is required");
    }

    const firebaseNamespace = scope.firebase;
    if (!firebaseNamespace || typeof firebaseNamespace.auth !== "function") {
      throw new Error("Firebase Auth compat SDK is required");
    }

    const auth = scope.chillProsAuth || firebaseNamespace.auth();
    if (!auth) throw new Error("Firebase Auth initialization failed");
    scope.chillProsAuth = auth;

    const integrationFactory =
      scope.ChillProsCustomerMutationIntegration?.createBrowserQueueMutationIntegration;
    if (typeof integrationFactory !== "function") {
      throw new Error("Audited customer mutation integration is unavailable");
    }

    const integration = integrationFactory(scope);
    if (
      !integration ||
      typeof integration.updateCustomer !== "function" ||
      typeof integration.deleteCustomer !== "function"
    ) {
      throw new Error("Audited customer mutation integration is invalid");
    }

    scope.chillProsCustomerMutations = integration;
    return integration;
  }

  const api = { initializeSecurityRuntime };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ChillProsSecurityRuntime = api;

  if (typeof window !== "undefined") initializeSecurityRuntime(window);
})(typeof window !== "undefined" ? window : globalThis);

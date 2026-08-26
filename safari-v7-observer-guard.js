(() => {
  'use strict';
  if (!window.MutationObserver || window.__CP_NATIVE_MUTATION_OBSERVER) return;
  window.__CP_NATIVE_MUTATION_OBSERVER = window.MutationObserver;
  window.MutationObserver = class ChillProsStartupObserverGuard {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  };
  window.__restoreChillProsMutationObserver = () => {
    if (window.__CP_NATIVE_MUTATION_OBSERVER) {
      window.MutationObserver = window.__CP_NATIVE_MUTATION_OBSERVER;
      delete window.__CP_NATIVE_MUTATION_OBSERVER;
    }
    delete window.__restoreChillProsMutationObserver;
  };
})();

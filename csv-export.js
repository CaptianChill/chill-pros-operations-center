(function attachCsvExportSecurity(globalScope) {
  "use strict";

  const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

  function neutralizeSpreadsheetFormula(value) {
    const text = String(value ?? "");
    return FORMULA_PREFIX_PATTERN.test(text) ? `'${text}` : text;
  }

  function asCsvCell(value) {
    const safeValue = neutralizeSpreadsheetFormula(value);
    return `"${safeValue.replaceAll('"', '""')}"`;
  }

  const api = { neutralizeSpreadsheetFormula, asCsvCell };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (globalScope) {
    globalScope.ChillProsCsvExport = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

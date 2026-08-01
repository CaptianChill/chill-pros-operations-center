(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiDataMinimizationPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_TEXT_LENGTH = 500;
  const PURPOSE_FIELDS = Object.freeze({
    "daily-operations-brief": Object.freeze([
      "id",
      "officeStatus",
      "priority",
      "serviceType",
      "scheduledDate",
      "assignedTechnician",
      "estimatedAmount",
      "createdAt"
    ]),
    "dispatch-recommendation": Object.freeze([
      "id",
      "officeStatus",
      "priority",
      "serviceType",
      "scheduledDate",
      "assignedTechnician",
      "requiredSkills",
      "serviceArea",
      "emergency",
      "createdAt"
    ]),
    "technician-assistance": Object.freeze([
      "id",
      "serviceType",
      "equipmentType",
      "manufacturer",
      "model",
      "symptoms",
      "findings",
      "serviceHistory"
    ])
  });

  const PROHIBITED_KEYS = new Set([
    "accessToken",
    "refreshToken",
    "apiKey",
    "authorization",
    "password",
    "secret",
    "seedPhrase",
    "paymentCard",
    "bankAccount",
    "socialSecurityNumber"
  ]);

  function normalizePurpose(value) {
    const purpose = String(value || "").trim();
    if (!Object.prototype.hasOwnProperty.call(PURPOSE_FIELDS, purpose)) {
      throw new RangeError("purpose must be an explicitly supported AI purpose");
    }
    return purpose;
  }

  function sanitizeValue(value, depth = 0) {
    if (depth > 4) return "[MAX_DEPTH]";
    if (typeof value === "string") return value.slice(0, MAX_TEXT_LENGTH);
    if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
    if (Array.isArray(value)) return Object.freeze(value.slice(0, 25).map((item) => sanitizeValue(item, depth + 1)));
    if (!value || typeof value !== "object") return String(value || "");

    const sanitized = {};
    Object.keys(value).sort().forEach((key) => {
      if (!PROHIBITED_KEYS.has(key)) sanitized[key] = sanitizeValue(value[key], depth + 1);
    });
    return Object.freeze(sanitized);
  }

  function prepareModelContext(record, options = {}) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError("record must be an object");
    }

    const purpose = normalizePurpose(options.purpose);
    const allowedFields = PURPOSE_FIELDS[purpose];
    const data = {};

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(record, field) && !PROHIBITED_KEYS.has(field)) {
        data[field] = sanitizeValue(record[field]);
      }
    });

    return Object.freeze({
      schemaVersion: 1,
      purpose,
      advisoryOnly: true,
      containsCredentials: false,
      fields: Object.freeze(data)
    });
  }

  function prepareModelContextBatch(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError("records must be an array");
    return Object.freeze(records.map((record) => prepareModelContext(record, options)));
  }

  return Object.freeze({
    MAX_TEXT_LENGTH,
    PROHIBITED_KEYS,
    PURPOSE_FIELDS,
    prepareModelContext,
    prepareModelContextBatch,
    sanitizeValue
  });
});
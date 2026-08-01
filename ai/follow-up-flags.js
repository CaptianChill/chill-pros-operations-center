(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiFollowUpFlags = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_THRESHOLDS = Object.freeze({
    quoteHours: 24,
    partsHours: 48,
    invoiceHours: 24
  });

  function text(value) {
    return String(value ?? "").trim();
  }

  function validHours(value, name) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`${name} must be a non-negative finite number`);
    return parsed;
  }

  function hoursSince(value, now, field) {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    const current = new Date(now).getTime();
    if (!Number.isFinite(timestamp)) throw new TypeError(`${field} must be a valid date`);
    if (!Number.isFinite(current)) throw new TypeError("now must be a valid date");
    if (current < timestamp) return 0;
    return (current - timestamp) / 3600000;
  }

  function hasServiceNotes(record) {
    return Boolean(text(record.findings) && text(record.recommendations || record.repairNotes || record.serviceNotes));
  }

  function createFlag(type, severity, message, action) {
    return Object.freeze({
      type,
      severity,
      message,
      recommendedAction: action,
      advisoryOnly: true,
      requiresHumanApproval: true
    });
  }

  function evaluateFollowUps(record, options = {}) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError("job record must be an object");
    }

    const now = options.now || Date.now();
    const thresholds = {
      quoteHours: validHours(options.quoteHours ?? DEFAULT_THRESHOLDS.quoteHours, "quoteHours"),
      partsHours: validHours(options.partsHours ?? DEFAULT_THRESHOLDS.partsHours, "partsHours"),
      invoiceHours: validHours(options.invoiceHours ?? DEFAULT_THRESHOLDS.invoiceHours, "invoiceHours")
    };
    const status = text(record.officeStatus || record.status);
    const updatedAt = record.updatedAt || record.updated_at || record.createdAt || record.created_at;
    const age = hoursSince(updatedAt, now, "updatedAt");
    const flags = [];

    if (status === "Needs Quote" && age >= thresholds.quoteHours) {
      flags.push(createFlag(
        "quote-overdue",
        age >= thresholds.quoteHours * 2 ? "high" : "medium",
        `Quote has been pending for ${Math.floor(age)} hours`,
        "Review scope and prepare quote for owner approval"
      ));
    }

    if (status === "Waiting on Parts" && age >= thresholds.partsHours) {
      flags.push(createFlag(
        "parts-follow-up",
        age >= thresholds.partsHours * 2 ? "high" : "medium",
        `Parts status has not changed for ${Math.floor(age)} hours`,
        "Verify vendor status and prepare a customer update for human review"
      ));
    }

    if ((status === "In Progress" || status === "Ready to Invoice") && !hasServiceNotes(record)) {
      flags.push(createFlag(
        "incomplete-service-notes",
        "high",
        "Service findings and recommendations are incomplete",
        "Complete service notes before invoice handoff"
      ));
    }

    if (status === "Ready to Invoice" && age >= thresholds.invoiceHours) {
      flags.push(createFlag(
        "invoice-handoff-overdue",
        age >= thresholds.invoiceHours * 2 ? "high" : "medium",
        `Invoice handoff has been pending for ${Math.floor(age)} hours`,
        "Review completed service record and prepare invoice"
      ));
    }

    return Object.freeze({
      jobId: text(record.id || record.firestoreId || record.jobId),
      evaluatedAt: new Date(now).toISOString(),
      mode: "advisory-only",
      flags: Object.freeze(flags)
    });
  }

  function evaluateFollowUpBatch(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError("job records must be an array");
    return Object.freeze(records.map((record) => evaluateFollowUps(record, options)));
  }

  return Object.freeze({ evaluateFollowUps, evaluateFollowUpBatch });
});

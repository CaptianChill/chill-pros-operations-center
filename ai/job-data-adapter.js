(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiJobDataAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ACTIVE_STATUSES = new Set(["new", "queued", "scheduled", "dispatched", "in-progress", "completed"]);

  function text(value, maxLength = 240) {
    return String(value ?? "").trim().slice(0, maxLength);
  }

  function normalizeStatus(value) {
    const status = text(value, 40).toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
    return ACTIVE_STATUSES.has(status) ? status : "queued";
  }

  function normalizeDate(value, field) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date`);
    return parsed.toISOString();
  }

  function normalizeMoney(value) {
    if (value === undefined || value === null || value === "") return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new TypeError("estimatedAmount must be a non-negative finite number");
    return Math.round(amount * 100) / 100;
  }

  function normalizeJob(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError("job record must be an object");
    }

    const id = text(record.id || record.jobId || record.workOrderId, 120);
    if (!id) throw new TypeError("job id is required");

    const customerName = text(record.customerName || record.clientName || record.customer?.name, 160);
    const summary = text(record.summary || record.issue || record.description || record.serviceRequested, 500);
    const technicianId = text(record.technicianId || record.assignedTechnicianId || record.technician?.id, 120) || null;

    return Object.freeze({
      id,
      customerName: customerName || "Customer",
      summary,
      status: normalizeStatus(record.status || record.workflowStatus),
      priority: text(record.priority, 40).toLowerCase() || "normal",
      technicianId,
      createdAt: normalizeDate(record.createdAt || record.created_at, "createdAt"),
      scheduledAt: normalizeDate(record.scheduledAt || record.scheduled_at, "scheduledAt"),
      estimatedAmount: normalizeMoney(record.estimatedAmount ?? record.estimateTotal),
      serviceArea: text(record.serviceArea || record.city || record.location?.city, 120) || null,
      equipmentType: text(record.equipmentType || record.assetType, 120) || null,
      source: "read-only-adapter",
      advisoryOnly: true
    });
  }

  function normalizeJobs(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError("job records must be an array");
    const seen = new Set();
    const includeCompleted = options.includeCompleted === true;

    return Object.freeze(records.map(normalizeJob).filter((job) => {
      if (seen.has(job.id)) throw new TypeError(`duplicate job id: ${job.id}`);
      seen.add(job.id);
      return includeCompleted || job.status !== "completed";
    }));
  }

  return Object.freeze({ normalizeJob, normalizeJobs });
});

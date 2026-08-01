(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsDispatchCapacityPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const DEFAULT_MAX_ACTIVE_JOBS = 4;

  function finiteNonNegative(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function assessCapacity(technician, options = {}) {
    if (!technician || typeof technician !== "object") {
      throw new TypeError("technician must be an object");
    }

    const activeJobCount = finiteNonNegative(technician.activeJobCount, 0);
    const defaultMaximum = finiteNonNegative(options.defaultMaxActiveJobs, DEFAULT_MAX_ACTIVE_JOBS);
    const maxActiveJobs = finiteNonNegative(technician.maxActiveJobs, defaultMaximum);
    const capacityRemaining = Math.max(0, maxActiveJobs - activeJobCount);
    const atCapacity = maxActiveJobs === 0 || activeJobCount >= maxActiveJobs;

    return Object.freeze({
      activeJobCount,
      maxActiveJobs,
      capacityRemaining,
      atCapacity,
      requiresCapacityOverride: atCapacity,
      advisoryOnly: true,
      requiresHumanApproval: true
    });
  }

  function rankDispatchCandidates(job, technicians, options = {}) {
    if (!job || typeof job !== "object") throw new TypeError("job must be an object");
    if (!Array.isArray(technicians)) throw new TypeError("technicians must be an array");

    const engine = options.engine || root?.ChillProsAiOperations;
    if (!engine || typeof engine.recommendTechnicians !== "function") {
      throw new TypeError("AI Operations Engine with recommendTechnicians is required");
    }

    const techniciansById = new Map(
      technicians
        .filter((technician) => technician && typeof technician === "object")
        .map((technician) => [String(technician.id || technician.firestoreId || "").trim(), technician])
    );

    return engine.recommendTechnicians(job, technicians, options)
      .map((recommendation) => {
        const technician = techniciansById.get(recommendation.technicianId) || {};
        const capacity = assessCapacity(technician, options);
        const reasons = [...(recommendation.reasons || [])];
        reasons.push(capacity.atCapacity
          ? `At capacity: ${capacity.activeJobCount}/${capacity.maxActiveJobs} active jobs`
          : `Capacity available: ${capacity.capacityRemaining} job${capacity.capacityRemaining === 1 ? "" : "s"}`);

        return Object.freeze({
          ...recommendation,
          ...capacity,
          reasons
        });
      })
      .sort((a, b) =>
        Number(b.qualified) - Number(a.qualified) ||
        Number(a.atCapacity) - Number(b.atCapacity) ||
        Number(b.serviceAreaConfirmed) - Number(a.serviceAreaConfirmed) ||
        b.score - a.score ||
        a.technicianName.localeCompare(b.technicianName)
      );
  }

  function validateDispatchForExecution(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return { allowed: false, reason: "Dispatch candidate is required" };
    }
    return {
      allowed: false,
      reason: "Capacity recommendations are advisory-only. An authenticated owner or office user must approve every dispatch assignment."
    };
  }

  return Object.freeze({
    DEFAULT_MAX_ACTIVE_JOBS,
    assessCapacity,
    rankDispatchCandidates,
    validateDispatchForExecution
  });
});

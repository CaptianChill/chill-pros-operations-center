(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./job-data-adapter") : root.ChillProsAiJobDataAdapter,
    typeof module === "object" && module.exports ? require("./operations-engine") : root.ChillProsAiOperations,
    typeof module === "object" && module.exports ? require("./follow-up-flags") : root.ChillProsAiFollowUpFlags,
    typeof module === "object" && module.exports ? require("./advisory-review-queue") : root.ChillProsAiAdvisoryReviewQueue
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiAdvisoryPipeline = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (jobAdapter, operations, followUps, reviewQueue) {
  "use strict";

  const STATUS_LABELS = Object.freeze({
    new: "Needs Review",
    queued: "Needs Review",
    scheduled: "Scheduled",
    dispatched: "Dispatched",
    "in-progress": "In Progress",
    completed: "Completed"
  });

  function requireDependency(value, name) {
    if (!value || typeof value !== "object") throw new Error(`${name} dependency is unavailable`);
  }

  function text(value, maxLength = 500) {
    return String(value ?? "").trim().slice(0, maxLength);
  }

  function rawId(record) {
    return text(record && (record.id || record.jobId || record.workOrderId), 120);
  }

  function canonicalJob(job, source) {
    return Object.freeze({
      id: job.id,
      customerName: job.customerName,
      complaint: job.summary,
      equipmentType: job.equipmentType,
      officeStatus: STATUS_LABELS[job.status] || "Needs Review",
      assignedTechnician: job.technicianId || "",
      createdAt: job.createdAt,
      updatedAt: source.updatedAt || source.updated_at || job.createdAt,
      estimatedAmount: job.estimatedAmount,
      phone: text(source.phone || source.customerPhone, 80),
      email: text(source.email || source.customerEmail, 160),
      findings: text(source.findings, 1000),
      recommendations: text(source.recommendations || source.recommendation || source.serviceNotes, 1000),
      advisoryOnly: true
    });
  }

  function approvalLevelForFlag(flag) {
    return flag && flag.severity === "high" ? "owner-approval" : "office-review";
  }

  function recommendationId(prefix, jobId, suffix) {
    const stableJobId = text(jobId, 120);
    if (!stableJobId) throw new TypeError("A stable job id is required for advisory recommendations");
    return `${prefix}:${stableJobId}${suffix ? `:${suffix}` : ""}`;
  }

  function buildAdvisoryPipeline(rawJobs, options = {}) {
    requireDependency(jobAdapter, "job-data-adapter");
    requireDependency(operations, "operations-engine");
    requireDependency(followUps, "follow-up-flags");
    requireDependency(reviewQueue, "advisory-review-queue");
    if (!Array.isArray(rawJobs)) throw new TypeError("rawJobs must be an array");

    const normalized = jobAdapter.normalizeJobs(rawJobs, {
      includeCompleted: Boolean(options.includeCompleted)
    });
    const sourceById = new Map(rawJobs.map((record) => [rawId(record), record]));
    const jobs = Object.freeze(normalized.map((job) => canonicalJob(job, sourceById.get(job.id) || {})));
    const brief = operations.buildOperationsBrief(jobs, { now: options.now });
    const followUpOptions = { now: options.now };
    if (options.quoteHours !== undefined) followUpOptions.quoteHours = options.quoteHours;
    if (options.partsHours !== undefined) followUpOptions.partsHours = options.partsHours;
    if (options.invoiceHours !== undefined) followUpOptions.invoiceHours = options.invoiceHours;
    const followUpResults = followUps.evaluateFollowUpBatch(jobs, followUpOptions);
    const recommendations = [];

    brief.recommendations.forEach((item) => recommendations.push({
      id: recommendationId("job-priority", item.id),
      source: "operations-brief",
      entityId: item.id,
      summary: item.recommendedAction,
      level: item.urgent ? "owner-approval" : "office-review",
      score: item.score,
      reasons: item.reasons
    }));

    followUpResults.forEach((result) => result.flags.forEach((flag) => recommendations.push({
      id: recommendationId("follow-up", result.jobId, flag.type),
      source: "follow-up-flags",
      entityId: result.jobId,
      summary: flag.recommendedAction,
      level: approvalLevelForFlag(flag),
      score: flag.severity === "high" ? 100 : 50,
      reasons: [flag.message]
    })));

    const queue = reviewQueue.buildReviewQueue(recommendations);
    return Object.freeze({
      generatedAt: brief.generatedAt,
      mode: "advisory-only",
      executable: false,
      requiresHumanApproval: true,
      sourceJobCount: rawJobs.length,
      normalizedJobCount: jobs.length,
      brief,
      reviewQueue: queue,
      reviewTotals: reviewQueue.summarizeReviewQueue(queue)
    });
  }

  function authorizePipelineExecution() {
    return Object.freeze({
      allowed: false,
      reason: "The AI advisory pipeline cannot execute operational changes. An authenticated human must review and perform every action."
    });
  }

  return Object.freeze({ buildAdvisoryPipeline, authorizePipelineExecution });
});

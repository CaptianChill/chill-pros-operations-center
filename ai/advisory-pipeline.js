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

  function requireDependency(value, name) {
    if (!value || typeof value !== "object") throw new Error(`${name} dependency is unavailable`);
    return value;
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function approvalLevelForFlag(flag) {
    return flag && flag.severity === "high" ? "owner-approval" : "office-review";
  }

  function recommendationId(prefix, jobId, suffix) {
    const stableJobId = text(jobId);
    if (!stableJobId) throw new TypeError("A stable job id is required for advisory recommendations");
    return `${prefix}:${stableJobId}${suffix ? `:${suffix}` : ""}`;
  }

  function buildAdvisoryPipeline(rawJobs, options = {}) {
    requireDependency(jobAdapter, "job-data-adapter");
    requireDependency(operations, "operations-engine");
    requireDependency(followUps, "follow-up-flags");
    requireDependency(reviewQueue, "advisory-review-queue");

    if (!Array.isArray(rawJobs)) throw new TypeError("rawJobs must be an array");

    const jobs = jobAdapter.normalizeJobRecords(rawJobs, {
      includeCompleted: Boolean(options.includeCompleted)
    });
    const brief = operations.buildOperationsBrief(jobs, { now: options.now });
    const followUpResults = followUps.evaluateFollowUpBatch(jobs, {
      now: options.now,
      quoteHours: options.quoteHours,
      partsHours: options.partsHours,
      invoiceHours: options.invoiceHours
    });

    const recommendations = [];

    brief.recommendations.forEach((item) => {
      recommendations.push({
        id: recommendationId("job-priority", item.id),
        source: "operations-brief",
        entityId: item.id,
        summary: item.recommendedAction,
        level: item.urgent ? "owner-approval" : "office-review",
        score: item.score,
        reasons: item.reasons
      });
    });

    followUpResults.forEach((result) => {
      result.flags.forEach((flag) => {
        recommendations.push({
          id: recommendationId("follow-up", result.jobId, flag.type),
          source: "follow-up-flags",
          entityId: result.jobId,
          summary: flag.recommendedAction,
          level: approvalLevelForFlag(flag),
          score: flag.severity === "high" ? 100 : 50,
          reasons: [flag.message]
        });
      });
    });

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

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiEvaluationReport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function uniqueStrings(values, label) {
    if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
    const normalized = values.map((value) => {
      if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${label} must contain non-empty strings`);
      }
      return value.trim();
    });
    if (new Set(normalized).size !== normalized.length) {
      throw new Error(`${label} must not contain duplicates`);
    }
    return normalized;
  }

  function buildEvaluationReport(pipelineResult, expectations = {}) {
    if (!isObject(pipelineResult)) throw new TypeError("pipeline result must be an object");
    if (!isObject(expectations)) throw new TypeError("expectations must be an object");
    if (!Array.isArray(pipelineResult.reviewQueue)) {
      throw new TypeError("pipeline result reviewQueue must be an array");
    }

    const expectedRecommendationIds = uniqueStrings(
      expectations.expectedRecommendationIds || [],
      "expectedRecommendationIds"
    );
    const excludedEntityIds = uniqueStrings(
      expectations.excludedEntityIds || [],
      "excludedEntityIds"
    );

    const actualIds = pipelineResult.reviewQueue.map((item) => item && item.id);
    if (actualIds.some((id) => typeof id !== "string" || !id.trim())) {
      throw new TypeError("every review queue item must have a stable id");
    }
    if (new Set(actualIds).size !== actualIds.length) {
      throw new Error("review queue contains duplicate recommendation ids");
    }

    const actualIdSet = new Set(actualIds);
    const missingRecommendationIds = expectedRecommendationIds.filter((id) => !actualIdSet.has(id));
    const prohibitedEntityHits = pipelineResult.reviewQueue
      .filter((item) => excludedEntityIds.includes(item.entityId))
      .map((item) => item.entityId);

    const unsafeItems = pipelineResult.reviewQueue.filter(
      (item) => item.advisoryOnly !== true || item.executable !== false
    );
    const safetyPassed =
      pipelineResult.mode === "advisory-only" &&
      pipelineResult.executable === false &&
      pipelineResult.requiresHumanApproval === true &&
      unsafeItems.length === 0;
    const coveragePassed = missingRecommendationIds.length === 0;
    const exclusionPassed = prohibitedEntityHits.length === 0;
    const passed = safetyPassed && coveragePassed && exclusionPassed;

    return Object.freeze({
      reportType: "deidentified-advisory-evaluation",
      passed,
      safetyPassed,
      coveragePassed,
      exclusionPassed,
      expectedRecommendationCount: expectedRecommendationIds.length,
      observedRecommendationCount: actualIds.length,
      missingRecommendationIds: Object.freeze(missingRecommendationIds),
      prohibitedEntityHits: Object.freeze(prohibitedEntityHits),
      unsafeRecommendationIds: Object.freeze(unsafeItems.map((item) => item.id)),
      advisoryOnly: true,
      executable: false,
      requiresHumanApproval: true
    });
  }

  return Object.freeze({ buildEvaluationReport });
});

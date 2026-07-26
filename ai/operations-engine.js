(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsAiOperations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EMERGENCY_TERMS = [
    "no cooling",
    "not cooling",
    "warm",
    "down",
    "leak",
    "smoke",
    "burning",
    "electrical",
    "compressor",
    "walk-in"
  ];

  const STATUS_WEIGHT = Object.freeze({
    "Needs Review": 25,
    "Needs Quote": 10,
    Scheduled: 5,
    Dispatched: 15,
    "In Progress": 20,
    Paused: 10,
    "Waiting on Parts": 0,
    "Ready to Invoice": 8,
    Completed: -100
  });

  function text(value) {
    return String(value || "").trim();
  }

  function normalized(value) {
    return text(value).toLowerCase();
  }

  function normalizedList(value) {
    const items = Array.isArray(value) ? value : text(value).split(",");
    return [...new Set(items.map(normalized).filter(Boolean))];
  }

  function finiteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function ageHours(createdAt, now) {
    const created = new Date(createdAt || 0).getTime();
    const current = new Date(now || Date.now()).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(current) || created <= 0 || current < created) return 0;
    return (current - created) / 3600000;
  }

  function detectUrgency(record) {
    const haystack = [record.complaint, record.findings, record.equipmentType, record.customerName]
      .map(normalized)
      .join(" ");
    const matches = EMERGENCY_TERMS.filter((term) => haystack.includes(term));
    return { urgent: matches.length > 0, matches };
  }

  function scoreRecord(record, options) {
    const now = options && options.now;
    const status = text(record.officeStatus) || "Needs Review";
    const urgency = detectUrgency(record);
    const hoursOpen = ageHours(record.createdAt, now);
    const estimatedAmount = Math.max(0, finiteNumber(record.estimatedAmount, 0));

    let score = STATUS_WEIGHT[status] ?? 5;
    const reasons = [];

    if (urgency.urgent) {
      score += 40;
      reasons.push(`Urgent service language: ${urgency.matches.join(", ")}`);
    }

    if (hoursOpen >= 48) {
      score += 20;
      reasons.push("Open at least 48 hours");
    } else if (hoursOpen >= 24) {
      score += 10;
      reasons.push("Open at least 24 hours");
    }

    if (!text(record.assignedTechnician) && status !== "Completed") {
      score += 12;
      reasons.push("No technician assigned");
    }

    if (!text(record.phone) && !text(record.email)) {
      score -= 8;
      reasons.push("Missing customer contact information");
    }

    if (estimatedAmount >= 2000) {
      score += 8;
      reasons.push("High-value opportunity");
    } else if (estimatedAmount >= 750) {
      score += 4;
      reasons.push("Material revenue opportunity");
    }

    if (status === "Ready to Invoice") reasons.push("Invoice handoff pending");
    if (status === "Waiting on Parts") reasons.push("Blocked pending parts");
    if (status === "Completed") reasons.push("Completed records are excluded from active recommendations");

    return {
      id: text(record.id || record.firestoreId),
      score,
      status,
      urgent: urgency.urgent,
      reasons,
      customerName: text(record.customerName) || "Unnamed customer",
      assignedTechnician: text(record.assignedTechnician),
      recommendedAction: recommendAction(status, record, urgency.urgent)
    };
  }

  function recommendAction(status, record, urgent) {
    if (status === "Completed") return "No action";
    if (status === "Ready to Invoice") return "Review service record and prepare invoice";
    if (status === "Waiting on Parts") return "Confirm parts status and customer update";
    if (!text(record.assignedTechnician)) return urgent ? "Dispatch qualified technician immediately" : "Assign technician and schedule";
    if (status === "Needs Quote") return "Prepare and send quote for owner approval";
    if (status === "Needs Review") return "Review intake and determine next workflow state";
    return "Review job status and next operational step";
  }

  function recommendTechnicians(job, technicians, options) {
    if (!job || typeof job !== "object") throw new TypeError("job must be an object");
    if (!Array.isArray(technicians)) throw new TypeError("technicians must be an array");

    const requiredSkills = normalizedList(job.requiredSkills || job.skills || job.equipmentType);
    const serviceArea = normalized(job.serviceArea || job.city || job.locationArea);
    const urgent = detectUrgency(job).urgent;
    const includeUnavailable = Boolean(options && options.includeUnavailable);

    return technicians
      .filter((technician) => technician && typeof technician === "object")
      .filter((technician) => technician.active !== false)
      .filter((technician) => includeUnavailable || technician.available !== false)
      .map((technician) => {
        const skills = normalizedList(technician.skills);
        const serviceAreas = normalizedList(technician.serviceAreas || technician.serviceArea);
        const matchedSkills = requiredSkills.filter((skill) => skills.includes(skill));
        const missingSkills = requiredSkills.filter((skill) => !skills.includes(skill));
        const workload = Math.max(0, finiteNumber(technician.activeJobCount, 0));
        const available = technician.available !== false;
        let score = 0;
        const reasons = [];

        if (requiredSkills.length === 0) {
          reasons.push("No explicit job skill requirement provided");
        } else if (matchedSkills.length > 0) {
          score += Math.round((matchedSkills.length / requiredSkills.length) * 50);
          reasons.push(`Matched skills: ${matchedSkills.join(", ")}`);
        }

        if (missingSkills.length > 0) reasons.push(`Missing skills: ${missingSkills.join(", ")}`);

        if (serviceArea && serviceAreas.includes(serviceArea)) {
          score += 25;
          reasons.push(`Covers service area: ${serviceArea}`);
        } else if (serviceArea) {
          reasons.push(`Service area not confirmed: ${serviceArea}`);
        }

        if (available) {
          score += 15;
          reasons.push("Marked available");
        } else {
          score -= 30;
          reasons.push("Marked unavailable");
        }

        score += Math.max(0, 15 - workload * 3);
        reasons.push(`${workload} active job${workload === 1 ? "" : "s"}`);

        if (urgent && technician.emergencyCapable === true) {
          score += 10;
          reasons.push("Emergency-capable technician");
        }

        return {
          technicianId: text(technician.id || technician.firestoreId),
          technicianName: text(technician.name) || "Unnamed technician",
          score,
          available,
          matchedSkills,
          missingSkills,
          reasons,
          advisoryOnly: true,
          requiresHumanApproval: true
        };
      })
      .sort((a, b) => b.score - a.score || a.technicianName.localeCompare(b.technicianName));
  }

  function buildOperationsBrief(records, options) {
    if (!Array.isArray(records)) throw new TypeError("records must be an array");
    const active = records.filter((record) => text(record.officeStatus) !== "Completed");
    const recommendations = active
      .map((record) => scoreRecord(record || {}, options || {}))
      .sort((a, b) => b.score - a.score || a.customerName.localeCompare(b.customerName));

    return {
      generatedAt: new Date((options && options.now) || Date.now()).toISOString(),
      mode: "advisory-only",
      requiresHumanApproval: true,
      totals: {
        activeJobs: active.length,
        urgentJobs: recommendations.filter((item) => item.urgent).length,
        unassignedJobs: active.filter((item) => !text(item.assignedTechnician)).length,
        readyToInvoice: active.filter((item) => text(item.officeStatus) === "Ready to Invoice").length
      },
      recommendations
    };
  }

  function validateRecommendationForExecution(recommendation) {
    if (!recommendation || typeof recommendation !== "object") {
      return { allowed: false, reason: "Recommendation is required" };
    }
    return {
      allowed: false,
      reason: "AI Operations Engine is advisory-only. A human owner or office user must approve and execute all operational changes."
    };
  }

  return Object.freeze({
    buildOperationsBrief,
    detectUrgency,
    recommendTechnicians,
    scoreRecord,
    validateRecommendationForExecution
  });
});
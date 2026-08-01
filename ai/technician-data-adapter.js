(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChillProsTechnicianDataAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_MAX_ACTIVE_JOBS = 6;

  function asTrimmedString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function asStringList(value) {
    const values = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : [];

    return Object.freeze(Array.from(new Set(values
      .map((item) => asTrimmedString(item).toLowerCase())
      .filter(Boolean))));
  }

  function asBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }

  function asNonNegativeInteger(value, fallback) {
    if (value === "" || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return fallback;
    return parsed;
  }

  function resolveName(record) {
    return asTrimmedString(record.name)
      || asTrimmedString(record.displayName)
      || asTrimmedString(record.technicianName)
      || asTrimmedString(record.fullName);
  }

  function normalizeTechnician(record, options = {}) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError("technician record must be an object");
    }

    const id = asTrimmedString(record.id)
      || asTrimmedString(record.firestoreId)
      || asTrimmedString(record.uid);
    const name = resolveName(record);

    if (!id) throw new TypeError("technician record requires an id, firestoreId, or uid");
    if (!name) throw new TypeError("technician record requires a name");

    const defaultMax = asNonNegativeInteger(options.defaultMaxActiveJobs, DEFAULT_MAX_ACTIVE_JOBS);
    const normalized = {
      id,
      firestoreId: asTrimmedString(record.firestoreId) || id,
      name,
      skills: asStringList(record.skills || record.certifications || record.specialties),
      serviceAreas: asStringList(record.serviceAreas || record.serviceArea || record.coverageAreas),
      active: asBoolean(record.active ?? record.isActive, true),
      available: asBoolean(record.available ?? record.isAvailable ?? record.onDuty, false),
      emergencyCapable: asBoolean(record.emergencyCapable ?? record.emergencyReady, false),
      activeJobCount: asNonNegativeInteger(record.activeJobCount ?? record.currentJobCount, 0),
      maxActiveJobs: asNonNegativeInteger(record.maxActiveJobs ?? record.capacity, defaultMax),
      source: "read-only-normalized-technician",
      advisoryOnly: true
    };

    return Object.freeze(normalized);
  }

  function normalizeTechnicians(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError("technician records must be an array");

    const seen = new Set();
    return Object.freeze(records.map((record) => {
      const normalized = normalizeTechnician(record, options);
      if (seen.has(normalized.id)) throw new TypeError(`duplicate technician id: ${normalized.id}`);
      seen.add(normalized.id);
      return normalized;
    }));
  }

  function eligibleTechnicians(records, options = {}) {
    const includeUnavailable = options.includeUnavailable === true;
    const includeInactive = options.includeInactive === true;
    return Object.freeze(normalizeTechnicians(records, options).filter((technician) =>
      (includeInactive || technician.active)
      && (includeUnavailable || technician.available)
    ));
  }

  return Object.freeze({
    DEFAULT_MAX_ACTIVE_JOBS,
    normalizeTechnician,
    normalizeTechnicians,
    eligibleTechnicians
  });
});

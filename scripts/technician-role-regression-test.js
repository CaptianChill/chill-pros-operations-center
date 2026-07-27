"use strict";

const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "v1-access.js"), "utf8");
const failures = [];

const requiredPatterns = [
  [/technician:\s*\["today-jobs",\s*"equipment",\s*"ai"\]/, "technician-only view allowlist"],
  [/customersQuery\s*=\s*customersQuery\.where\("assignedTechnician",\s*"==",\s*currentProfile\.technicianName\)/, "Firestore query scoped to assigned technician"],
  [/if\s*\(currentProfile\?\.role\s*===\s*"technician"\)[\s\S]*technicians\s*=\s*\[\]/, "technician directory listener disabled for technician sessions"],
  [/title\.textContent\s*=\s*profile\.role\s*===\s*"technician"[\s\S]*"Technician Workspace"/, "technician-specific shell branding"],
  [/data\.role\s*===\s*"technician"\s*&&\s*!String\(data\.technicianName/, "technician profile requires assignment identity"],
  [/normalizedIdentity\(record\.assignedTechnician\)\s*===\s*normalizedIdentity\(technicianName\)/, "defensive normalized assignment comparison"],
];

for (const [pattern, label] of requiredPatterns) {
  if (!pattern.test(source)) failures.push(`Missing ${label}`);
}

if (/technician:\s*\[[^\]]*"technicians"/.test(source)) {
  failures.push("Technician role must not expose the technician-management view");
}

if (/window\.chillProsDb\.collection\("Customers"\)\.onSnapshot/.test(source)) {
  failures.push("Customer listener must use a role-scoped query instead of an unfiltered technician collection listener");
}

if (failures.length) {
  console.error("Technician role regression checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Technician role routing, branding, and assigned-job query regression checks passed.");

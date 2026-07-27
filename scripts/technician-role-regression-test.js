"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "v1-access.js"), "utf8");
const roleUiPatch = fs.readFileSync(path.join(root, "role-ui-patch.js"), "utf8");
const firebaseConfig = fs.readFileSync(path.join(root, "firebase-config.js"), "utf8");
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

for (const [pattern, label] of [
  [/technician:\s*Object\.freeze\(\{\s*title:\s*"Technician Workspace",\s*status:\s*"Assigned work only"/, "technician mobile-strip labels"],
  [/document\.querySelectorAll\("\.owner-mobile-strip"\)/, "mobile-strip synchronization"],
  [/document\.body\?\.dataset\?\.role/, "role-derived mobile branding"],
  [/MutationObserver/, "late-render role UI synchronization"],
]) {
  if (!pattern.test(roleUiPatch)) failures.push(`role-ui-patch.js is missing ${label}`);
}

if (!firebaseConfig.includes('["v1-access.js", "role-ui-patch.js", "production-reset.js"]')) {
  failures.push("firebase-config.js must load the role UI patch between access control and production reset");
}

if (/technician:\s*\[[^\]]*"technicians"/.test(source)) {
  failures.push("Technician role must not expose the technician-management view");
}

if (/window\.chillProsDb\.collection\("Customers"\)\.onSnapshot/.test(source)) {
  failures.push("Customer listener must use a role-scoped query instead of an unfiltered technician collection listener");
}

if (/technician:\s*Object\.freeze\(\{[^}]*Owner Mobile/.test(roleUiPatch)) {
  failures.push("Technician mobile branding must not display Owner Mobile");
}

if (failures.length) {
  console.error("Technician role regression checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Technician routing, assigned-job query, shell branding, and mobile role labels passed.");

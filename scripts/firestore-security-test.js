"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rulesPath = path.resolve(__dirname, "..", "firestore.rules");
const rules = fs.readFileSync(rulesPath, "utf8");
const failures = [];

const requiredPatterns = [
  [/function\s+hasUserProfile\(\)/, "profile existence guard"],
  [/function\s+technicianName\(\)/, "technician identity helper"],
  [/function\s+assignedToCurrentTechnician\(data\)/, "server-side technician assignment helper"],
  [/data\.assignedTechnician\s*==\s*technicianName\(\)/, "technician assignment comparison"],
  [/allow\s+read:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)\s*\|\|\s*assignedToCurrentTechnician\(resource\.data\)/, "assigned-record read restriction"],
  [/allow\s+create:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)/, "owner/office-only customer creation"],
  [/assignedToCurrentTechnician\(resource\.data\)[\s\S]*request\.resource\.data\.assignedTechnician\s*==\s*resource\.data\.assignedTechnician/, "technician reassignment prevention"],
  [/match\s+\/\{document=\*\*\}[\s\S]*allow\s+read,\s*write:\s*if\s+false/, "deny-by-default fallback"],
];

for (const [pattern, label] of requiredPatterns) {
  if (!pattern.test(rules)) failures.push(`Missing ${label}`);
}

const forbiddenPatterns = [
  [/match\s+\/Customers\/\{customerId\}[\s\S]*allow\s+read:\s*if\s+signedIn\(\)/, "all-authenticated customer reads"],
  [/allow\s+create,\s*update:\s*if[\s\S]*isTechnician\(\)/, "unrestricted technician customer writes"],
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(rules)) failures.push(`Forbidden rule detected: ${label}`);
}

if (failures.length) {
  console.error("Firestore security checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Firestore technician assignment and deny-by-default security checks passed.");

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
  [/function\s+technicianUpdateFieldsAreSafe\(\)/, "technician field allowlist helper"],
  [/affectedKeys\(\)\.hasOnly\(\[[\s\S]*'officeStatus'[\s\S]*'statusUpdatedAt'[\s\S]*'findings'[\s\S]*'recommendation'[\s\S]*'photoNotes'[\s\S]*\]\)/, "technician update field allowlist"],
  [/function\s+technicianStatusIsAllowed\(\)/, "technician status transition guard"],
  [/request\.resource\.data\.officeStatus\s+in\s+\[[\s\S]*'Dispatched'[\s\S]*'In Progress'[\s\S]*'Paused'[\s\S]*'Waiting on Parts'[\s\S]*'Ready to Invoice'[\s\S]*'Completed'[\s\S]*\]/, "technician status allowlist"],
  [/allow\s+read:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)\s*\|\|\s*assignedToCurrentTechnician\(resource\.data\)/, "assigned-record read restriction"],
  [/allow\s+create:\s*if\s+isOwner\(\)\s*\|\|\s*isOffice\(\)/, "owner/office-only customer creation"],
  [/assignedToCurrentTechnician\(resource\.data\)[\s\S]*request\.resource\.data\.assignedTechnician\s*==\s*resource\.data\.assignedTechnician[\s\S]*technicianUpdateFieldsAreSafe\(\)[\s\S]*technicianStatusIsAllowed\(\)/, "restricted technician update chain"],
  [/match\s+\/\{document=\*\*\}[\s\S]*allow\s+read,\s*write:\s*if\s+false/, "deny-by-default fallback"],
];

for (const [pattern, label] of requiredPatterns) {
  if (!pattern.test(rules)) failures.push(`Missing ${label}`);
}

const forbiddenPatterns = [
  [/match\s+\/Customers\/\{customerId\}[\s\S]*allow\s+read:\s*if\s+signedIn\(\)/, "all-authenticated customer reads"],
  [/allow\s+create,\s*update:\s*if[\s\S]*isTechnician\(\)/, "unrestricted technician customer writes"],
  [/affectedKeys\(\)\.hasOnly\(\[[\s\S]*'assignedTechnician'/, "technician reassignment in field allowlist"],
  [/affectedKeys\(\)\.hasOnly\(\[[\s\S]*'customerName'/, "customer identity edits in technician field allowlist"],
  [/affectedKeys\(\)\.hasOnly\(\[[\s\S]*'estimatedAmount'/, "financial edits in technician field allowlist"],
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(rules)) failures.push(`Forbidden rule detected: ${label}`);
}

if (failures.length) {
  console.error("Firestore security checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Firestore technician assignment, field allowlist, status allowlist, and deny-by-default checks passed.");

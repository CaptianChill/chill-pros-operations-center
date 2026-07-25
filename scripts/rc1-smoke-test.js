"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "firebase-config.js",
  "tenant-config.js",
  "v1-access.js",
  "functions/index.js",
  "functions/package.json",
  "firebase.json",
  "firestore.rules",
  "docs/TECHNICIAN_ACTIVATION_AND_E2E_TEST.md",
];

const failures = [];
const warnings = [];
for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`Missing required file: ${relativePath}`);
  }
}

const indexPath = path.join(root, "index.html");
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, "utf8");
  const requiredIds = [
    "dashboard",
    "new-customer",
    "office-queue",
    "today-jobs",
    "technicians",
    "intakeForm",
    "queueList",
    "todayJobsList",
    "technicianList",
    "technicianDashboardSelect",
    "technicianJobsList",
  ];
  for (const id of requiredIds) {
    const matches = html.match(new RegExp(`id=["']${id}["']`, "g")) || [];
    if (matches.length !== 1) {
      failures.push(`Expected exactly one #${id}; found ${matches.length}`);
    }
  }

  const placeholderPatterns = [
    [/>3<\/strong><small class="warning">1 In Progress<\/small>/, "PM dashboard count"],
    [/>2<\/strong><small class="warning">Awaiting Pickup<\/small>/, "parts dashboard count"],
    [/>\$8,450<\/strong>/, "estimated revenue"],
    [/>96°F<\/strong>/, "weather conditions"],
  ];
  for (const [pattern, label] of placeholderPatterns) {
    if (pattern.test(html)) {
      warnings.push(`Replace hard-coded ${label} before RC1 approval`);
    }
  }
}

const firebaseConfigPath = path.join(root, "firebase.json");
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    if (firebaseConfig.firestore?.rules !== "firestore.rules") {
      failures.push("firebase.json must deploy firestore.rules");
    }
  } catch (error) {
    failures.push(`firebase.json is invalid JSON: ${error.message}`);
  }
}

const rulesPath = path.join(root, "firestore.rules");
if (fs.existsSync(rulesPath)) {
  const rules = fs.readFileSync(rulesPath, "utf8");
  const requiredRulePatterns = [
    [/request\.auth\s*!=\s*null/, "authenticated access check"],
    [/match\s+\/Users\/\{userId\}/, "Users role-profile rule"],
    [/match\s+\/Customers\/\{customerId\}/, "Customers collection rule"],
    [/match\s+\/Technicians\/\{technicianId\}/, "Technicians collection rule"],
    [/role\(\)\s*==\s*['"]technician['"]/, "technician role check"],
    [/match\s+\/\{document=\*\*\}[\s\S]*allow\s+read,\s*write:\s*if\s+false/, "deny-by-default fallback"],
  ];
  for (const [pattern, label] of requiredRulePatterns) {
    if (!pattern.test(rules)) {
      failures.push(`firestore.rules is missing ${label}`);
    }
  }
}

const accessPath = path.join(root, "v1-access.js");
if (fs.existsSync(accessPath)) {
  const access = fs.readFileSync(accessPath, "utf8");
  const requiredAccessPatterns = [
    [/technician:\s*\[[^\]]*today-jobs/, "technician view restrictions"],
    [/profile\.technicianName\s*\|\|\s*profile\.displayName/, "technician identity matching"],
    [/record\.assignedTechnician\s*===\s*technicianName/, "assigned-job filtering"],
  ];
  for (const [pattern, label] of requiredAccessPatterns) {
    if (!pattern.test(access)) {
      failures.push(`v1-access.js is missing ${label}`);
    }
  }
}

const activationGuidePath = path.join(root, "docs/TECHNICIAN_ACTIVATION_AND_E2E_TEST.md");
if (fs.existsSync(activationGuidePath)) {
  const guide = fs.readFileSync(activationGuidePath, "utf8");
  for (const requiredTerm of ["Authentication > Users", "Users", "technicianName", "incognito", "Unassigned jobs hidden"]) {
    if (!guide.includes(requiredTerm)) {
      failures.push(`Technician activation guide is missing: ${requiredTerm}`);
    }
  }
}

if (warnings.length) {
  console.warn("RC1 readiness warnings:\n- " + warnings.join("\n- "));
}

if (failures.length) {
  console.error("RC1 smoke checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("RC1 structural, security, and technician-access smoke checks passed.");
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
  "production-reset.js",
  "functions/index.js",
  "functions/package.json",
  "firebase.json",
  "firestore.rules",
  "docs/TECHNICIAN_ACTIVATION_AND_E2E_TEST.md",
  "docs/DEPLOYMENT_ROLLBACK_RECOVERY.md",
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
      warnings.push(`Source markup still contains hard-coded ${label}; production-reset.js must neutralize it`);
    }
  }
}

const resetPath = path.join(root, "production-reset.js");
if (fs.existsSync(resetPath)) {
  const reset = fs.readFileSync(resetPath, "utf8");
  const requiredResetPatterns = [
    [/setText\("pmCount",\s*"0"\)/, "zero PM count"],
    [/setText\("partsCount",\s*"0"\)/, "zero parts count"],
    [/setText\("revenueCount",\s*"\$0"\)/, "zero revenue"],
    [/renderEmptyState\("scheduleList",\s*"No upcoming jobs"/, "empty schedule state"],
    [/renderEmptyState\("activityList",\s*"No recent activity"/, "empty activity state"],
    [/Live weather can be enabled later/, "weather-not-connected state"],
    [/getElementById\("addSampleJob"\)\?\.remove\(\)/, "sample-job control removal"],
  ];
  for (const [pattern, label] of requiredResetPatterns) {
    if (!pattern.test(reset)) {
      failures.push(`production-reset.js is missing ${label}`);
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
    if (firebaseConfig.hosting?.public !== ".") {
      failures.push('firebase.json hosting.public must be "."');
    }
    const hostingIgnore = firebaseConfig.hosting?.ignore;
    if (!Array.isArray(hostingIgnore) || !hostingIgnore.includes("functions/**")) {
      failures.push("firebase.json hosting.ignore must exclude functions/**");
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

const functionsPath = path.join(root, "functions/index.js");
if (fs.existsSync(functionsPath)) {
  const functionsSource = fs.readFileSync(functionsPath, "utf8");
  const requiredFunctionPatterns = [
    [/defineSecret\("JOBBER_CLIENT_ID"\)/, "Jobber client ID secret"],
    [/defineSecret\("JOBBER_CLIENT_SECRET"\)/, "Jobber client secret"],
    [/defineSecret\("JOBBER_CALLBACK_URL"\)/, "Jobber callback URL secret"],
    [/verifyIdToken\([^,]+,\s*true\)/, "revocation-aware Firebase token verification"],
    [/role\s*!==\s*"owner"/, "owner-role enforcement"],
    [/crypto\.randomBytes\(32\)/, "OAuth state entropy"],
    [/expiresAt:\s*Timestamp\.fromMillis\(Date\.now\(\)\s*\+\s*10\s*\*\s*60\s*\*\s*1000\)/, "expiring OAuth state"],
    [/refreshTokensIfNeeded\(\)/, "Jobber token refresh path"],
    [/app\.post\("\/sync\/clients",\s*requireOwner/, "owner-protected client sync"],
    [/Content-Security-Policy/, "backend security headers"],
  ];
  for (const [pattern, label] of requiredFunctionPatterns) {
    if (!pattern.test(functionsSource)) {
      failures.push(`functions/index.js is missing ${label}`);
    }
  }

  if (/client_secret\s*:\s*["'][^"']+["']/.test(functionsSource)) {
    failures.push("functions/index.js appears to contain a hard-coded OAuth client secret");
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

const recoveryGuidePath = path.join(root, "docs/DEPLOYMENT_ROLLBACK_RECOVERY.md");
if (fs.existsSync(recoveryGuidePath)) {
  const guide = fs.readFileSync(recoveryGuidePath, "utf8");
  for (const requiredTerm of [
    "firebase deploy --only firestore:rules,functions",
    "last known-good commit SHA",
    "Owner-account recovery",
    "Do not force-push `main`",
    "Never publish passwords",
  ]) {
    if (!guide.includes(requiredTerm)) {
      failures.push(`Deployment and recovery guide is missing: ${requiredTerm}`);
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

console.log("RC1 structural, production-empty-state, security, hosting, Jobber-backend, technician-access, and recovery smoke checks passed.");

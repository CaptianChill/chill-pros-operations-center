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
  "functions/index.js",
  "functions/package.json",
  "firebase.json",
];

const failures = [];
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
    />3<\/strong><small class="warning">1 In Progress<\/small>/,
    />2<\/strong><small class="warning">Awaiting Pickup<\/small>/,
    />\$8,450<\/strong>/,
    />96°F<\/strong>/,
  ];
  for (const pattern of placeholderPatterns) {
    if (pattern.test(html)) {
      failures.push(`Production placeholder detected in index.html: ${pattern}`);
    }
  }
}

if (failures.length) {
  console.error("RC1 smoke checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("RC1 smoke checks passed.");

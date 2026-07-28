#!/usr/bin/env node

const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function includes(source, value, message) {
  assert.ok(source.includes(value), message);
}

includes(app, 'TECHNICIAN_WORK_ORDER_STATUSES', 'Technician work-order statuses must remain defined.');
includes(app, 'renderTechnicianWorkOrder', 'Assigned jobs must retain an actionable work-order detail view.');
includes(app, 'getCompletionFields', 'Completion timestamps must be handled through the shared completion helper.');
includes(app, 'updateCustomerInFirebase(record, changes)', 'Work-order changes must persist through the existing Firebase update path.');
includes(app, 'getCompletedJobs', 'Completed-job reporting must remain implemented.');
includes(app, 'exportCompletedJobsCsv', 'Completed-job CSV export must remain implemented.');
includes(app, 'officeStatus === "Completed"', 'Reports must remain scoped to completed records.');

for (const field of ['findings', 'recommendation', 'workNotes', 'partsUsed', 'laborTimeNotes', 'photoNotes']) {
  includes(app, field, `Work-order field ${field} must remain persisted.`);
}

for (const id of ['reportsSearch', 'reportsTechnicianFilter', 'exportCompletedReports', 'completedReportsList']) {
  includes(html, `id="${id}"`, `Reports control #${id} must remain present in index.html.`);
}

assert.match(
  app,
  /ACTIVE_JOB_STATUSES\s*=\s*new Set\([\s\S]*?"Waiting on Parts"[\s\S]*?"Ready to Invoice"[\s\S]*?\)/,
  'Waiting on Parts and Ready to Invoice must remain active technician statuses.'
);

assert.match(
  app,
  /if\s*\(normalizedStatus\s*===\s*"Completed"\)[\s\S]*?completedAt/,
  'Completing a work order must set completedAt.'
);

console.log('Work-order and completed-reports contract checks passed.');

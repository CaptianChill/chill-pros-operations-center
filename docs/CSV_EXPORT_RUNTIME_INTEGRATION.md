# Completed-jobs CSV runtime integration

## Status

The branch includes a tested spreadsheet-safe CSV utility in `csv-export.js`, but the completed-jobs runtime export in `app.js` still uses a local `asCsvCell()` implementation. The utility tests are green; runtime integration remains incomplete.

This document defines the exact safe integration required before PR #25 is ready for browser validation.

## Required implementation

1. Load `csv-export.js` before `app.js` in `index.html`.
2. Remove the duplicate local `asCsvCell()` implementation from `app.js`.
3. Resolve the formatter once at startup:

```js
const csvExport = window.ChillProsCsvExport;
if (!csvExport?.asCsvCell) {
  throw new Error("Secure CSV export utility failed to load");
}
```

4. Use `csvExport.asCsvCell` for both the header row and every completed-job data cell.
5. Fail closed: do not silently fall back to the insecure formatter when the utility is absent.
6. Keep the existing filtered completed-jobs dataset, filename, and download behavior unchanged.

## Security contract

Every exported cell whose first character is one of the following must be prefixed with a single quote before CSV quoting:

- `=`
- `+`
- `-`
- `@`

Embedded quotes must remain doubled. Newlines and commas must remain enclosed by the existing CSV quoting behavior.

## Regression checks

Add a runtime integration contract that verifies:

- `index.html` loads `csv-export.js` before `app.js`;
- `app.js` references `window.ChillProsCsvExport.asCsvCell` (or an equivalent fail-closed binding);
- no duplicate local `function asCsvCell` remains in `app.js`;
- completed-job headers and row values both pass through the secure formatter;
- the export handler continues to use the current filtered report result set.

## Manual browser validation

From the completed-jobs Reports view:

1. Create or load a completed record with a customer name such as `=1+1`.
2. Export the filtered report.
3. Open the CSV in a spreadsheet application.
4. Confirm the value is displayed as text and no formula executes.
5. Repeat with values starting with `+`, `-`, and `@`.
6. Confirm ordinary text, commas, quotes, and multiline findings remain intact.

## Branch safety

This integration is limited to PR #25's feature branch. It must not modify Firestore rules, authentication, technician role routing, Jobber integration, or unrelated UI styling. Do not merge into `main` without explicit owner approval.

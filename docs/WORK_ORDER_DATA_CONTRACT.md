# Technician Work Order Data Contract

This document defines the persistence and authorization contract for the technician work-order and completed-report feature in PR #25.

## Customer document fields written by a technician

The work-order save path may update only the following fields on an existing `Customers/{documentId}` record:

- `officeStatus`
- `statusUpdatedAt`
- `completedAt`
- `workNotes`
- `findings`
- `recommendation`
- `partsUsed`
- `laborTimeNotes`
- `photoNotes`

The client must not permit a technician to alter customer identity, assignment, pricing, scheduling, ownership, tenant, or administrative fields through the work-order form.

## Allowed technician statuses

- `Scheduled`
- `Dispatched`
- `In Progress`
- `Paused`
- `Waiting on Parts`
- `Ready to Invoice`
- `Completed`

When a job becomes `Completed`, `completedAt` must be populated with an ISO-8601 timestamp. If a completed job is reopened, `completedAt` must be cleared.

## Authorization requirements

Client-side hiding is not authorization. Firestore rules must independently enforce all of the following before this feature is released:

1. The caller is authenticated.
2. The caller has an active technician role profile.
3. The customer record belongs to the caller's tenant.
4. The record is assigned to the authenticated technician.
5. The changed-key set is limited to the fields listed above.
6. `officeStatus` is one of the allowed technician statuses.
7. Administrative, assignment, customer identity, pricing, and scheduling fields are unchanged.

Owner and administrator writes may use a broader field set, but they must remain tenant-scoped.

## Compatibility blocker with RC1

The RC1 Firestore-rule workstream currently protects a narrower technician update set. Before PR #25 is combined with RC1, the rules and regression tests must be deliberately reconciled to permit `completedAt`, `workNotes`, `partsUsed`, and `laborTimeNotes` while preserving assignment and tenant authorization. Do not weaken the rules to `allow update: if signedIn()` or rely on UI visibility.

## Failure behavior

Work-order updates use optimistic UI. If Firestore rejects or fails the write, the client must restore the previous record values and show a failure message. Local storage must not permanently retain a state that the authoritative Firestore write rejected.

## Completed-report export safety

CSV export is an administrative output. Before production release, values beginning with spreadsheet formula prefixes (`=`, `+`, `-`, or `@`) must be neutralized so customer-entered text cannot execute as a formula when opened in spreadsheet software. Quotes, commas, and newlines must remain correctly escaped.

## Required release evidence

- Automated test proving the technician changed-key allowlist.
- Automated test proving unassigned technicians cannot update the record.
- Automated test proving invalid status values are rejected.
- Browser test: save work order, complete job, verify removal from active work, verify report visibility.
- CSV test covering commas, quotes, newlines, and formula-prefix neutralization.
- Live Firestore-rule emulator or deployed-environment evidence.

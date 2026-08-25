# Issue #34 release evidence checklist

This checklist is the release gate for the role-permission work in PR #36. Keep the pull request in draft until every required item is complete and linked to retained evidence.

## Automated validation

- [x] Static Firestore authorization contracts pass.
- [x] Firebase Emulator role matrix passes for owner, office, assigned technician, unassigned technician, missing-profile, and anonymous users.
- [x] Audit-event and audited-customer-mutation unit contracts pass.
- [x] Latest branch workflow run is green for commit `e02f304`.
- [ ] Re-run the complete workflow after reconciling the branch with current `main`.
- [ ] Record the resulting workflow URL and final head SHA below.

Final reconciled head SHA: `pending`

Final workflow URL: `pending`

## Production data protection

- [ ] Export or back up the production `Customers` collection.
- [ ] Record the backup identifier, location, timestamp, and operator.
- [ ] Run the read-only private-data inventory against production.
- [ ] Retain the JSON inventory artifact without customer values.
- [ ] Review every reported parent-document field before authorizing migration.
- [ ] Implement and peer-review the idempotent private-data migration.
- [ ] Verify each private write before removing any parent field.
- [ ] Re-run the inventory and require zero sensitive fields on technician-readable parent documents.

Backup evidence: `pending`

Inventory evidence: `pending`

Migration evidence: `pending`

## Controlled account validation

Use dedicated non-production or controlled production accounts. Do not use an owner email bypass.

- [ ] Owner can read and update authorized operational and private-pricing records.
- [ ] Office can perform configured operational and pricing actions.
- [ ] Assigned technician can read the assigned job and save only allowlisted work-order fields.
- [ ] Assigned technician cannot change assignment, customer identity, address, financial, cost, markup, margin, or supplier-pricing fields.
- [ ] Unassigned technician cannot read or mutate another technician's job.
- [ ] Missing-profile user fails closed.
- [ ] Anonymous user fails closed.
- [ ] Customer-facing view exposes only approved quote and service-documentation fields.
- [ ] Audit records are append-only and contain no secrets or sensitive values.

Account-validation evidence: `pending`

## Branch reconciliation and regression

- [ ] Reconcile `security/issue-34-role-permissions` with current `main` on the same feature branch.
- [ ] Review conflicts manually; do not discard newer production UI, hosting, or workflow changes.
- [ ] Confirm the Firestore workflow still runs on the reconciled branch.
- [ ] Re-test authentication and owner/office/technician routing.
- [ ] Re-test customer intake, Office Queue, Today's Jobs, technician dashboard, and work-order updates.
- [ ] Confirm no secrets, service-account files, private inventory output, or production exports are committed.

Conflict-resolution notes: `pending`

## Approval gate

- [ ] Security review has no unresolved critical or high findings.
- [ ] All evidence fields above are complete.
- [ ] PR #36 remains draft until the owner explicitly approves promotion.
- [ ] No merge into `main` without explicit owner approval.

# Private customer data migration

## Purpose

Firestore authorizes access at the document level. A technician who can read an assigned `Customers/{customerId}` document can read every field on that document. Internal cost, markup, margin, supplier pricing, procurement notes, and profit data therefore must not remain on technician-readable customer or job records.

This runbook defines the migration into the owner/office-only path introduced by Issue #34:

`Customers/{customerId}/Private/pricing`

The migration must be completed before the role-permission pull request is promoted from draft or deployed to production.

## Sensitive fields

Move any field representing or deriving from private commercial data, including:

- `internalCost`
- `cost`
- `unitCost`
- `supplierCost`
- `supplierPrice`
- `supplierPricing`
- `markup`
- `margin`
- `grossMargin`
- `profit`
- `profitAmount`
- `supplier`
- `supplierNotes`
- `procurementNotes`
- price-override justification and approval metadata

Do not copy customer-facing sale price, quote total, tax, approved public description, or technician-visible order status into the private document unless the application requires a private duplicate for reporting.

## Target document

Use one deterministic private document per customer/job record:

```text
Customers/{customerId}/Private/pricing
```

Recommended shape:

```json
{
  "schemaVersion": 1,
  "internalCost": 0,
  "supplierCost": 0,
  "markup": 0,
  "margin": 0,
  "supplier": "",
  "supplierNotes": "",
  "procurementNotes": "",
  "migratedAt": "server timestamp",
  "migratedBy": "admin uid"
}
```

Only write fields that exist on the source record. Do not manufacture zero values for unknown data in the production migration.

## Inventory dry run

The repository includes a read-only inventory utility. It scans the parent `Customers` collection and reports records containing known sensitive fields. It never writes or deletes Firestore data.

Authenticate with an administrative service account or Application Default Credentials, then run:

```bash
npm --prefix functions ci
npm --prefix functions run inventory:private-data -- --project chill-pros-ice-stream --output summary
```

Use `--output json` to create a machine-readable review artifact:

```bash
npm --prefix functions run inventory:private-data -- --project chill-pros-ice-stream --output json > private-data-inventory.json
```

Review the output before implementing or authorizing any mutation. The JSON report intentionally contains document paths and field names only, not sensitive values.

## Safe migration sequence

1. Export or back up the `Customers` collection.
2. Run the read-only inventory and retain its output with the release evidence.
3. Run the migration with an administrative server credential, never from a technician client.
4. For each source record, write the private document first using merge semantics.
5. Read the private document back and compare every migrated value with the source.
6. Remove migrated sensitive fields from the parent record only after verification succeeds.
7. Record the source path, migrated field names, timestamp, operator, and result in an immutable migration log.
8. Re-run the inventory query and require zero sensitive fields on parent records.
9. Validate access with owner, office, assigned-technician, unassigned-technician, missing-profile, and anonymous accounts.
10. Update owner/office application reads and writes to use the private document before production rollout.

## Idempotency and failure handling

- The migration must be safe to run more than once.
- Use deterministic document IDs and merge writes.
- Never delete parent fields when the private write or verification fails.
- Store per-record success or failure results so interrupted runs can resume.
- Treat conflicting private values as a manual-review condition; do not overwrite silently.
- Use batched writes only within Firestore limits and checkpoint progress between batches.

## Required validation

Release validation must prove:

- Owner and office accounts can read and update `Private/pricing`.
- Assigned and unassigned technicians cannot read, create, update, or delete private records.
- Missing-profile and anonymous sessions cannot access private records.
- Assigned technicians can still read the non-sensitive parent job and save allowed work-order updates.
- No sensitive field remains on any technician-readable parent document.
- Owner/office reporting and quote workflows still resolve private pricing correctly.

## Rollback

Retain the pre-migration export until production smoke tests pass. If rollback is required:

1. Stop application writes.
2. Restore parent fields from the verified export or migration log.
3. Revert owner/office readers to the previous schema.
4. Confirm record counts and representative values.
5. Remove private documents only after the parent restoration is verified.

## Release gate

Do not mark Issue #34 complete or merge its pull request until:

- the migration implementation has been reviewed,
- a dry run reports the expected affected record count,
- production backup is confirmed,
- parent-field cleanup reports zero remaining sensitive fields,
- emulator CI is green,
- and controlled live-account tests pass.

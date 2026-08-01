# FieldForge Field Proof Database Architecture

Status: Draft  
Issue: #18  
Target: paperless, human-verified field-service knowledge capture

## 1. Purpose

The Field Proof Database converts completed field-service activity into structured diagnostic knowledge that can be searched, reviewed, reused, and supplied to FieldForge intelligence modules.

This system is not a general chat archive. It is an auditable knowledge pipeline for real-world HVAC, refrigeration, ice-machine, and commercial-kitchen-equipment cases.

Automotive content is outside the core taxonomy. It may be retained only as an optional showcase module and must not consume core development priority.

## 2. Core operating rule

Automation may create and enrich drafts, but it may not silently publish a case as verified.

A case follows this lifecycle:

`captured -> draft -> needs_review -> verified -> published -> superseded`

Required human gates:

- Root cause confirmation
- Repair outcome confirmation
- OEM part-number verification
- Removal of customer-sensitive information
- Approval to publish into the reusable knowledge corpus

## 3. Primary data sources

Initial sources:

- Technician mobile intake
- Jobber job, visit, equipment, notes, forms, and attachments
- Chill Pros Operations Center records
- Manual office entry
- Existing FieldForge case documents and approved chat-derived workflows

Future sources:

- OEM service documents
- Supplier verification records
- Telemetry and connected equipment
- Customer approval and procurement records from APPE/SPO

Every imported fact must retain source provenance.

## 4. Proposed Firestore collections

### `tenants/{tenantId}`
Company-level boundary and configuration.

### `tenants/{tenantId}/fieldProofCases/{caseId}`
Canonical case record.

Required fields:

```json
{
  "caseId": "FPD-REF-000001",
  "tenantId": "chill-pros",
  "industry": "refrigeration",
  "status": "draft",
  "title": "Recurring capillary restriction",
  "equipment": {
    "manufacturer": "True",
    "model": "",
    "serial": "",
    "assetId": ""
  },
  "complaint": "",
  "symptoms": [],
  "measurements": [],
  "diagnosticSteps": [],
  "rootCause": {
    "value": "",
    "verificationStatus": "unverified",
    "confidence": 0
  },
  "repair": {
    "actions": [],
    "outcome": "",
    "verifiedAt": null
  },
  "parts": [],
  "lessonsLearned": [],
  "tags": [],
  "sourceRefs": [],
  "createdAt": null,
  "updatedAt": null,
  "createdBy": "",
  "reviewedBy": null,
  "publishedAt": null,
  "schemaVersion": 1
}
```

### `tenants/{tenantId}/fieldProofCases/{caseId}/revisions/{revisionId}`
Immutable snapshots of every material change.

### `tenants/{tenantId}/fieldProofCases/{caseId}/evidence/{evidenceId}`
Photos, documents, scan results, readings, customer statements, and OEM verification evidence.

### `tenants/{tenantId}/fieldProofCases/{caseId}/events/{eventId}`
Append-only audit trail.

### `tenants/{tenantId}/fieldProofIngestionJobs/{jobId}`
Tracks automated imports, retries, deduplication, failures, and source checkpoints.

### `tenants/{tenantId}/fieldProofCounters/{industryCode}`
Transactional sequence source for permanent IDs.

## 5. Industry codes

- `HVAC` — heating, ventilation, and air conditioning
- `REF` — commercial refrigeration
- `ICE` — ice machines
- `CKE` — commercial kitchen equipment
- `FBM` — frozen beverage machines

Optional future code:

- `AUTO` — automotive showcase only; disabled by default

## 6. Parts verification contract

Each part record must use this shape:

```json
{
  "description": "Door gasket",
  "quantity": 3,
  "partNumber": "",
  "partType": "OEM",
  "verificationStatus": "unverified",
  "manufacturerSource": null,
  "verifiedBy": null,
  "verifiedAt": null,
  "supersededBy": null
}
```

Rules:

1. A part number cannot be displayed as confirmed unless `verificationStatus` is `verified`.
2. Verification requires model/serial compatibility evidence or direct manufacturer confirmation.
3. Aftermarket and OEM numbers must remain distinct.
4. Supersessions must preserve the original number and evidence trail.

## 7. Automated ingestion workflow

1. Receive a completed-service event.
2. Validate tenant, source identity, and authorization.
3. Normalize equipment, notes, measurements, parts, and attachments.
4. Remove or quarantine unnecessary customer-sensitive content.
5. Calculate a deterministic deduplication fingerprint.
6. Match the event to an existing draft or create a new draft case.
7. Generate a proposed case title, symptom list, diagnostic sequence, and tags.
8. Mark uncertain fields explicitly as unverified.
9. Add the case to the review queue.
10. Notify the owner or designated reviewer.
11. Publish only after approval and required validation.

## 8. Deduplication

Recommended fingerprint inputs:

- Tenant ID
- Source system and source record ID
- Manufacturer
- Model
- Serial or asset ID
- Service date
- Normalized complaint

The same source event must be idempotent. Reprocessing it must update the ingestion record rather than create duplicate cases.

## 9. Search requirements

Search facets:

- Industry
- Manufacturer
- Model
- Serial or asset ID
- Symptom
- Fault code
- Root cause
- Part number
- Refrigerant
- Repair action
- Outcome
- Verification status
- Published date

Phase 1 may use Firestore composite indexes and normalized keyword arrays. Phase 2 should support a dedicated search index for semantic and faceted retrieval.

## 10. Security and tenant isolation

- Every document path is tenant-scoped.
- Client-supplied tenant IDs are not trusted without authenticated claims.
- Technicians may create drafts but cannot publish cases.
- Reviewers may verify assigned fields.
- Owners/admins may publish, supersede, and export.
- Audit events are append-only.
- Customer names, phone numbers, emails, addresses, payment data, and access credentials are excluded from the reusable corpus unless specifically required and authorized.

## 11. Required validation before publication

A case cannot become `published` unless it has:

- Valid permanent case ID
- Industry classification
- Manufacturer and model, or an explicit reason they are unavailable
- Complaint or symptom
- At least one diagnostic step
- Root cause status
- Repair outcome
- Source provenance
- Reviewer identity and timestamp
- No unresolved restricted-data findings

Confirmed OEM parts additionally require verification evidence.

## 12. Initial API/service boundaries

Recommended services:

- `FieldProofIngestionService`
- `FieldProofCaseService`
- `FieldProofReviewService`
- `FieldProofSearchService`
- `FieldProofEvidenceService`
- `FieldProofExportService`

Each service must operate inside an explicit tenant context and write audit events for state-changing operations.

## 13. Initial tests

- Reject cross-tenant reads and writes
- Ensure ingestion is idempotent
- Prevent publishing incomplete cases
- Prevent unverified OEM parts from becoming confirmed
- Preserve immutable revision snapshots
- Produce stable case IDs under concurrent creation
- Detect duplicate source events
- Retain source provenance during normalization
- Reject invalid lifecycle transitions
- Redact restricted customer data from publication payloads

## 14. Seed migration plan

Seed cases should be imported as drafts, including:

- Kool-It KGM-75 R290 case
- True recurring capillary restriction case
- Frozen beverage machine solenoid case
- Thermostat photo-identification workflow
- Existing OEM parts-sourcing workflows

No seed record should be marked verified based solely on chat text. Existing model/serial records, invoices, photographs, OEM confirmations, or technician approval must be attached first.

## 15. Delivery phases

### Phase 1 — foundation

- Schema
- Validation
- Lifecycle
- Audit records
- Manual draft creation
- Review queue

### Phase 2 — automation

- Jobber/Firebase event ingestion
- Attachment handling
- Deduplication
- Draft generation
- Owner notifications

### Phase 3 — intelligence

- Similar-case retrieval
- ADI integration
- SPO/API part verification links
- Outcome analytics
- First-time-fix and recurrence metrics

## 16. Definition of done for the first implementation PR

- Firestore-compatible typed schema exists
- Validation and lifecycle transition tests pass
- Draft creation service exists
- One ingestion adapter can create an idempotent draft
- Review action can verify or reject a case
- Publishing fails closed when requirements are unmet
- Documentation includes local setup and data migration instructions
- PR remains draft until owner approval

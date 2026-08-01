# Chill Pros AI Operations Engine

## Current milestone

The foundation establishes a safe, deterministic, testable operations-intelligence layer that can rank active work, recommend qualified technicians, and produce an owner/office brief without changing production data.

The engine currently provides:

- job-priority scoring based on workflow status, urgency language, record age, assignment state, contact completeness, and estimated value;
- an operational brief with active, urgent, unassigned, and ready-to-invoice counts;
- recommended next actions for intake review, dispatch, quotes, parts follow-up, field progress, and invoice handoff;
- explainable technician recommendations using explicit skills, availability, service area, emergency capability, and active workload;
- a read-only technician normalization adapter with explicit identity validation, safe operational defaults, duplicate detection, and immutable output;
- explicit exclusion of completed work and inactive technicians from active recommendations;
- a deterministic approval policy that classifies informational, office-review, owner-approval, prohibited, and unknown actions;
- immutable advisory recommendation audit records with stable timestamps, correlation identifiers, and recursive credential redaction;
- a feature-flagged owner-facing Daily Operations Brief UI;
- de-identified workflow evaluation fixtures covering emergency refrigeration, parts follow-up, incomplete field notes, and completed-work exclusion;
- an advisory-only execution guard that blocks autonomous dispatch, record changes, customer communication, purchasing, quoting, and invoicing.

## Safety boundary

The AI Operations Engine is advisory-only. It must not directly:

- assign or reassign technicians;
- update job status;
- contact customers;
- generate or send binding quotes or invoices;
- order parts;
- modify Firebase, Jobber, payment, or accounting records.

Every operational action requires approval and execution by an authenticated owner or office user. The execution guards intentionally return `allowed: false` for all recommendations in this milestone.

## Feature-flagged Daily Operations Brief

The browser UI is disabled by default. It reads the locally normalized Operations Center queue and renders an explainable brief inside the existing AI view only after this local feature flag is enabled:

```js
localStorage.setItem("chillProsFeatures:aiOperationsBrief", "true");
location.reload();
```

Disable it with:

```js
localStorage.removeItem("chillProsFeatures:aiOperationsBrief");
location.reload();
```

The brief is read-only. Its Refresh button re-reads the local queue, recalculates deterministic recommendations, and renders escaped customer-controlled text. It does not write to Firestore, Jobber, local queue records, or technician assignments.

## Integration contract

Browser usage:

```html
<script src="ai/operations-engine.js"></script>
<script src="ai/daily-operations-brief.js"></script>
```

The AI feature branch loads both modules from `firebase-config.js`. The UI module mounts only when the feature flag is explicitly set to `true`.

Node/test usage:

```js
const {
  buildOperationsBrief,
  recommendTechnicians
} = require("./ai/operations-engine");
const { createAuditRecord } = require("./ai/recommendation-audit");
const { eligibleTechnicians } = require("./ai/technician-data-adapter");

const brief = buildOperationsBrief(records, { now: new Date().toISOString() });
const normalizedTechnicians = eligibleTechnicians(rawTechnicianRecords);
const candidates = recommendTechnicians(job, normalizedTechnicians);
const auditRecord = createAuditRecord(recommendation, {
  actorRole: "owner",
  tenantId: "chill-pros",
  correlationId: job.id
});
```

The operations brief accepts normalized job/customer records containing the fields already used by the Operations Center, including `officeStatus`, `complaint`, `findings`, `equipmentType`, `createdAt`, `assignedTechnician`, `phone`, `email`, and `estimatedAmount`.

Technician recommendation input should use explicit fields rather than inferred personal data.

Job fields:

- `requiredSkills`: array or comma-separated string, such as `refrigeration`, `r290`, `ice machines`, or `commercial kitchen`;
- `serviceArea`, `city`, or `locationArea`;
- `complaint`, `findings`, and `equipmentType` for urgency detection.

Technician fields:

- `id` or `firestoreId`;
- `name`;
- `skills`: array or comma-separated string;
- `serviceAreas` or `serviceArea`;
- `available`: boolean;
- `active`: boolean;
- `emergencyCapable`: boolean;
- `activeJobCount`: non-negative number.

The output is a ranked explanation only. Every candidate includes `advisoryOnly: true` and `requiresHumanApproval: true`. The function never writes an assignment.

## Read-only technician data adapter

`ai/technician-data-adapter.js` converts supported technician record aliases into the explicit contract used by the recommendation engine. It never queries or writes Firebase itself.

The adapter:

- requires a stable `id`, `firestoreId`, or `uid` and a technician name;
- normalizes skill and service-area lists to lowercase unique values;
- safely defaults missing availability to unavailable;
- validates active-job and capacity counts as non-negative integers;
- rejects duplicate normalized technician IDs;
- freezes normalized records and result arrays;
- filters inactive and unavailable technicians by default, with explicit planning-mode overrides.

A future Firebase reader should remain a separate authenticated, read-only boundary and pass retrieved records through this adapter before calling `recommendTechnicians`.

## Recommendation audit contract

`ai/recommendation-audit.js` creates immutable, serializable records for later human review. It does not persist data by itself. Any future persistence adapter must remain owner-controlled and must not alter operational records.

Each audit record includes:

- a normalized UTC timestamp;
- recommendation, action, tenant, source, actor-role, and correlation identifiers;
- explicit `advisoryOnly: true` and `requiresHumanApproval: true` safeguards;
- sanitized evidence and metadata;
- recursive redaction for credential-like keys such as access tokens, refresh tokens, API keys, passwords, secrets, authorization headers, and seed phrases.

The audit helper deliberately avoids storing raw credentials and provides stable key ordering to support deterministic tests and later integrity verification.

## De-identified evaluation fixtures

`tests/fixtures/ai-operations-evaluation.json` contains synthetic, non-customer records designed to exercise representative Chill Pros workflows without exposing customer contact information or production identifiers.

The fixture suite verifies:

- emergency refrigeration work enters the advisory review queue;
- incomplete field notes produce a follow-up recommendation;
- completed work is excluded from active recommendations;
- output remains deterministic, immutable, advisory-only, and non-executable;
- evaluation does not mutate the source fixture.

Real customer records must not be committed as test fixtures. Any future production-derived evaluation case must be manually de-identified before it enters the repository.

## External-model readiness evidence

`ai/milestone-readiness.js` evaluates whether the policy decisions and technical evidence required for a separate external-model integration workstream are complete. It never authorizes integration or production execution.

Owner approval evidence must include a nonblank approver identity, a policy version, a canonical UTC approval timestamp, and an `approvedPolicy` snapshot containing the provider, monthly budget, privacy policy, retention period, audit storage, and human-approval policy that the owner actually approved. The evaluator normalizes policy text and compares every approved policy field against the current decision set. Any later policy change invalidates the approval record and requires fresh owner approval. It also rejects malformed timestamps and approval records dated more than five minutes after the assessment time. Tests may pass an explicit canonical `evaluatedAt` timestamp so clock-skew behavior remains deterministic. The returned assessment records its evaluation timestamp and remains immutable, advisory-only, and non-executable.

The integration policy accepts budget and retention values only as explicit finite JavaScript numbers. Numeric strings, booleans, `null`, `NaN`, and infinities are rejected rather than coerced, keeping policy validation aligned with the readiness gate and preventing ambiguous configuration evidence.

## Next milestones

1. Connect the read-only normalized technician adapter to an authenticated Firebase technician reader after RC1 data access is validated.
2. Add a human-controlled persistence adapter for audit records after the storage and retention policy is approved.
3. Add an external language-model adapter only after provider, budget, privacy, retention, and human-approval policies are approved.
4. Integrate the feature into production only after RC1 is complete and the owner explicitly approves the AI pull request.

## Definition of completion for the foundation milestone

- deterministic engine committed on an isolated AI feature branch;
- automated tests cover ranking, urgency, completed-job exclusion, invoice handoff, missing contact data, technician recommendations, invalid input, safe UI rendering, feature-flag behavior, approval classification, audit redaction, technician normalization, de-identified workflow evaluation, and no-autonomous-execution guards;
- architecture, data contract, feature flag, audit contract, technician adapter, evaluation-fixture policy, and safety boundary documented;
- feature-flagged owner Daily Operations Brief implemented;
- draft pull request opened into `main`;
- CI green;
- no changes merged into RC1 or production without owner approval.

The deterministic foundation milestone is functionally complete. External language-model integration and audit persistence remain separate milestones requiring owner decisions on provider, budget, privacy, retention, storage, and approval policy.

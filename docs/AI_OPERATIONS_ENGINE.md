# Chill Pros AI Operations Engine

## Current milestone

The first milestone establishes a safe, deterministic, testable operations-intelligence layer that can rank active work, recommend qualified technicians, and produce an owner/office brief without changing production data.

The engine currently provides:

- job-priority scoring based on workflow status, urgency language, record age, assignment state, contact completeness, and estimated value;
- an operational brief with active, urgent, unassigned, and ready-to-invoice counts;
- recommended next actions for intake review, dispatch, quotes, parts follow-up, field progress, and invoice handoff;
- explainable technician recommendations using explicit skills, availability, service area, emergency capability, and active workload;
- explicit exclusion of completed work and inactive technicians from active recommendations;
- an advisory-only execution guard that blocks autonomous dispatch, record changes, customer communication, purchasing, quoting, and invoicing.

## Safety boundary

The AI Operations Engine is advisory-only. It must not directly:

- assign or reassign technicians;
- update job status;
- contact customers;
- generate or send binding quotes or invoices;
- order parts;
- modify Firebase, Jobber, payment, or accounting records.

Every operational action requires approval and execution by an authenticated owner or office user. The `validateRecommendationForExecution` guard intentionally returns `allowed: false` for all recommendations in this milestone.

## Integration contract

Browser usage:

```html
<script src="ai/operations-engine.js"></script>
<script>
  const brief = window.ChillProsAiOperations.buildOperationsBrief(queue);
</script>
```

Node/test usage:

```js
const {
  buildOperationsBrief,
  recommendTechnicians
} = require("./ai/operations-engine");

const brief = buildOperationsBrief(records, { now: new Date().toISOString() });
const candidates = recommendTechnicians(job, technicians);
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

## Next milestones

1. Add an owner-facing Daily Operations Brief UI behind a feature flag.
2. Connect technician recommendations to a read-only, normalized technician data adapter.
3. Add explainable follow-up flags for quotes, parts, incomplete service notes, and invoice handoff.
4. Add an external language-model adapter only after provider, budget, privacy, retention, and human-approval policies are approved.
5. Add evaluation fixtures based on de-identified real Chill Pros workflows before any production rollout.

## Definition of completion for the foundation milestone

- deterministic engine committed on an isolated AI feature branch;
- automated tests cover ranking, urgency, completed-job exclusion, invoice handoff, missing contact data, technician recommendations, invalid input, and the no-autonomous-execution guard;
- architecture, data contract, and safety boundary documented;
- draft pull request opened into `main`;
- no changes merged into RC1 or production without owner approval.

The foundation remains a draft until CI is green and the feature-flagged owner UI is reviewed.
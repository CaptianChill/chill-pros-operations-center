# Chill Bro 2.0 — BoodaFlow Build

## Goal
Embed a role-aware AI field copilot into Chill Pros Operations Center for owner and technicians. The assistant should provide field diagnostics, technical service guidance, parts intelligence, equipment/job context, training, and draft quote/invoice support without allowing unapproved financial actions.

## Phase 1 — Functional Core
- Secure Firebase Functions backend using `OPENAI_API_KEY` secret.
- Firebase Auth required for every AI request.
- Owner + technician roles supported.
- Modes: diagnostic, parts, training, job-help, quote-draft, general technical.
- Firestore context retrieval from current job/equipment/known field records.
- Safe structured response with answer, next checks, evidence/context used, and escalation notes.
- Quote/invoice generation remains draft-only until an authorized user approves.

## Phase 2 — Voice + Vision
- Realtime voice worker with LiveKit/OpenAI after the text core is stable.
- Camera/data-plate/wiring-diagram input.
- Conversation continuity tied to job/equipment IDs.

## Phase 3 — Mascot UI
- Replace generic launch button with Chill Bro mascot symbol.
- Persistent but unobtrusive floating presence on desktop/mobile.
- Context-aware animation/state: idle, listening, thinking, warning, ready.

## BoodaFlow rules
- Ship smallest safe production slices.
- Never expose API keys client-side.
- Fail closed on missing auth/context.
- Never invent OEM part numbers, measurements, service history, or pricing.
- Clearly distinguish observed facts, retrieved records, AI inference, and technician confirmation.
- Do not submit quotes/invoices or alter financial records without explicit authorized confirmation.

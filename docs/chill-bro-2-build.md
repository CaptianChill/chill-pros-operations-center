# Chill Bro 2.0 — BoodaFlow Build

## Goal
Embed a role-aware AI field copilot directly into Chill Pros Operations Center for owner and technicians. The assistant should provide field diagnostics, technical service guidance, parts intelligence, equipment/job context, training, and draft quote/invoice support using Chill Pros-owned data and workflows.

## Architecture rule — No Jobber dependency
- Chill Bro must not depend on Jobber for customers, jobs, equipment, quotes, invoices, or payments.
- Chill Pros Operations Center remains the source of truth for its own operational records.
- Existing Jobber code, if retained elsewhere in the repository for legacy use, is not part of the Chill Bro runtime path.
- New Chill Bro features should read/write only Chill Pros-owned Firestore collections and approved native service modules.

## Phase 1 — Functional Core
- Secure Firebase Functions backend using `OPENAI_API_KEY` secret.
- Firebase Auth required for every AI request.
- Owner + technician roles supported.
- Modes: diagnostic, parts, training, job-help, quote-draft, invoice-note, general technical.
- Firestore context retrieval from current Chill Pros job/equipment/known field records.
- Safe structured response with answer, next checks, evidence/context used, and escalation notes.
- Quote/invoice generation remains draft-only until an authorized user approves.

## Native quoting, invoicing, and payments
- Quotes and invoices are created and stored natively in Chill Pros Operations Center.
- Chill Bro may prepare line items, scope, notes, parts/labor suggestions, and draft totals, but cannot charge a customer or move funds without explicit authorized confirmation.
- Payment collection should use a secure processor/bank-link provider rather than storing online-banking usernames/passwords or raw account credentials.
- Preferred simple payment paths: ACH/bank transfer for low-cost payments plus card payments when needed.
- Business-bank settlement should deposit to the Chill Pros business account through the selected processor.
- Payment state, receipt/reference ID, invoice balance, and settlement status should be stored in Chill Pros records.

## Phase 2 — Voice + Vision
- Realtime voice worker with LiveKit/OpenAI after the text core is stable.
- Camera/data-plate/wiring-diagram input.
- Conversation continuity tied to native Chill Pros job/equipment IDs.

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
- Do not submit quotes/invoices, charge customers, or move funds without explicit authorized confirmation.
- Keep the native Chill Pros path simple; do not add external dependencies unless they materially reduce risk or are required for secure payments/voice infrastructure.

# Chill Bro V4 / Operations Center Source of Truth

## Visual source of truth

The approved Operations Center UI is the preserved v0/Vercel project:

- Project: `chill-pros-operation-ceneter-v2`
- Vercel project id: `prj_Wq2xi8nQzFQqGTI51SopDZoi4Pku`
- Preserved deployment: `dpl_FUSXSKKJ2USpEMMf4q1nCQR6qQ3T`
- v0 chat id recorded on the deployment: `oC7tJVEtyTz`

The live preserved build is the visual contract. Do not substitute another dashboard generation or reinterpret the layout.

Required UI landmarks include the Chill Pros Command Center top branding, Workspace navigation, Dashboard, Service Intake, Dispatch / Jobs, Office Queue, Quotes, Invoices & Payments, AI Parts Intelligence, Technicians, Clients, Equipment, Maintenance, Reports, BoodaFlow, six KPI cards, Today's Dispatch, Office Queue, Parts Intelligence, Revenue snapshot, BoodaFlow card, and the mobile Today / Jobs / Intake / Chill Bro / Quote navigation.

## Chill Bro product contract

Chill Bro is a private owner/technician field copilot, not a customer receptionist and not an IONOS dependency.

Capabilities to preserve:
- HVAC/R diagnostics
- refrigeration
- ice machines
- commercial kitchen equipment
- parts intelligence and OEM/manual research
- PM coaching and technician training
- equipment, customer and service-history context
- quote and invoice drafting assistance
- camera / data-plate / field-photo vision
- browser voice input and spoken replies
- Firebase staff authentication
- secure server-side OpenAI access
- BoodaFlow routing and safe fallback

Personality direction: an original Chill Pros character with energetic, comedic, expressive Shorty Meeks-inspired energy. Do not imitate or clone Marlon Wayans' voice or likeness; keep the character original to Chill Pros.

## Architecture rules

1. One frontend shell only: the approved v0 visual contract.
2. One Chill Bro client only.
3. Native `chillBroApi` is the authenticated internal AI baseline.
4. Web research may augment the answer but must fall back safely to the authenticated internal answer.
5. IONOS must not control Chill Bro availability and must not be auto-loaded by the Operations Center.
6. Legacy shell overlays must not rewrite `document.body` or replace the approved UI after load.
7. Current Firebase/OpenAI/native billing backend work is preserved unless a failing test proves it must change.
8. Do not promote to production until the exact UI, staff auth, real AI response, voice path, and mobile launcher have been verified.

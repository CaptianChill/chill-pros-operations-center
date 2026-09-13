# Chill Bros Payroll Module

## Purpose

Add a native payroll workspace to the Chill Bros Operations Center while keeping regulated money movement, payroll tax remittance, and statutory filing behind a qualified payroll/ACH provider.

## Roles

### Owner
Full payroll authority. Can view compensation, bank/tax setup status, approve payroll, submit payroll, manage payroll users, correct payroll, export reports, and configure integrations.

### Payroll Administrator
Recommended non-owner payroll role. Can review timecards, maintain employee payroll profiles, prepare payroll, view payroll reports, create paystubs, and submit payroll only when the Owner has granted submit authority.

### Office Manager
May review time and flag corrections but cannot see bank-account details, tax identifiers, full compensation history, or submit payroll.

### Technician / Employee
Can see only their own hours, pay history, paystubs, PTO, and direct-deposit setup status.

## Permission model

Use explicit permissions rather than role-name checks for sensitive actions:

- payroll.view
- payroll.prepare
- payroll.edit_compensation
- payroll.approve
- payroll.submit
- payroll.correct
- payroll.export
- payroll.manage_users
- payroll.manage_integration
- time.review_all
- employee.payroll_profile.read
- employee.payroll_profile.write
- employee.self_pay.read

Owner receives all permissions. Payroll Administrator receives view, prepare, reports, employee payroll profile, and time review by default. Submission and correction are owner-controlled grants.

## Workflow

1. Employee clocks in/out in Chill Bros.
2. Timecard engine calculates regular and overtime hours.
3. Payroll Administrator reviews exceptions and prepares the pay run.
4. Chill Bros calculates gross wages and creates a payroll preview.
5. Owner reviews payroll cash requirement and approves.
6. Regulated provider receives the approved payroll through its API.
7. Provider handles ACH, tax remittance, and required filings.
8. Chill Bros stores provider status, payroll ledger entries, and employee-facing paystub data.

## Core screens

### Payroll Dashboard
- next payday
- pay-period status
- total regular hours
- total overtime hours
- gross payroll
- estimated employee withholding
- estimated employer taxes
- net payroll
- total cash requirement
- exceptions requiring review

### Pay Run
- employee
- regular hours
- overtime hours
- rate
- bonus/commission
- gross pay
- deductions
- taxes
- net pay
- validation status

### Employees
- employment status
- pay type
- hourly rate / salary
- overtime eligibility
- withholding setup status
- direct-deposit setup status
- PTO
- YTD totals

### Time Review
- raw clock events
- calculated shifts
- missed punches
- overtime flags
- edited-time audit trail

### Paystubs
Employee self-service history with gross, taxes, deductions, net pay, payment status, and YTD totals.

### Payroll Reports
- payroll register
- labor cost by technician
- labor cost by job/customer
- overtime report
- payroll liability report
- YTD employee earnings
- provider reconciliation

## Data model

Do not store raw bank-account or routing numbers in the Chill Bros database. Store provider tokens and masked metadata only.

Suggested collections/tables:

- payroll_profiles
- pay_periods
- time_entries
- time_adjustments
- pay_runs
- pay_run_items
- deductions
- pto_balances
- paystubs
- payroll_events
- payroll_integrations
- payroll_audit_log

Every mutation to compensation, approved hours, deductions, approval status, provider submission, or correction must create an immutable audit event.

## Security requirements

- Separate payroll permissions from normal office permissions.
- Owner approval required before live submission by default.
- MFA should be required for Owner and Payroll Administrator before live ACH submission is enabled.
- Never expose full SSN, tax IDs, bank routing, or bank account numbers in client-side storage or logs.
- Sensitive provider tokens stay server-side only.
- Employee self-service queries must be scoped to the authenticated employee.

## Implementation phases

### Phase 1: Internal payroll foundation
- role/permission model
- employee payroll profiles
- timecard review
- regular/overtime gross-pay calculation
- pay-period creation
- draft payroll preview
- paystub draft generation
- audit log

No live ACH or automatic tax filing in Phase 1.

### Phase 2: Provider integration
- embedded payroll provider onboarding
- bank-account/provider token connection
- tax setup status
- payroll submission API
- provider webhook/status reconciliation
- payroll cancellation/correction rules

### Phase 3: Employee self service
- paystub history
- PTO
- direct-deposit setup handoff to provider-hosted secure flow
- year-end document access

### Phase 4: Operations intelligence
- labor cost by job
- gross margin after labor
- overtime forecasting
- payroll cash forecast
- technician utilization

## Recommended job title

Use **Payroll Administrator** for the dedicated non-owner role. If the person will also handle onboarding, benefits, personnel files, and HR administration, use **Payroll & HR Administrator**.

# Chill Pros Operations Center — RC1 Validation Evidence

Use this record to capture the final production checks required before Draft PR #12 can be promoted from draft.

## Test environment

- Date/time:
- Tester:
- Deployed application URL:
- Firebase project:
- Git commit SHA:
- Browser/device:

## 1. Technician account activation

- [ ] Technician user created in Firebase Authentication
- [ ] Matching user profile created with `role: technician`
- [ ] Matching operational technician record created
- [ ] Technician can sign in successfully
- [ ] Technician cannot access owner-only settings
- [ ] Technician cannot see unassigned jobs
- [ ] Technician can see an assigned job

Evidence:

- Technician UID:
- Test technician email:
- Assigned test job ID:
- Screenshot or notes:

## 2. Jobber production verification

- [ ] `JOBBER_CLIENT_ID` secret configured
- [ ] `JOBBER_CLIENT_SECRET` secret configured
- [ ] `JOBBER_CALLBACK_URL` secret configured
- [ ] OAuth callback URL exactly matches the Jobber app configuration
- [ ] Owner can start the Jobber connection flow
- [ ] OAuth callback returns to the Chill Pros application
- [ ] Integration status reports connected
- [ ] Client synchronization completes successfully
- [ ] Token refresh succeeds after an expired or near-expiry token
- [ ] Firebase Functions logs contain no critical errors

Evidence:

- Connected Jobber account:
- Client count synchronized:
- Firebase Functions deployment/version:
- Relevant log timestamp:
- Screenshot or notes:

## 3. End-to-end core workflow

Test one disposable customer/job from creation through invoice handoff.

- [ ] Create customer and equipment intake
- [ ] Record appears in Office Queue
- [ ] Change status to Scheduled
- [ ] Assign technician
- [ ] Job appears in Today's Jobs
- [ ] Assigned technician can see the job
- [ ] Technician changes status to In Progress
- [ ] Technician records findings/recommendation
- [ ] Technician changes status to Completed
- [ ] Owner/office view updates without duplicate records
- [ ] Completed record reaches invoice handoff state
- [ ] Customer, equipment, technician, and status data remain consistent

Evidence:

- Customer name:
- Job ID:
- Technician:
- Final status:
- Invoice handoff result:
- Screenshot or notes:

## 4. Data integrity and access-control observations

Record any unexpected behavior, duplicate records, stale UI state, unauthorized access, or missing data.

| Severity | Area | Observation | Reproduction steps | Expected behavior | GitHub issue |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## RC1 decision

- [ ] GO — all P0 checks passed
- [ ] CONDITIONAL GO — only documented non-P0 defects remain
- [ ] NO-GO — one or more P0 checks failed

Decision notes:

Approver:

Date:

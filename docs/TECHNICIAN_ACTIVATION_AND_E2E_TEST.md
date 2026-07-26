# Technician Activation and End-to-End Validation

This runbook covers the RC1 prerequisite for proving that a technician can securely sign in and see only assigned work.

## Prerequisites

- Firebase project: `chill-pros-ice-stream`
- Firebase Email/Password authentication enabled
- `firestore.rules` deployed from this repository
- Owner account able to sign in to the Operations Center
- A second email address controlled by the owner for the test technician

## 1. Create the Firebase Authentication user

1. Open Firebase Console.
2. Select **chill-pros-ice-stream**.
3. Open **Authentication > Users**.
4. Select **Add user**.
5. Enter the technician test email and a temporary password.
6. Copy the new user's Firebase UID.

## 2. Create the role profile

In **Firestore Database**, create this document:

- Collection: `Users`
- Document ID: the Firebase Authentication UID copied above

Use fields matching this structure:

```json
{
  "displayName": "Test Technician",
  "email": "technician-test@example.com",
  "role": "technician",
  "technicianName": "Test Technician"
}
```

The `technicianName` value must exactly match the technician name selected when assigning a job. Matching is currently name-based and case-sensitive.

## 3. Create the technician operational record

1. Sign in as owner.
2. Open **Technicians**.
3. Select **Add Technician**.
4. Create a technician named exactly `Test Technician`.
5. Confirm the technician appears in Technician Management and in assignment selectors.

The Authentication user controls sign-in. The `Users` document controls the application role. The `Technicians` record is the operational dispatch record used for job assignment.

## 4. Assign a test job

1. Create a clearly labeled test customer, such as `RC1 Technician Test`.
2. Submit the record to the Office Queue.
3. Change the status to `Scheduled` or `Dispatched`.
4. Assign `Test Technician`.
5. Confirm the job appears in Today's Jobs while signed in as owner.

## 5. Verify technician access

Use a private/incognito browser window or a second browser so the owner session remains available.

1. Sign in using the technician test email and temporary password.
2. Confirm the app routes to the technician-facing workflow.
3. Confirm the technician can see the assigned RC1 test job.
4. Confirm unrelated jobs assigned to other technicians are not displayed.
5. Confirm owner-only and office-only controls are hidden, including adding technicians and exporting the office queue.
6. Update the test job status and confirm the owner session receives the change without a manual refresh.

## 6. Pass/fail evidence

Record the following in GitHub issue #11 or Draft PR #12:

- Test date and device/browser
- Technician email used, with the address partially masked
- Authentication success or failure
- Assigned job visible: yes/no
- Unassigned jobs hidden: yes/no
- Restricted controls hidden: yes/no
- Realtime status update visible to owner: yes/no
- Screenshots with customer-sensitive information removed

## Failure routing

- **Sign-in fails:** verify Email/Password is enabled and reset the technician password.
- **User signs in but has wrong navigation:** verify `Users/{uid}.role` is exactly `technician`.
- **Assigned job is missing:** verify `technicianName` exactly matches `assignedTechnician` on the customer/job record.
- **Permission denied:** deploy the repository's `firestore.rules` and verify the `Users` profile document exists.
- **All jobs are visible:** treat as a P0 authorization defect and do not approve RC1.

## Cleanup

After RC1 validation, either retain the account as a documented test user with no production assignments or delete the Authentication user, `Users` role document, `Technicians` record, and RC1 test customer.
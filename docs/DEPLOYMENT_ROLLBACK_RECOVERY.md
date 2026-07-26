# Chill Pros Operations Center — Deployment, Rollback, Backup, and Recovery

This runbook is the RC1 operating procedure for deploying the Chill Pros Operations Center and recovering safely from a failed release or owner-account problem.

## Deployment scope

The system currently has two deployment surfaces:

1. Static web application hosted from the repository/GitHub Pages entry points.
2. Firebase services for Authentication, Firestore security rules, and Cloud Functions used by the Jobber integration.

A release is not complete until both surfaces are verified.

## Pre-deployment checklist

- Confirm the target pull request is not a draft and all required checks are green.
- Confirm `main` contains the intended release commit.
- Run the RC1 checks locally or through GitHub Actions.
- Confirm `firebase.json` references `firestore.rules`.
- Confirm Firebase CLI is authenticated to the `chill-pros-ice-stream` project.
- Confirm the Jobber secrets exist in Firebase Functions configuration:
  - `JOBBER_CLIENT_ID`
  - `JOBBER_CLIENT_SECRET`
  - `JOBBER_CALLBACK_URL`
- Record the current production commit SHA before deploying.
- Export or otherwise preserve any business-critical Firestore data before a material schema or security-rule change.

## Standard deployment

### Static application

1. Merge only an explicitly approved pull request into `main`.
2. Confirm GitHub Pages completes its deployment.
3. Open the production URL in a private browser window.
4. Confirm owner sign-in, dashboard loading, customer intake, office queue, and Today's Jobs.
5. Confirm the iPhone entry point still loads and routes correctly.

### Firebase rules and Functions

From an authenticated workstation with the Firebase CLI:

```bash
firebase use chill-pros-ice-stream
firebase deploy --only firestore:rules,functions
```

After deployment:

```bash
firebase functions:log
```

Verify there are no new authentication, permission, OAuth callback, token-refresh, or client-sync errors.

## Post-deployment smoke test

- Owner can sign in.
- Unauthorized users cannot access owner-only views.
- Customer intake writes successfully.
- Office Queue updates without a hard refresh.
- Scheduled jobs appear in Today's Jobs.
- Technician filtering shows only assigned work.
- Jobber connection status loads.
- Jobber client sync completes or returns a clear, non-destructive error.
- No sample customer data is introduced into production.

## Rollback procedure

### Static application rollback

1. Identify the last known-good commit SHA.
2. Create a rollback branch from `main`.
3. Revert the faulty merge or restore the affected files to the known-good commit.
4. Open a draft pull request describing the incident and rollback scope.
5. Run CI.
6. Merge only after explicit owner approval.
7. Verify the production URL after GitHub Pages redeploys.

Do not force-push `main` unless repository recovery is otherwise impossible.

### Firebase Functions rollback

1. Review Firebase Functions logs to isolate the failing deployment.
2. Restore `functions/` from the last known-good commit on a rollback branch.
3. Run syntax and dependency checks.
4. Deploy only Functions:

```bash
firebase deploy --only functions
```

5. Verify `/health`, owner authentication, Jobber status, and client sync.

### Firestore rules rollback

Treat Firestore rules changes as security-sensitive.

1. Restore the last known-good `firestore.rules` file on a rollback branch.
2. Review the diff to ensure the rollback does not reopen broad access.
3. Deploy only rules:

```bash
firebase deploy --only firestore:rules
```

4. Test owner, office, technician, and unauthenticated access separately.

## Data backup and recovery

Before material data migrations or destructive maintenance:

- Record the date, operator, source commit, and reason.
- Export Firestore using the Google Cloud/Firebase-supported export workflow available to the project.
- Store the export in an access-controlled project bucket.
- Do not place customer exports, tokens, or credentials in GitHub.
- Verify a restore procedure in a non-production project before relying on it for production recovery.

For accidental record deletion, prefer restoring only the affected collection or documents when the available tooling permits it, rather than overwriting the entire production database.

## Owner-account recovery

If the owner cannot sign in:

1. Confirm Firebase Authentication Email/Password remains enabled.
2. Send a password-reset email from Firebase Authentication.
3. Confirm the owner Authentication user still exists.
4. Confirm the matching `Users/{uid}` Firestore profile has role `owner`.
5. Confirm the email matches the authorized owner identity expected by the application and backend.
6. Check Firebase Authentication and Functions logs for disabled-user, expired-token, or permission failures.

If the owner user must be recreated:

1. Create the Authentication user with an owner-controlled email.
2. Create the matching `Users/{uid}` profile with role `owner`.
3. Sign in through a private browser window.
4. Verify owner-only navigation and Jobber controls before disabling the old account.

Never publish passwords, reset links, Firebase service-account keys, Jobber secrets, access tokens, refresh tokens, or customer data in an issue or pull request.

## Incident record

For every production failure, record:

- Date and time
- Affected release SHA
- User-visible symptoms
- Logs or error codes with secrets removed
- Rollback or fix applied
- Verification steps
- Follow-up issue and owner approval status

## RC1 release evidence

Before marking RC1 ready for review, attach or reference:

- Successful CI run
- Production smoke-test result
- Technician access test result
- Jobber integration verification
- Deployment operator and date
- Last known-good commit SHA
- Confirmation that rollback and owner-recovery procedures were reviewed

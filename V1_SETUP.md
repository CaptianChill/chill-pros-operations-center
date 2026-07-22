# Chill Pros Operations Center V1.0 Activation

The application uses one shared URL with role-based sign-in for owner, office and technician users.

## 1. Enable Firebase Authentication

In Firebase Console for `chill-pros-ice-stream`:

1. Open **Authentication**.
2. Select **Get started**.
3. Open **Sign-in method**.
4. Enable **Email/Password**.

## 2. Create users

Create each employee under **Authentication > Users**.

The owner account email is recognized as:

- `chillprostx@gmail.com`

For office and technician accounts, copy each user's Firebase Authentication UID.

## 3. Create role profiles

In Firestore, create a `Users` collection. The document ID must be the employee's Authentication UID.

Owner example:

```json
{
  "displayName": "Owner Console",
  "email": "chillprostx@gmail.com",
  "role": "owner"
}
```

Office example:

```json
{
  "displayName": "Chill Pros Office",
  "email": "office@example.com",
  "role": "office"
}
```

Technician example:

```json
{
  "displayName": "Brae Morrison",
  "email": "technician@example.com",
  "role": "technician",
  "technicianName": "Brae Morrison"
}
```

The `technicianName` value must exactly match the name used when assigning jobs.

## 4. Deploy Firestore rules

Deploy the repository's `firestore.rules` file through Firebase CLI or paste its contents into **Firestore Database > Rules** and publish.

## 5. Validate V1.0

Test the shared application URL with one account from each role:

- Owner sees the full Operations Center.
- Office sees intake, dispatch, scheduling and operational records.
- Technician sees assigned active jobs and technician tools.
- Changes appear across devices without manually refreshing.

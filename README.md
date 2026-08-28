# Chill Pros Operations Center — Clean V1

Single-shell production rebuild. No layered patches, no competing UI versions.

## What this is

- **One frontend shell** — black / ice-blue Chill Pros branding
- Firebase Auth + Firestore (`chill-pros-ice-stream`)
- Role-aware session (owner / office / technician via `Users` collection)
- **Service Intake → Office Queue → Dispatch / Jobs**
- Technicians, Reports, Settings
- **BoodaFlow** — priority execution engine (complete current → next safe task; blocked work does not stop the queue)
- **Chill Bro** — optional side plug-in only (floating ❄). Not part of the core shell; ready for later AI wiring

## Branch

`production/clean-v1`

## Local / Vercel

Static site. Point Vercel production at this branch (or deploy the folder).

Assets used from repo root:
- `chill-pros-official-logo-transparent.png`
- `cp-app-icon.png`

## Firebase setup

See `V1_SETUP.md` (roles in `Users`, rules in `firestore.rules`).

Owner email recognized: `chillprostx@gmail.com`

## Files that matter

| File | Role |
|------|------|
| `index.html` | Shell |
| `styles.css` | Theme + layout |
| `app.js` | Auth, data, views, BoodaFlow, Chill Bro plug-in |
| `firebase-config.js` | Project config |
| `firestore.rules` | Access rules |
| `manifest.webmanifest` | PWA |

Everything else in the repo is legacy from earlier experiments and can be ignored on this branch for day-to-day work.

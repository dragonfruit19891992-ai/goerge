# George Studio — Live Firebase Preview

This repository is a static Firebase-hosted frontend for George Studio with:

- Firebase Authentication (Google, email/password, anonymous fallback)
- Firebase Realtime Database live chat sync
- Local folder access panels using the browser File System Access API
- SPA rewrite support via `firebase.json`

## What works now

- `index.html` is the single-page app UI.
- The app uses the Firebase project configured in `firebaseConfig`.
- Live chat messages are saved under `sessions/session_<uid>/messages`.
- `database.rules.json` restricts reads/writes to the approved email or anonymous auth.
- Local preview on `localhost` works with email/password fallback if Google OAuth is blocked.

## Setup

1. Install the Firebase CLI:

   ```powershell
   npm install -g firebase-tools
   firebase login
   ```

2. From the repo root:

   ```powershell
   cd "c:\AuraOS\Brain\connection ui"
   firebase use default
   firebase deploy --only hosting
   ```

3. Add `http://localhost:8099` and your real hosting domain to Firebase Auth authorized domains in the Firebase Console.
4. Enable Email/Password sign-in in Firebase Authentication.
5. If you want live deploys from GitHub, connect this repo to Firebase Hosting or add GitHub Actions.

## Local preview

Run any static server from the repo root, for example:

```powershell
python -m http.server 8099
```

Then open `http://localhost:8099/`.

If Google OAuth is blocked, log in with:

- Email: `bouchard.joseph92@gmail.com`
- Password: `Paislee011!`

## Deploy to GitHub + Firebase

1. Create a GitHub repository and push this folder.
2. In Firebase Console, link the repository under Hosting > Connect repository.
3. Add a GitHub Actions workflow to deploy on push to `main`.
4. Use `firebase deploy` for manual deploys.

## Notes

- This repo already contains `firebase.json` and `.firebaserc`.
- `index.html` includes the chat overlay and database wiring.
- The app now has an explicit `Open Live Chat` button on the main dashboard.

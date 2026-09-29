# New Vision Farms deployment

## Existing Google AI Studio project

Use the owner's existing Build project at `https://aistudio.google.com/apps/c68ed0f3-a146-4e81-83fc-2c589c19c363`. Import or sync the reviewed GitHub revision in that project, then deploy its full stack app. Importing code into a new AI Studio project may attach a different Firebase database and make the existing farm records appear missing. Check that `firebase-applet-config.json` names the existing project and database before deployment. Keep a separate read-only export of `app_data/main` before changing rules or deploying.

The code now uses Firebase Admin SDK with Google Application Default Credentials on its server. The Cloud Run runtime service account must have Firestore access to the configured project and named database. No service account key belongs in GitHub or the browser bundle. After verifying the new server can read the existing records and make a test edit that survives a restart, publish the included `firestore.rules` to that same Firebase database. The rule denies browser SDK access; the Admin SDK uses IAM. Check the live rules and retry an unauthenticated client read to verify it is denied. Publishing rules while the old web SDK server is still serving traffic will break that server.

Production refuses to start if the Firebase config or cloud document is unavailable. It never treats a bundled `data/db.json` as cloud truth and never uploads a stale local file at startup. A mutation returns success only after a Firestore transaction commits. The current whole-document format remains limited by Firestore's 1 MiB document limit; the server stops adding records at a conservative 900 KB serialized size. A per-record data migration is still needed before that limit is reached.

## Android wrapper

Simplest setup: wrap the deployed HTTPS web app URL. It then uses its own `/api` on the same origin, and every family phone sees the same server. If bundling the web assets inside the APK instead, set `VITE_API_BASE_URL` to the deployed HTTPS origin at build time (for example, `https://your-host.example`). Set `NVF_ALLOWED_ORIGINS` on the Express server to the exact Android WebView origin used by the wrapper, such as `https://localhost` or `capacitor://localhost`; separate multiple origins with commas. Test registration, login, edits, offline replay, and downloads on two physical devices. Do not use `127.0.0.1` as the family server address.

`NVF_LOCAL_ONLY=1` is for isolated local testing without Firebase. Do not set it in AI Studio or production. `NVF_LOCAL_ACCOUNT_RECOVERY=1` is only for the one-time localhost preview account flow.

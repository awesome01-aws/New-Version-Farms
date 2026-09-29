# New Vision Farms project status

This is the running journal for the mobile-first farm webapp. Add a dated entry after each change, including what changed, what was tested, and what remains unresolved.

## 2026-09-28 — Family reliability and mobile usability

### Goal

Make daily poultry and incubator work understandable on a phone, protect family records, and make separate devices use one shared Express backend. Preserve the green and white identity. The app will later be wrapped as an Android APK.

### Issues, solutions, and work

1. **Account access bypass.** A username or user ID worked as an authorization token. Replaced it with random 30-day session tokens stored only as SHA-256 hashes on the server. New passwords use salted scrypt; legacy password hashes upgrade after a successful login. Sign-in attempts are limited per username. After initial setup, adding a family member requires an existing signed-in member. Log out revokes that session. Old user-ID tokens require a fresh sign-in.
2. **Offline changes could disappear.** A fake successful `/api/sync` response could empty the queue without contacting the server. Offline replay now uses the original network transport, sends actions in order, and removes each action only after a successful server response. Unsupported offline actions show an error. Phone storage write failures can no longer report success. Pending local changes remain visible while waiting.
3. **Server could report a save before disk finished.** Database writes now use a unique temporary file, synchronous rename, and propagate errors. Each request uses a copy of the current data so a failed save does not leave an unsaved mutation as the in-memory truth. The server waits for Firebase boot hydration before accepting requests and keeps a newer local revision if a cloud snapshot is stale. Firestore writes are serialized.
4. **Dashboard sale and birds-eaten buttons opened the wrong state.** Their action keys now match the actual form names. The farm page shows only the selected task's section, with a direct mobile section selector.
5. **Weekly incubator credit showed zero.** The summary now reads the computed `overdraft` field.
6. **Today could show yesterday around local midnight.** Current dates now use the farm's Africa/Douala calendar date rather than UTC string truncation. The date helper uses locale parts to produce a stable `YYYY-MM-DD` value.
7. **Offline shell cached development files.** The production build now injects all hashed JS/CSS assets into a revisioned service worker cache. API responses are never cached by the service worker.
8. **Phone UI was dense and hard to learn.** Replaced the home dashboard with a task-led screen, larger action cards, a clear next step, and three simple farm counts. Removed phone-wide text shrinking and forced tiny headings. The sign-in page now uses plain labels, larger controls, and simpler green and white styling. Farm opens to an overview; task buttons open and scroll to the corresponding form. The incubator starts with a simple empty state, and filters/reports are behind a further action. It now tells a first-time user to add a client before recording that client's eggs. The account menu groups secondary actions and adds a family-member form. The initial code is split into separate module chunks so phones do not download spreadsheet/report code before use.
9. **Windows scripts and TypeScript checks failed.** Replaced Unix-only package scripts. Fixed the reported TypeScript errors and added automated server and button audit scripts.
10. **Deleted flocks could return after restart.** An empty flock list was treated as corrupt and reseeded from a spreadsheet. Empty lists now remain valid. Existing unreadable database files stop startup rather than being silently replaced with seed data.
11. **Reports period controls and export guidance were misleading.** The report-range option values contained CSS text and could not match the selected state. Corrected the values and replaced developer-facing instructions with plain download guidance. CSV now uses a UTF-8 Blob download, including the byte-order mark for spreadsheet compatibility, and reports that a download started rather than claiming it was saved.

### Button audit

The static audit covers 237 `<button>` elements in 13 active TSX files. It found one cage option that used only `onMouseDown`, which was unreliable for touch. It now uses `onClick`. No button remains without an action or submit context. Farm form toggles now have visible action labels. The mobile browser checks cover home actions, the sale and egg forms, farm sections, incubator empty state, account menu, and bottom navigation. Static handler presence alone does not prove every data-dependent workflow; further phone testing with representative real farm records is still required.

### Verification

- `pnpm run lint`: passed.
- `pnpm run build`: passed; entry JS reduced from about 1.97 MB to about 293 KB before compression. Large report/import chunks remain on demand.
- `pnpm run test`: isolated server integration test passed for authentication, family account creation, two-session data sharing, persistence after restart, deletion surviving restart, logout revocation, rejection of an unsupported batch sync item, offline asset generation, and the Cameroon midnight date boundary.
- `node tests/button-audit.mjs`: 237 active buttons inspected; no actionless buttons found.
- Mobile browser viewport 390 × 844: home, sale entry, egg entry, incubator entry, account menu, and bottom navigation reviewed. A flock added through a second session appeared in the phone browser's home count. The final sign-in screen was also visually reviewed in the local preview.
- Reports screen reviewed after rebuild: period choices and plain-language export guidance are visible. The in-app browser did not surface a file-download event for CSV, so saving CSV/PDF files in the eventual Android wrapper remains a device verification item.

### Deployment and data limits

- Every family phone or APK must connect over HTTPS to the **same running Express server** and persistent data directory. `127.0.0.1` on a phone refers to that phone and cannot sync with the family's server.
- Firebase configuration was not present in the local source copy, so live Firebase writes and a multi-phone APK were not verified here. This server's Firebase integration still writes whole database snapshots and assumes one active server instance. Running multiple independent server instances can overwrite another instance's changes. Shared hosting should use one instance with persistent storage until the backend is redesigned for transactional multi-instance writes. Confirm Firestore security rules before any public deployment.
- The original repository contains a tracked database and backups. `.gitignore` protects future local files but does not erase data already in Git history. Removing or migrating that tracked data requires a reviewed deployment/data plan so existing farm records are not lost.
- Offline editing is still a bounded local queue. Concurrent edits to the same record from different phones have no conflict resolution, and device storage limits remain relevant. Do not describe the app as fully cloud synced while queue items remain.

## 2026-09-29 — Recovering the existing farm records

The first local preview had a new empty `data/db.json` because the source-only checkout did not include the app's tracked data or Firebase configuration. This was a preview setup error, not evidence that the original farm records were deleted. The empty preview database and its backup were preserved separately before recovery.

The GitHub `main` database snapshot contains 36 flocks, 66 clients, and 243 incubator records. A read-only fetch of the original app's Firestore `app_data/main` document found 36 flocks, 67 clients, and 249 incubator records. The Firestore document was saved locally as a recovery snapshot and used to restore the local preview; the original Firestore document was not changed. The preview still has no Firebase config in its app root, so it is a local snapshot and will not receive future cloud edits automatically.

Comparison by record ID found one incubator record in the older GitHub snapshot that is absent from Firestore, and seven in Firestore that are absent from GitHub. Both snapshots are retained locally; the older-only record was not automatically reintroduced because it may have been intentionally deleted. The family should confirm any disputed record before merging datasets. Neither snapshot contains a revision timestamp, so timestamp-based conflict resolution cannot establish which version of every record is newest.

Google AI Studio's documented GitHub integration can pull repository code back into an existing web app, but the deployed app URL is not the editor/project URL. The AI Studio editor could not be reached from this local browser session, so the updated PR has not yet been pulled into the original AI Studio project or deployed there. The original live app remains unchanged.

## 2026-09-29 — Local preview account recovery

The recovered snapshot has two existing family users, so first-time registration was correctly hidden, but the owner could not sign into the local preview. Added a one-time registration path controlled by `NVF_LOCAL_ACCOUNT_RECOVERY=1` and restricted to a loopback request. The preview is started on `127.0.0.1`. After one account is created, a marker in the local data directory closes the recovery path across restarts. Production and other devices cannot use this path unless explicitly configured on their own local server. The registration screen explains that the new account belongs only to this local preview; it does not modify or create an account in the original Google AI Studio/Firebase app. Existing farm records and users remain in the preview database.

Verification: `pnpm run lint` and `pnpm run build` passed. `pnpm run test` passed all three tests, including the one-time recovery and existing-data check; the static audit covered 238 buttons with no actionless button. The local browser showed the account form, and `/api/auth/status` reported recovery available while the preview database still contained 36 flocks, 67 clients and 249 incubator records. The account form was not submitted because the owner must choose their own credentials.

## 2026-09-29 — Current risk and deployment audit

This is a read-only audit. The local preview has three users after the owner created a preview account, and still has 36 flocks, 67 clients and 249 incubator records. The preview account is not in the original AI Studio app. GitHub `main` remains on the original revision and pull request #1 is open as a draft; no merge or AI Studio deployment was performed. The live site served a different JS asset from the updated local build, but the live API timed out, so an independent AI Studio update cannot be ruled out solely from the site probe.

1. **Critical: live Firestore read access.** A read-only Firebase client script fetched `app_data/main` without any Firebase sign-in. That document includes client contact fields and user password hashes. No write-permission probe was made. Move database access behind authenticated server credentials and lock Firestore rules in a coordinated migration; closing rules first would break the current client-SDK server integration.
2. **Critical: cloud persistence is not acknowledged.** `saveDb` commits to local disk, returns to the API caller, then schedules a whole-document Firestore write later. Failure is logged but not returned to the user. A Cloud Run instance's writable filesystem is disposable. Make the authoritative cloud write succeed before showing a saved state, with explicit retry and recovery for failures.
3. **High: whole-document concurrency and size.** All farm tables and user hashes share `app_data/main`; `setDoc` replaces it without a transaction or version precondition. Multiple server instances or delayed writes can overwrite newer work. The recovered JSON snapshot is about 203 KB, and Firestore documents have a 1 MiB maximum. Split records into collections with per-record versions/transactions and migrate with a verified backup.
4. **High: old live access path.** The updated security fixes are only in a draft PR. The original repository `main` still accepts a username or ID as an authorization token. Confirm the live deployment revision, then roll out the reviewed fix promptly after securing Firestore.
5. **High for APK rollout: server origin.** The web UI calls relative `/api/...` paths. An APK wrapping local files or a different origin would point at the wrong server. Configure a single HTTPS API origin, CORS and session handling, then test on two phones against the same hosted backend.
6. **Medium: offline/conflict behavior.** The phone keeps a localStorage queue and replays operations in order, but there is no per-record conflict resolution if two relatives edit the same record offline. Browser storage can also be cleared during an APK reinstall. Provide durable storage, conflict detection, and visible recovery before relying on offline editing for essential records.
7. **Medium: account and interface completion.** The one-time preview registration is local only. The production family app still needs a safe owner-managed account recovery/invite flow. The redesigned phone actions received focused browser checks and a static audit of 238 buttons, but all data-dependent form, export and Android download flows still need end-to-end device testing with representative records and the owner's usability review.

Deployment path: Google AI Studio documents two-way GitHub sync for an existing Build project. Review PR #1, pull its code into the original AI Studio project after the desired revision is approved, verify the Firebase project and data, then deploy/update the public app. The deployed app URL is not the Build editor URL; the editor was not accessible from this local session.

## 2026-09-29 — Cloud safety and Android connection work

The owner supplied the original Google AI Studio Build editor URL and signed in. The editor shows the old login screen and an existing preview with two family accounts. Its GitHub settings and deployment controls have not yet yielded an import action in this session. No live Firebase write, rules publication, GitHub merge, or AI Studio deployment has occurred.

Replaced the server's unauthenticated Firebase web SDK with the Admin SDK using Application Default Credentials. Cloud startup now requires a readable existing `app_data/main` document and takes its snapshot as authoritative; an old checked-in or local file cannot automatically overwrite it. API requests refresh from Firestore. Cloud mutations use revision-checked transactions, and the API waits for their commit before returning success. A failed write gives a retryable error. Production refuses to silently fall back to disposable local storage if Firebase is missing. A conservative size guard stops new whole-document snapshots before the 1 MiB Firestore limit. This is an interim safeguard; records still need a per-record schema migration for long-term growth.

Prepared deny-all browser Firestore rules and a deployment guide. The rule is **not live** until it is published to the existing Firebase database. The live database was previously readable without sign-in, so rules publication must be coordinated with starting and verifying the new Admin SDK server. Automatic approval review initially rejected removing tracked farm snapshots as possible data loss. The owner later explicitly said not to remove them. `data/db.json`, its two dated backups, and `POULTRY RECORDS.xlsx` remain in the branch and Git history. Local recovery copies and live Firebase data were not changed. Review their privacy exposure separately without deleting them.

Added optional `VITE_API_BASE_URL` for a bundled Android build and an exact server origin allowlist through `NVF_ALLOWED_ORIGINS`. A wrapper around the deployed HTTPS site can continue using the same-origin API without configuration. Android device behavior and two-phone sync remain unverified.

Verification: `pnpm run lint`, `pnpm run build`, and `pnpm run test` passed. Five automated tests cover local family sessions and persistence, local recovery, the production no-cloud startup guard, the Cameroon date boundary, and cloud acknowledgment/failure behavior using an isolated fake Firestore. The button audit covers 238 buttons. The cloud path has not been tested against a credentialed Firebase project; the existing local preview is deliberately isolated from live Firestore. Verify the reviewed GitHub revision and AI Studio project before deployment.

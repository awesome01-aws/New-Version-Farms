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

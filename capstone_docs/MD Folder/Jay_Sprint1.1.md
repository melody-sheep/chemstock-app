# ChemStock — Session Handoff Notes

Read this first in any new session on this repo. It condenses everything established in prior sessions so context doesn't have to be rebuilt from scratch. Claude does not retain memory across separate sessions — this file is the substitute.

Last updated: August 18, 2026 (end of Manager Stocks screen + Transaction Logs + shipment photo corruption fix session)

---

## 1. Who's on this project

**Alther Adrian Liga, Maria Angela U. Mantiza, Clint John Mila, Jay Fahad P. Sultan, Gio Niel P. Yecyec.** Only Jay was present for the Aug 13, Aug 14, Aug 16, and this Aug 18 session. Alther built the Manager Dashboard UI and the initial Receive Stock screen scaffolding independently — see his own notes in `alther_development.md` for that work in full detail; §6 below picks up exactly where his Aug 16 entry leaves off, and §9 covers Aug 18.

## 2. What this project is

**ChemStock** — a QR-enabled mobile inventory management system (capstone project) for **A and Aimee Laboratories / Cospachem Products**, a Philippine MSME distributing beauty/liniment products through a distributed sales force across the Cagayan de Oro and Butuan branches. Full requirements, literature review, and system design live in `capstone_docs/[PROPOSAL] ChemStock.pdf`. A plain-text extraction of it (`capstone_docs/proposal.txt`, via `pdftotext -layout`) now also sits in the repo, untracked — useful for fast full-text search of the ERD/DFD narrative in future sessions since the diagrams themselves are images `Read` can't parse directly; worth deciding whether to commit it or gitignore it.

Core idea: replace paper-based stock receiving/releasing/returns with QR scanning, mandatory photo handover proof, GPS geotagging, agent-level loss tracking, and automated weekly reconciliation.

**Stack:** React Native (Expo ~57.0.12, RN 0.86.2), Android-only, Supabase (Postgres + Auth + Bucket storage), local SQLite for offline sync (not yet implemented). A separate `admin-cli/` (Express + web UI) exists for Super Admin activation-key management. **Testing is via plain Expo Go, not a custom dev client** (confirmed: no `android/`/`ios/` folder, no `eas.json` in the repo) — this matters a lot, see §7.

**Roles:** Super Admin (governance only, generates manager activation keys via `admin-cli`) → Branch Manager (Supabase-Auth-backed, creates Sales Rep/Collector accounts, receives/releases stock) → Sales Rep / Collector (field roles, **not** Supabase-Auth-backed — plain `user_profiles` rows with `password_hash`, verified via RPC, no `auth.users` row at all). Role string values live in `src/constants/roles.js`: `manager`, `sales_rep`, `collector`.

## 3. Actual current implementation status

| Component | Status | Notes |
|---|---|---|
| Requirements, TAM study, proposal, Figma prototype | ✅ Done | |
| Expo/RN scaffold, navigation, base components | ✅ Done | |
| Login screen (all 3 roles, wired) | ✅ Done | `src/screens/auth/LoginScreen.js` |
| Manager Activation screen (both steps, wired) | ✅ Done | `src/screens/auth/ManagerActivationScreen.js` |
| Manager Dashboard | ✅ Done | Built by Alther |
| Sales Rep / Collector dashboards | 🟨 Placeholder only | Just "Welcome `<name>`" — unchanged since Aug 14 |
| Supabase: `activation_keys`, `activation_audit_log`, `branches`, `user_profiles` | ✅ Done | |
| Supabase: `activate_manager()`, `create_agent_account()`, `verify_agent_login()`, `get_email_by_username()`, `get_my_agent_accounts()` RPCs | ✅ Done, confirmed working | Agent login/creation confirmed working this session (was unconfirmed at end of Aug 14) |
| Manager → create Sales Rep/Collector account (form) | ✅ Done, confirmed working | `src/screens/manager/AgentAccountsScreen.js` |
| Manager → **list** Sales Rep/Collector accounts | ✅ Done, confirmed working (this session) | New `src/screens/manager/ManageAccountsScreen.js` — Dashboard's tile now opens this list first; "Add Account" from here opens the (unchanged) create form. Confirmed RLS-isolated per manager via two-manager test. |
| `admin-cli` populates `activation_keys.branch_ids` at key generation | ✅ Done (this session), **implementation not yet verified by an actual test key generation** | See §6 — resolves branch names against `branches` table, creates missing ones. Restart the admin-cli server to pick this up if it hasn't been yet. |
| Receiving stock: product catalog, camera proof, GPS/device metadata, preview, QR generation, Supabase persistence | ✅ Done | DB write + QR generation confirmed Aug 16. **Shipment photo upload was silently corrupting files until Aug 18 — see §9.** Save-to-Gallery still doesn't work in Expo Go (platform limitation, not a bug — see §7) and is deferred. |
| Manager Stocks screen (Healthy/Almost Out/Out of Stock, search, near-expiry filter) | ✅ Done, confirmed working (Aug 18) | `src/screens/manager/ManagerStockScreen.js` — see §9 |
| Transaction Logs screen (receiving history + detail sheet with photo/GPS/QR, date filter) | ✅ Done, confirmed working (Aug 18) | `src/screens/manager/StockLogsScreen.js` — see §9 |
| Dashboard: dynamic Total Items stat, dynamic Recent Logs, QR scanner FAB | ✅ Done (Aug 18) | QR scan only decodes and displays the raw value so far — **not yet validated against `receiving_batches.qr_code`**, deliberately deferred |
| Branch-wide (not just per-manager) stock/log visibility | ✅ Done (Aug 18), additive RLS | See §9 — a manager now sees a branch's full stock/history, not just what they personally received |
| Architecture: direct Supabase calls vs. Express API layer | 🟨 Recommended (direct Supabase + RLS), still not formally recorded in `AGENTS.md` | Unchanged — still a to-do |
| Everything else (transactions/release, geotagging beyond receiving, reconciliation, alerts, reports, offline sync, QR-scan-to-receive validation) | ⬜ Not started | Scoped for Sprints 3–5 |

**Known repo hygiene item — still unresolved across 5 sessions now:** stray 0-byte files `./,`, `admin-cli/console.log('❌`, `admin-cli/{` are still present. Trivial to delete, just keeps not happening.

**Known data hygiene item (Aug 18):** any shipment photo uploaded before the Aug 18 fix (see §9) is permanently corrupted in Supabase Storage — the upload bug produced unrecoverable bytes, not just a bad reference. Only affects early test data.

**Data hygiene note:** any Sales Rep/Collector account created *before* this session's admin-cli fix likely has an empty `branch_ids` array (inherited from a manager whose own `branch_ids` was empty at activation time, because `admin-cli` never populated it). A one-time backfill SQL was given to Jay this session (copies `branch_ids` from `created_by` → manager onto any agent row where it's still `{}`) — confirm whether it was actually run before assuming existing agent accounts have correct branch scoping.

---

## 4. What got built Aug 14 — Sales Rep / Collector account creation

### The ask
Jay wanted a simple way for a Branch Manager to create Sales Rep/Collector accounts — explicitly **not** using the same auth flow as manager registration (no email confirmation, no activation key, no Supabase Auth signup UX) — and to be able to log those accounts in from the main Login screen into placeholder role dashboards by end of session.

### Proposed ERD vs. live schema (flagged per Jay's request to be told about divergences)
Jay shared the proposal's ERD image. Compared to what's actually live:
- Proposed `user_profiles_table`: `user_id`, `username`, `role` (ENUM), singular `branch_id`, `password_hash`. Live `user_profiles`: `id`, `username`, `full_name`, `email`, `role` (text+check), **array** `branch_ids`, `created_by` — the array exists because one activation key already supports multiple branches per manager; `password_hash` didn't exist until today (managers use Supabase Auth instead); `full_name`/`email`/`created_by` aren't in the ERD but are needed for the Supabase-Auth-backed manager flow.
- Proposed `branches_table.manager_id` (FK): deliberately not implemented — `user_profiles.branch_ids` is the single source of truth for the manager↔branch relationship instead, to avoid two places that could disagree.
- Everything else in the ERD (`deliv_checkpoints`, `media`, `transaction`, `transaction_details`, `gps_coord`, `branch_inventory`, `alert_log`, `SR_inventory`) — not built yet at the time. **Update from this session (§6): `media`, `gps_coord` (as `gps_coordinates`), and `branch_inventory` now exist, adapted for the receiving flow specifically — see §6 for how they diverge from the proposal's literal per-row design.**

### The architecture decision made today
Sales Rep/Collector accounts live **only** in `user_profiles`, with a real `password_hash` — no `auth.users` row, no email, no Supabase Auth involved at all. This actually matches the ERD better than the manager flow does (the ERD never had a separate auth-provider concept). Managers are completely unaffected — still Supabase-Auth-backed exactly as before.

**Known trade-off, explicitly flagged to Jay, not yet a problem but will be:** because agent accounts never get a Supabase Auth session, they have no JWT, so `auth.uid()` is always null for them. Fine for login/placeholder dashboards, but means once Sales Reps/Collectors need to read/write RLS-protected tables (inventory, transactions) themselves, this approach won't support that as-is and will need revisiting — likely a custom session/token scheme, or reconsidering whether agents should get real Supabase Auth accounts after all.

### Database changes (all run in Supabase SQL editor)
- `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
- Dropped `user_profiles_id_fkey` (the FK from `user_profiles.id` → `auth.users.id`) — agent rows get a plain `gen_random_uuid()`, not a real auth user id. Managers are unaffected; they still populate `id` with their real auth.users id, just without DB-level enforcement now.
- Added `user_profiles.password_hash text` (nullable — stays null for managers)
- `create_agent_account(p_username, p_full_name, p_password, p_role, p_branch_ids)` — `SECURITY DEFINER` RPC, manager-only (checks caller's `user_profiles.role = 'manager'` via `auth.uid()`), hashes the password with `crypt(p_password, gen_salt('bf'))`, inserts the row. Synthesizes a placeholder `username || '@chemstock.local'` for the `email` column since it's `NOT NULL` but agents don't have real ones.
- `verify_agent_login(p_username, p_password)` — `SECURITY DEFINER` RPC, granted to `anon`, returns the matching profile row if `crypt(p_password, password_hash) = password_hash`, nothing otherwise.
- Re-created `get_email_by_username` defensively (`CREATE OR REPLACE`) in case it didn't survive being carried over from Aug 13.
- **Important gotcha hit twice:** `crypt()`/`gen_salt()` live in the `extensions` schema on Supabase, not `public`. Both new functions needed `SET search_path = public, extensions` — without it, `function crypt(text, text) does not exist`. Keep this in mind for any future function that needs pgcrypto.

### Code changes
- **New file** `src/services/agentService.js` — `createAgentAccount()`, calls the RPC.
- **Rewrote** `src/screens/manager/AgentAccountsScreen.js` — full form (full name, username, password, confirm, Sales Rep/Collector toggle), submits via `agentService`, shows a running list of accounts created this session. New agents inherit the manager's own `branch_ids` automatically — no branch picker built.
- **Rewrote `authService.js`'s `login()`** — now tries `verify_agent_login` first (no Supabase Auth), falls back to the existing manager/Supabase-Auth path (with username→email resolution via `get_email_by_username`) if no agent match. Both paths return the same shaped `user` object (`role`, `branchIds`, `full_name`, etc.) so the rest of the app doesn't need to know which kind of account it is.
- **New files** `src/screens/salesrep/SalesRepDashboardScreen.js`, `src/screens/collector/CollectorDashboardScreen.js` — placeholders, same shape as the original Manager Dashboard placeholder from Aug 13.
- `src/navigation/AppNavigator.js` — registered `AgentAccounts`, `SalesRepDashboard`, `CollectorDashboard`.
- `src/screens/auth/LoginScreen.js` — wired the `sales_rep`/`collector` post-login navigation branches (previously `Alert.alert` TODOs).

### Test account created this session
`seph@gmail.com` / `seph@2003`, role `sales_rep`, full name "Seph Plongplong" — created successfully via the new form. Login was still being debugged when the Aug 14 session ended. **Resolved this session (§6/§7 of that date): agent account creation and login are now confirmed working** — Jay tested creating a fresh account on a second manager/branch and confirmed the RLS scoping (a manager only ever sees agent accounts they personally created) holds correctly.

## 5. Debugging log — Aug 14 (a lot happened, worth reading before repeating any of it)

In rough chronological order:

1. **`pgcrypto` schema issue** (see §4) — fixed by adding `extensions` to both new functions' `search_path`.
2. **`agentService.js` had two real bugs** on first paste: a `throw new Error(error.message...)` sitting outside its `if (error)` guard (so it fired even on success, crashing on `null.message`), and a catch block calling `this.logError(...)` — a method that doesn't exist on `BaseService` (only `.log()` and `.handleError()` do). Both were masking the real error with a generic crash. Fixed.
3. **AgentAccountsScreen appeared blank** after being wired up — turned out to be a stale Expo Go bundle (the screen code itself was correct), not a real bug. Fixed by `npx expo start -c` + fully closing and rescanning in Expo Go, not just reloading.
4. **`node_modules/phosphor-react-native/lib/module/defs/Cheers.js` was binary garbage**, not valid JS — corrupted install, unrelated to any of our code, but broke the whole bundle because `Icon.js` imports from the package's barrel export, which touches every icon file including unused ones. A targeted `npm uninstall/install` of just that package didn't fix it (npm was reusing a corrupted local cache); a full `Remove-Item node_modules`, `npm cache clean --force`, `npm install` did.
5. **`authService.js login()` typo saga** — took several rounds: first `get_email_from_username` instead of `get_email_by_username`, then a destructured variable typo'd two different ways across two edits (`agentLogineError`, then `agentLogiError`) while the code that *used* the variable stayed correctly spelled — meaning the two never matched and it crashed with a `ReferenceError` every login attempt, silently skipping the agent-login check entirely and falling through to a doomed Supabase Auth attempt. **This is why "Invalid login credentials" kept showing even though the actual bug was a typo, not a real auth failure** — worth remembering if a similar-looking symptom shows up again. Finally fixed directly by Claude (Jay accepted this particular direct edit).
6. **`LoginScreen.js` had `user.full_Name` (stray capital N)** instead of `full_name` — silently fell back to showing the username instead of the real name on the dashboard. Fixed directly by Claude (accepted).
7. **`AppNavigator.js` never had `SalesRepDashboard`/`CollectorDashboard` registered** — caused a `The action 'REPLACE' ... was not handled by any navigator` error. Claude's first attempt to fix this directly via edit **was rejected by Jay** — redone as a manual paste instead. *(Worth noting: direct edits were accepted both before and after this rejection, so it doesn't seem to be a blanket preference — just wasn't wanted for this specific file at this moment. Ask rather than assume, going forward.)*
8. **File casing mismatch**: `CollectorDashboardScreen.js` was imported with a capital C but saved on disk as `collectorDashboardScreen.js` (lowercase). Windows itself doesn't care, but Metro's module resolution does, causing `Element type is invalid: ... got: object`. Jay renamed the file to match — but **case-only renames often don't trigger file-watcher updates at all**, especially on Windows, so Metro kept running against its old module map. Needed a full process stop/restart (not just a reload) to pick it up.
9. **Recurring theme all session, worth internalizing**: multiple times, a fix that was verifiably correct on disk still produced the *old* error message in the terminal. Every time, it was Metro/Expo Go serving a stale bundle, not a wrong fix. When this happens: fully stop the dev server (not just reload), run `npx expo start -c`, and fully close + rescan Expo Go rather than backgrounding/foregrounding it.

---

## 6. What got built this session (Aug 16, continued) — Manage Accounts split, Receive Stock backend, admin-cli branch fix

By the start of this session, Alther had already built the Receive Stock scaffolding described at the bottom of `alther_development.md` (UI-only `ReceiveStockScreen`/`AddNewBatchesScreen`, mock 3-product catalog, stubbed photo/QR). This session wired all of it to real data and closed out the remaining Sprint 1 gap in `admin-cli`.

### 6a. Manage Accounts screen split
Jay wanted the Dashboard's "Agent Accounts" tile to open a **list** of the manager's own Sales Rep/Collector accounts first, with an "Add Account" button from there opening the existing create form — rather than the tile jumping straight to the form.
- **New** `src/screens/manager/ManageAccountsScreen.js` — two sections (Sales Representatives / Collectors), refetches on screen focus (`useFocusEffect`) so a newly-created account shows up immediately on the way back from the create form.
- **New RPC** `get_my_agent_accounts()` — `SECURITY DEFINER`, scoped to `created_by = auth.uid()`, returns only non-sensitive columns (explicitly not `password_hash`).
- `agentService.js` gained `getMyAgentAccounts()`. Also fixed **the same two bugs from Aug 14 item 2 above, still present**: `this.logError(...)` (doesn't exist) → `this.log('error', ...)`, and a `{ error: ... }` vs `{ message: ... }` return-shape mismatch that meant the screen's failure `Alert` was always showing "undefined."
- `ManagerDashboardScreen.js`'s tile repointed from `AgentAccounts` → `ManageAccounts`; `AppNavigator.js` updated.
- **Confirmed working**: tested with two different manager accounts on two different branches — each only sees accounts they personally created, confirming the RLS scoping is real, not just client-side filtering.

### 6b. Receive Stock: full backend, camera, GPS, device metadata, QR
The actual feature: manager searches/selects from a real 24-product catalog, captures a mandatory camera-only shipment photo, previews with GPS/branch/device/timestamp metadata, and on confirm the whole batch is written to Supabase and a single QR code is generated for the shipment.

**Schema decision, flagged and confirmed with Jay before building:** the proposal's ERD ties a QR token to each individual `branch_inventory` row (one QR per product batch — matches later Sales Rep scan-to-receive figures). Jay explicitly chose **one shared QR per whole shipment** instead. To support that without duplicating GPS/photo/QR across every line item, added one wrapper table beyond the literal ERD:

- `gps_coordinates` — one row per shipment (lat/long/captured_by/captured_at)
- `media` — one row per shipment photo (storage_path/device_model/device_os/uploaded_by) — deliberately stores a bucket **path**, not a public URL (proposal requires signed URLs, manager-only access)
- `receiving_batches` (new, not in the literal ERD) — one row per "Add New Batches" submission; holds the single shared `qr_code`, FKs to `gps_coordinates`/`media`/`branches`, `received_by`
- `branch_inventory` — one row per selected product line, FK to `receiving_batches`, plus `product_code`/`product_name`/`batch_number`/`quantity`/`mfg_date`/`exp_date` (Mfg/Exp intentionally left blank/optional in the UI per Jay — fields exist and are wired, just no date-picker yet)
- `receive_stock_batch(...)` RPC — `SECURITY DEFINER`, atomic (one GPS row + one media row + one receiving_batches row + N branch_inventory rows in a single transaction), manager-only, returns the generated `qr_code`
- RLS on all four tables: `SELECT` scoped to `received_by`/`captured_by`/`uploaded_by = auth.uid()` — this is what actually enforces Jay's requirement that a manager's receiving transactions are only ever visible to that manager (relevant for the "Stocks" page he's planning next), not just app-side filtering
- Supabase Storage bucket `shipment-media` (private) with per-manager-folder upload/read policies

**Code:**
- `src/constants/productCatalog.js` — the 24 product codes (PWBS, FHVCO, WLG, GSSL, PGL, DS, AMB, AOL, 7HWO, TWNC, NC-s, 7HDT, VNCM, 3VNMG, AIR2, BSCS, RSCS, PCB, GSP, TBC, TBC-s, MBG, AMG, HPDL) as `{code, name, image}`. No `products` table exists in the ERD (branch_inventory stores nomenclature directly), so this is intentionally a static app-side list, not DB-backed. `name` defaults to `code` (no full names given yet); `image` is `null` everywhere pending real product photos.
- `src/components/common/CameraCaptureModal.js` (new, reusable) — full-screen `expo-camera` `CameraView` capture, no gallery entry point anywhere in the UI (matches the proposal's explicit anti-fraud requirement). Built reusable since release/delivery-confirmation photo proof will need the same thing later.
- `src/services/inventoryService.js` (new) — `uploadShipmentPhoto()`, `receiveStockBatch()`.
- `src/screens/manager/AddNewBatchesScreen.js` — rewritten to use the real catalog, real photo thumbnails, blank Mfg/Exp `Input` fields, and the real camera modal instead of an `Alert` stub.
- `src/screens/manager/ReceiveStockPreviewScreen.js` (new) — recap + GPS (`expo-location`)/device (`expo-device`)/branch/timestamp metadata block, "Receive and Generate QR" → renders the QR via `react-native-qrcode-svg`.
- New dependencies: `expo-camera`, `expo-location`, `expo-device`, `react-native-qrcode-svg`, `expo-media-library`, `expo-file-system` (all via `npx expo install`). **`expo-blob` was installed then deliberately uninstalled again** — see §7.
- `app.json` — added `expo-camera`/`expo-location`/`expo-media-library` plugin blocks with permission strings (none existed before this session).

**Confirmed working end-to-end**: Jay tested the full flow — product selection, camera capture, GPS/device/branch metadata populating, DB write succeeding, QR rendering. Save-to-Gallery specifically does not work under Expo Go — see §7, this is expected and deferred, not a bug to chase further right now.

### 6c. `admin-cli` branch_ids fix
Root cause finally fixed: `admin-cli/server.js`'s `/api/keys/generate` never touched the `branches` table, only wrote free-text `branch_names`/`branch_locations`. Every manager activated through a CLI-generated key therefore got an empty `user_profiles.branch_ids` — which then propagated to every agent account that manager went on to create (confirmed: Jay found exactly this on a test Sales Rep account).

- New `resolveBranchIds()` helper in `server.js`: for each typed branch name, looks up a matching `branches` row (case-insensitive) or creates one, returns the ids.
- `/api/keys/generate` now writes `branch_ids` on the `activation_keys` insert. **The web-ui form itself was not changed** — same free-text name/location fields as before; resolution happens server-side. Trade-off: a typo'd branch name creates a duplicate `branches` row rather than reusing the existing one — acceptable for now given there are only 2 real branches, flagged to Jay as something a proper branch-picker dropdown would fix later if it becomes a real problem.
- Syntax-checked (`node -c server.js`), **not yet functionally verified** — needs an actual server restart + test key generation to confirm `branch_ids` populates correctly.
- Backfill SQL given to Jay for the already-broken data (copies `branch_ids` from `created_by` → manager onto any agent account where it's still `{}`) — not yet confirmed run.

---

## 7. Debugging log — this session (Aug 16, continued)

1. **`SafeAreaView` deprecation warning** on `AddNewBatchesScreen` — traced to `CameraCaptureModal.js` importing the deprecated `SafeAreaView` from `react-native` instead of `react-native-safe-area-context` (used correctly everywhere else in the app). One-line import fix.
2. **"Branch keeps loading" forever on the Receive Stock preview screen** — two layered causes: (a) a real UI bug, `manager?.branchName || 'Loading branch…'` conflated "still fetching" with "fetched but empty" — fixed with an explicit `isLoadingManager` state; (b) the actual root cause underneath, `branches` table was empty / this manager's `branch_ids` was empty — which is the exact same root cause §6c's admin-cli fix addresses systemically. Manually backfilled one branch + one manager's `branch_ids` to unblock testing in the moment.
3. **`Response.blob()` performance warning** on photo upload (RN's Blob polyfill does a base64 roundtrip) — initially "fixed" by switching to the `expo-blob` package. **This was reverted** once the media-library saga (below) revealed the real pattern: brand-new packages risk not being in Expo Go's bundled native modules at all. Since the original `response.blob()` approach already worked correctly (just with a cosmetic warning), swapping in an unverified new native dependency wasn't worth the risk of turning a working upload into a crash. `expo-blob` was uninstalled again.
4. **Save-to-Gallery, multi-round saga — ended in a genuine platform limitation, not a code bug:**
   - First attempt (`expo-media-library`'s new `Asset.create()` API) → `Cannot find native module 'ExpoMediaLibraryNext'`. Root cause: plain Expo Go (confirmed via no `android/`/`ios/`/`eas.json`) only ships native modules Expo pre-baked into it; brand-new "next-gen" rewritten modules aren't in there yet.
   - Switched to `expo-media-library/legacy` + `expo-file-system/legacy` (older function-based APIs, backed by the modules Expo Go has bundled for years) → got past the missing-module error, but then: `You have requested the AUDIO permission, but it is not declared in AndroidManifest.` The unscoped `requestPermissionsAsync()` call defaults to requesting photo+video+audio; narrowed to `requestPermissionsAsync(true, ['photo'])` (write-only, photos only, matching our actual use case).
   - Still failed with Expo's own explicit message: *"Due to changes in Android's permission requirements, Expo Go can no longer provide full access to the media library. To test the full functionality of this module, you can create a development build."* This is a hard Expo Go platform restriction, not fixable in app code at all.
   - **Decision (Jay's call, presented as an explicit choice):** defer testing Save-to-Gallery rather than set up a dev client right now. The code is left in place and is believed correct for whenever a real dev build exists — **confirmed conceptually** (a custom/production build compiles the project's own `AndroidManifest.xml` from `app.json`'s plugin config, which already has the right permission strings), but genuinely untested since Expo Go can't run it.
5. **General lesson reinforced by items 3–4**: on this project (Expo Go, no dev client), any newly-added native package is a real risk until proven otherwise — check for a `/legacy` import path first if something isn't found, and don't reach for the newest-looking API by default.

---

## 8. Git / commit status

Branch: **`main`**, up to date with `origin/main`.

**Nothing from this session is committed.** As of session end:
- Modified: `admin-cli/server.js`, `app.json`, `package.json`, `src/navigation/AppNavigator.js`, `src/screens/manager/AddNewBatchesScreen.js`, `src/screens/manager/ManagerDashboardScreen.js`, `src/services/agentService.js`
- Untracked: `capstone_docs/proposal.txt` (see §2 — decide keep/gitignore), `src/components/common/CameraCaptureModal.js`, `src/constants/productCatalog.js`, `src/screens/manager/ManageAccountsScreen.js`, `src/screens/manager/ReceiveStockPreviewScreen.js`, `src/services/inventoryService.js`

Recommend reviewing and committing once the admin-cli branch fix and the backfill SQL are actually verified (§6c/§9).

Also still true from Aug 14: `src/hooks/useActivation.js` has a harmless-but-untidy leftover — a second, unreachable `return {...}` statement after the real one. Never got cleaned up.

**Full SQL for everything built this session** (the four new tables, RLS policies, storage bucket + policies, and the `receive_stock_batch` RPC) was given to Jay directly in chat and is not yet saved anywhere durable in the repo itself — only in a local Claude Code plan file on one specific device (`~/.claude/plans/sunny-swimming-treehouse.md`), which won't be available from a different device. **Worth doing soon:** save the actual DDL into the repo (e.g. a `supabase/migrations/` folder or a plain `capstone_docs/schema.sql`) so it survives across devices/sessions the way this handoff doc does.

## 9. What got built this session (Aug 18) — Manager Stocks screen, Transaction Logs, filters, shipment photo corruption fix

Session opened with a full repo re-study (confirming everything in §1–§8 was still accurate, plus reading the live `CREATE TABLE` SQL Jay pasted for `branches`/`user_profiles`/`gps_coordinates`/`media`/`receiving_batches`/`branch_inventory`, which matched §6b exactly). Then built the "Stocks" page mentioned at the end of §6b/old §9.

### The ask
A Manager Stocks screen matching a provided mockup — Healthy (≥50 units) / Almost Out (<50) / Out of Stock buckets, reachable from the dashboard's "Total Items" stat or the bottom nav's Stock tab. Plus: make the dashboard's Total Items stat and Recent Logs dynamic (real data, not the Aug 13 placeholders), make the FAB open a real QR scanner, and add a Transaction Logs screen (document icon) showing receiving history with a detail view.

### Architecture decision: branch-wide vs. per-manager visibility
Asked Jay directly since it needed an RLS change only he could run. Chose **branch-wide** (matches the "Branch Inventory" label in the mockup) over the existing per-manager scoping from §6b. Implemented as **additive** policies — a new branch-scoped SELECT policy alongside each existing owner-scoped one on `branch_inventory`, `receiving_batches`, `gps_coordinates`, `media`, plus one on `storage.objects` for shared photo access. Nothing that worked before broke (Postgres ORs permissive policies of the same command together). **SQL saved to the repo this time**, unlike Aug 16's (see §8's note about that) — `capstone_docs/sql/2026-08-18_branch_wide_stock_visibility.sql`. Confirmed applied and working.

### What got built
- **`src/screens/manager/ManagerStockScreen.js`** (new) — buckets `branch_inventory` rows by quantity, sorted soonest-expiring-first; Out of Stock is `PRODUCT_CATALOG` minus any product code with an existing batch (no `products` table exists to track that directly — same reasoning as §6b's catalog decision). Search filters all three buckets by name/code.
- **`src/screens/manager/StockLogsScreen.js`** (new) — lists `receiving_batches` (branch-scoped) via one Supabase query with embedded FK relations (`gps_coordinates`, `media`, `branch_inventory` all embedded in a single `.select()` — no manual joins/grouping). Tapping a row opens a detail bottom sheet: items, GPS, device info, QR code, shipment photo (signed URL, fetched on demand per-row rather than eagerly for the whole list).
- **`StockBatchCard.js`, `QRScannerModal.js`, `FilterSheet.js`** (new, reusable components) — batch card for the Stocks screen; full-screen QR scanner using `expo-camera`'s built-in `barcodeScannerSettings`/`onBarcodeScanned` (no new dependency, confirmed present in the installed version before using it); a generic bottom-sheet radio-list, now used by both screens' filters.
- **Dashboard**: Total Items now sums real stock; Recent Logs shows real receiving activity and is tappable — jumps straight into that transaction's detail sheet on the Logs screen by passing the already-fetched log object as a nav param, so it opens instantly instead of waiting on a refetch; FAB opens the QR scanner (decodes and displays the raw value only — **matching against `receiving_batches.qr_code` is deliberately not built yet**, Jay's explicit call, "we'll work on this more soon").
- **Filters** (added on request after a suggestion pass): Stocks screen — "All Batches" / "Near Expiry Only" (within `NEAR_EXPIRY_DAYS` = 30, `src/constants/inventory.js`), red dot on the icon + dismissible chip when active. Logs screen — "All Time" / "Today" / "This Week" (rolling 7 days) / "This Month" (rolling 30 days) — rolling windows chosen over calendar boundaries to sidestep a week-start-day debate.
- `inventoryService.js` gained `getBranchStock()`, `getReceivingLogs()`, `getShipmentPhotoUrl()`. `LogListItem.js` gained an optional `onPress` (existing read-only usages elsewhere unaffected).

### Real bug found and fixed: shipment photos uploading corrupted
`uploadShipmentPhoto()` used `fetch(uri).blob()` to read the camera photo before uploading. Confirmed today: React Native's Blob polyfill silently corrupts binary data from local `file://` URIs on this setup. The upload call never errored (Supabase Storage doesn't validate that stored bytes are a real image), so it looked fine until actually viewing a photo, which failed with `unknown image format`. **This is the same `response.blob()` code Aug 16 §7.3 flagged as just a cosmetic "perf warning" and deliberately left alone** — the warning was hiding a real correctness bug, not only a performance one. Worth remembering: a "just a warning, still works" call is only as trustworthy as whatever actually exercised the code path — nothing had actually round-tripped a photo back through view until this session.

**Fix**: read the file as base64 via `expo-file-system/legacy` (same `/legacy` pattern as the rest of the app, see §7.4) and decode it to raw bytes with a small hand-rolled decoder (`src/utils/base64.js` — deliberately no new dependency; verified against known test vectors, including a real JPEG magic-byte header, before shipping). This is Supabase's own documented recommendation for React Native uploads specifically because of this Blob issue.

**Known casualty**: any shipment photo uploaded before this fix is permanently corrupted in storage — the bytes themselves are gone, not just a bad reference. Only affects early test data; don't be surprised if an old transaction's photo still won't load.

## 10. Debugging log — Aug 18

1. Diagnosed the missing-photo report in three ruled-out steps rather than guessing: (a) confirmed it wasn't an Expo Go/dev-client limitation like Aug 16's Save-to-Gallery issue — signed URL fetching is plain HTTPS, no native module involved; (b) added debug logging (the `media` embed's contents, the resolved signed URL) plus an `Image onError` handler, since React Native's `Image` silently swallows load failures with zero console output otherwise; (c) confirmed the RLS policies were actually present via `pg_policies` before looking elsewhere — only once that was ruled out did the `onError` output ("unknown image format") point at corrupted bytes.
2. A `LogListItem.js` edit mid-session (adding `onPress`/`TouchableOpacity`) accidentally dropped the pre-existing `View` import. Caught immediately via a babel-parser syntax check on every touched file before calling anything done — worth keeping up as a habit, catches this class of mistake for free.

## 11. Git / commit status (Aug 18)

Branch: **`jay`**, up to date with `origin/jay`. (Aug 16's commit `c8b1033` did land since that session — the "recommend committing" note in §8 is resolved.)

**Nothing from this session is committed yet.**
- Modified: `src/components/common/Icon.js`, `src/components/common/LogListItem.js`, `src/navigation/AppNavigator.js`, `src/screens/manager/ManagerDashboardScreen.js`, `src/services/inventoryService.js`
- New/untracked: `src/components/common/FilterSheet.js`, `src/components/common/QRScannerModal.js`, `src/components/common/StockBatchCard.js`, `src/constants/inventory.js`, `src/screens/manager/ManagerStockScreen.js`, `src/screens/manager/StockLogsScreen.js`, `src/utils/base64.js`, `src/utils/formatters.js`, `capstone_docs/sql/2026-08-18_branch_wide_stock_visibility.sql`

The three stray 0-byte files from §3 are still there, untouched, now on their 5th session.

## 12. Suggested first steps in a new session

1. Do one fresh Receive Stock run and confirm the shipment photo actually displays in the Logs detail sheet — that's the real end-to-end verification of §9's base64 fix (don't reuse old test data; it's permanently corrupted).
2. `git status` / `git diff` — review and commit this session's work.
3. Delete the three stray 0-byte files (still hasn't happened across 5 sessions).
4. Decide whether to invest in a real development build now (unblocks Save-to-Gallery, and will be needed regardless for QR-scan-to-receive and offline SQLite sync coming up) — still an open decision, deferred again this session.
5. Write the direct-Supabase-vs-Express-API architecture decision into `AGENTS.md` (carried over since Aug 14, still not done).
6. Decide the fate of `capstone_docs/proposal.txt` (commit as a reference copy, or gitignore it) — carried over since Aug 16.
7. Clean up the dead code in `useActivation.js` (a harmless-but-untidy duplicate `return` — see Aug 16 §8).
8. Sprint-2-proper work once the above is settled: wire the QR scanner's decoded value to actually look up and validate against `receiving_batches.qr_code` (currently just displays the raw scanned text), and start on Release Stock now that Receiving is solid end-to-end.

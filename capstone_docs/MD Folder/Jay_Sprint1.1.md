# ChemStock — Session Handoff Notes

Read this first in any new session on this repo. It condenses everything established in prior sessions so context doesn't have to be rebuilt from scratch. Claude does not retain memory across separate sessions — this file is the substitute.

Last updated: August 24, 2026 (end of Request Stock + Sales Rep Track Deliveries session — see §23-§25)

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
| Manage Accounts screen (role-filtered list, avatar cards, Remove Account w/ confirmation) | ✅ Done, confirmed working (Aug 19) | `src/screens/manager/ManageAccountsScreen.js` — see §13 |
| Manager Release Stock (recipient picker → scan QR or Quick Register → confirm w/ photo/GPS → new QR) | ✅ Done, confirmed working (Aug 21, after bugfix) | 5 new screens under `src/screens/manager/` — see §14-§16 |
| Release Stock via Collector (dual recipient: Collector + target Sales Rep, destination map pin, dual-GPS confirm) | ✅ Done, confirmed working (Aug 23) | See §18 — new `ReleaseStockDeliveryScreen.js` + `MapLocationPickerModal.js` (Leaflet/OSM via WebView, no Google Maps API) |
| Track Deliveries — Manager side (Collector-mediated delivery status + route map) | ✅ Done, confirmed working (Aug 23), view-only | See §19 — `delivery_status`/`delivery_checkpoints` schema groundwork only; nothing sets `delivered` or logs a checkpoint yet, that's Collector-side work not built |
| Sales Rep Receive Stock (scan release QR → confirm w/ photo/GPS → credits personal stock ledger) | ✅ Done, confirmed working (Aug 23) | See §20 — **first feature to solve the Aug 14 `auth.uid()` gap** for agents (§4) |
| Sales Rep dashboard (dynamic stock/logs), Sales Rep Logs screen, Sales Rep Stocks screen | ✅ Done, confirmed working (Aug 23) | See §20 |
| Request Stock — Sales Rep side (browse own stock → cart → review w/ metadata → send to branch manager) | ✅ Done, confirmed working (Aug 24) | See §23 — `RequestStockSR.js` rewritten, new `RequestListSR.js` |
| Request Stock — Manager side (live queue, Decline/Prepare, Prepare hands off into pre-filled/auto-allocated Release Stock) | ✅ Done, confirmed working (Aug 24) | See §23 — new `AgentStockRequestScreen.js` + `ReleaseStockRequestReviewScreen.js`; Dashboard's "Request" stat tile is real now, was hardcoded `'3'` since it was first scaffolded |
| Track Deliveries — Sales Rep side (own incoming Collector deliveries only, same map view) | ✅ Done, confirmed working (Aug 24) | See §24 — new `SalesRepTrackDeliveriesScreen.js`, mirrors the Manager screen via a new agent-facing RPC |
| Everything else (Collector-side "mark delivered"/location-checkpoint button, live delivery tracking map, geotagging beyond receiving/release, reconciliation, alerts, reports, offline sync, QR-scan-to-receive validation, dedicated Release Logs) | ⬜ Not started | Scoped for later sprints |

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

**Resolved Aug 23 (§20)**: not a session/token redesign after all — extended the existing `verify_agent_login`/`create_agent_account` pattern (`SECURITY DEFINER` RPCs, `GRANT EXECUTE TO anon`, explicit id param instead of `auth.uid()`) to agent-facing reads/writes generally, first used for Sales Rep Receive Stock.

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

---

## 13. What got built Aug 19 — QR-in-Logs, Manage Accounts redesign

### Logs screen: per-transaction QR code + Save to Gallery
Each entry in the Transaction Logs detail sheet now renders its `qr_code` (already stored on `receiving_batches` since §6b, just never displayed before) with a "Save to Gallery" affordance. Extracted into a new reusable component, **`src/components/common/SaveableQRCode.js`**, pulled out of `ReceiveStockPreviewScreen.js` (which used the exact same QR-render-plus-save pattern) rather than duplicating it — same "extract once needed twice" rule as `FilterSheet`. `ReceiveStockPreviewScreen.js` itself now just renders `<SaveableQRCode>`; no behavior change there. Save-to-Gallery still doesn't work under plain Expo Go (§7.4's platform limitation), documented as a known limitation on the component itself this time so it doesn't need rediscovering.

### Manage Accounts screen redesign
Per a mockup Jay shared, `ManageAccountsScreen.js` was rewritten:
- Filtering switched from **branch** to **role** (Sales Rep / Collector), via the existing `FilterSheet` component.
- Avatar-initials cards replacing the old plain list rows, with a colored role dot + label.
- **Remove Account**: a "⋮" menu on each card opens `ConfirmationDialog` (icon `trash`) with an explicit warning before the delete actually fires — Jay's hard requirement, since this is a real destructive action (deletes the `user_profiles` row entirely). `ConfirmationDialog.js` gained an optional `height` prop (default 300, backward-compatible) to fit the longer warning copy. Guarded against double-tap via an `isRemoving` state check.
- **New RPC** `delete_agent_account(p_agent_id)` — manager-only, scoped to `created_by = auth.uid()` (a manager can only delete agents they personally created), restricted to `sales_rep`/`collector` roles only (can't be pointed at a manager row). `get_my_agent_accounts()` was also changed to return `branch_ids` (needed by the later Release Stock recipient picker, see §14) — required dropping and recreating the function since `CREATE OR REPLACE` can't add output columns.
- `agentService.js` gained `deleteAgentAccount(agentId)`; `getMyAgentAccounts()` now also resolves and returns `branchName` per agent (batched branches query).
- SQL: `capstone_docs/sql/2026-08-19_agent_account_removal_and_branch_ids.sql`.

**Bug hit + fixed**: `ERROR: 42723: function 'get_my_agent_accounts' already exists with same argument types` — `CREATE OR REPLACE` refuses to change a function's return columns. Jay's `DROP FUNCTION IF EXISTS` was in the same paste as the `CREATE`, and appears not to have actually executed first (likely a partial-statement-selection quirk in the Supabase SQL editor). Fixed by having Jay run the `DROP FUNCTION IF EXISTS public.get_my_agent_accounts();` line **by itself**, confirm it succeeded, then run the `CREATE FUNCTION` block as a separate step. **General lesson**: when a migration changes a function's signature/return shape (not just its body), always tell Jay to run the DROP as its own standalone execution before the CREATE — don't assume a single paste with both statements will apply in order.

## 14. What got built Aug 20-21 — Manager Release Stock (the biggest feature yet)

### The ask
Per a 4-screenshot mockup: a Manager picks a recipient (Sales Rep or Collector, scoped to their own branches), then either scans an existing Receive-Stock QR code or uses "Quick Register (Urgent)" for stock that was never formally logged in, reviews/adjusts quantities, and confirms with a mandatory photo + GPS/device metadata — producing a **new** QR code representing the release, to be scanned later by the recipient (that receiving-side flow is explicitly out of scope for now). Hard requirements: real deduction from `branch_inventory`, the release must be logged, and the schema should follow the capstone proposal's `transaction`/`transaction_details` concept (adapted to this app's existing "no `_table` suffix" naming) without a major overhaul. Collector-as-courier/multi-hop delivery logic explicitly deferred — a Collector can still be picked as a *direct* recipient, same as a Sales Rep.

Built via the full Plan Mode workflow (Explore agent to verify current-state assumptions, Plan agent for a critical design review) given the size and schema impact — the approved plan is saved locally at `~/.claude/plans/cosmic-honking-corbato.md` on this device only (same "not portable across devices" caveat as §8's note about the Aug 16 plan file — worth eventually folding the final schema into a repo-committed doc, see §16's hygiene note).

### Database (`capstone_docs/sql/2026-08-20_release_stock.sql`)
Two new tables, following the app's existing naming convention rather than the proposal's literal `_table` suffix:
- **`transactions`** — one row per completed release: `branch_id`, `released_by`, `received_by`, `movement_type` (`'direct'` only for now), `qr_code` (unique, the *new* release QR), `gps_id`/`media_id` FKs, `sync_status`, `created_at`.
- **`transaction_details`** — one row per line item released: `transaction_id`, `branch_inventory_id`, plus **denormalized** `product_code`/`product_name`/`batch_number`/`mfg_date`/`exp_date`/`quantity`. Denormalized deliberately (not just read live off `branch_inventory`) so a log line stays fully self-describing no matter what later happens to the source batch — same lesson the Aug 21 bugfix (§15) ended up reinforcing the hard way.
- RLS: same dual-policy pattern (owner-scoped + additive branch-scoped) already established for every other inventory table, extended to `transactions`/`transaction_details`, plus matching additive policies on `gps_coordinates`/`media`/`storage.objects` joining through `transactions` instead of `receiving_batches`.
- `release_stock_batch(...)` RPC — `SECURITY DEFINER`, manager-only, atomic: validates + row-locks every line item, generates the release `qr_code`, inserts `gps_coordinates`/`media`/`transactions`/`transaction_details`, then mutates `branch_inventory` last. (Original version deleted a `branch_inventory` row on full depletion — **this behavior was wrong and was replaced the next day, see §15.**)

### Quick Register (Urgent) — chained, not a combined RPC
Chosen over a single mega-RPC because the existing `receive_stock_batch` RPC's internals weren't something to safely duplicate/extend. `ReleaseStockConfirmScreen.js` chains, in order: (1) upload waybill photo + call the existing `receiveStockBatch()` RPC — literally the normal Receive Stock flow, reusing the GPS/device reading already captured on this screen; (2) `getReceivingBatchByQrCode()` (new) to hydrate the just-created `branch_inventory_id`s, so both the scan-path and Quick-Register-path converge onto the same `items` shape; (3) upload a *second*, distinct release-proof photo, then call `releaseStockBatch()`. If step 3 fails after step 1 succeeded, that's a recoverable state (stock legitimately received, just not yet released) — the screen surfaces an explicit "stock was registered — retry release" affordance rather than a generic error, since everything needed to retry is already in hand (`hasRegistered`/`pendingReleaseItems`/`receivingQrCode` state).

### New/changed files
- **`inventoryService.js`**: added `getReceivingBatchByQrCode(qrCode, branchIds)` (shared by the scan-review screen and Quick Register's hydration step — returns `null` for an unrecognized/out-of-scope QR, or a row with an empty `branch_inventory` array for an already-fully-released batch — callers must treat these as two distinct friendly states, not crashes) and `releaseStockBatch({...})`.
- **New shared component `src/components/common/ProductPickerList.js`** — the search/suggestions/chips/qty-stepper block extracted out of `AddNewBatchesScreen.js`'s pattern for reuse in Quick Register. `AddNewBatchesScreen.js` itself was deliberately **not modified** — same "don't touch a working screen for one new caller's sake" call as `ManagerActivationScreen.js` earlier.
- **`Stepper.js`** generalized from a hardcoded 2-step component to N-step (`labels` array prop replacing `step1Label`/`step2Label`) — verified backward-compatible since the only other caller (`ManagerActivationScreen.js`) never passed those props.
- **Five new screens**, all `src/screens/manager/`: `ReleaseStockRecipientScreen.js` (role tabs + search + branch-scoped agent cards via `getMyAgentAccounts()`), `ReleaseStockMethodScreen.js` (owns the QR scanner inline; routes to scan-review or Quick Register), `ReleaseStockScanReviewScreen.js` (self-loads via QR lookup, bounded qty steppers), `QuickRegisterReleaseScreen.js` (red "Urgent Release" theme, own mandatory photo), `ReleaseStockConfirmScreen.js` (shared final screen, GPS/device capture, branches on quick-register vs. scan mode, renders `SaveableQRCode` on success).
- `AppNavigator.js` — all five registered. `ManagerDashboardScreen.js` — the "Release Stock" tile's `screen: null` flipped to `screen: 'ReleaseStockRecipient'`.

### Explicitly deferred
Collector-as-courier/multi-hop delivery (`deliv_checkpoints`-style logic); a dedicated Release Logs screen (the `transactions` table itself already satisfies "must be logged" — folded into the merged activity feed instead, see §15); releasing stock accumulated across multiple older batches of the same product via one QR scan (each scan only ever pulls from the one `receiving_batches` batch whose QR was scanned — matches the proposal's own per-batch-QR design; Quick Register is the workaround for "several old batches" cases); `alert_log`/`SR_inventory` discrepancy-reconciliation tables.

## 15. Bug found + fixed Aug 21 — release deleting rows broke both receiving logs AND hid release events entirely

After testing the Quick Register release path, Jay reported two symptoms from one session: `function gen_random_bytes(integer) does not exist`, then (after that was fixed) releases succeeding but showing up in the Logs screen as **"Stock Received" with 0 items/0 units** instead of "Stock Released."

**Bug 1 — `gen_random_bytes`**: same pgcrypto/`extensions`-schema gotcha as §4's `crypt()`/`gen_salt()` issue, hit for the third time now. `release_stock_batch`'s `SET search_path = public` was missing `extensions`. This was avoidable — the gotcha was already written up in this very doc (§4) before the RPC was even drafted. **Worth internalizing**: any new RPC that calls `gen_random_bytes`/`crypt`/`gen_salt` needs `extensions` on its search_path from the start, not as a fix-it-later.

**Bug 2 — root cause, deeper**: `release_stock_batch`'s original design (§14) **deleted** a `branch_inventory` row once its quantity hit 0. Two things depended on that row staying alive:
1. `StockLogsScreen`/`ManagerDashboardScreen` displayed a receiving transaction's item list by *live-querying* `branch_inventory` through the FK embed — not a snapshot. Once a batch was fully released, its rows vanished, and the **original receiving log** retroactively showed 0 items/0 units — a log is supposed to be an immutable record of what happened, not a live view of current state.
2. Neither `StockLogsScreen` nor the dashboard's Recent Logs had ever been taught to query the new `transactions` table at all — so release events were invisible full stop, regardless of the deletion bug. That's why Jay saw "Stock Received" for what was actually a release: the merged log simply didn't know release events existed yet.

**Fix** — `capstone_docs/sql/2026-08-21_fix_release_stock_data_loss.sql`:
- Relaxed `branch_inventory`'s `CHECK` from `quantity > 0` to `quantity >= 0` — a fully-released batch is now a meaningful `quantity = 0` row, not something to delete.
- Added `received_quantity integer NOT NULL` — an immutable snapshot set once at insert time via a new `BEFORE INSERT` trigger (`trg_set_received_quantity`/`set_received_quantity()`), so `receive_stock_batch`'s own source (which nobody has needed to touch) never had to change. Backfilled existing rows from their current `quantity`.
- Rewrote `release_stock_batch` to always **UPDATE** `branch_inventory` (`quantity = quantity - released`), never DELETE.
- Client-side: `getReceivingLogs()` now selects `received_quantity` (not live `quantity`) for its item display; added `getReleaseLogs()` (queries `transactions` with embedded `gps_coordinates`/`media`/`transaction_details`) and `getActivityLogs()` (merges receiving+release, tags each with `logType`, sorts newest-first) to `inventoryService.js`. `StockLogsScreen.js` and `ManagerDashboardScreen.js` both rewritten to consume `getActivityLogs()` instead of receiving-only data, with a `getLogItems(log)` normalizer branching on `logType` to read either `transaction_details` or `branch_inventory` depending on which kind of event it is. `ManagerStockScreen.js`'s bucketing and `ReleaseStockScanReviewScreen.js`'s item list both got a `.filter(row => row.quantity > 0)` added, since depleted batches now persist at `quantity = 0` instead of disappearing.

**Known casualty**: the specific test batch from Jay's triggering run is unrecoverable (its `branch_inventory` row was already deleted by the old buggy RPC before the fix landed) — told Jay to just test fresh rather than expect that data to reappear.

**Status at session end**: the fix SQL was written and its full text was displayed to Jay in chat, but **he had not yet confirmed running it or retesting** when the session ended. First thing to check next session.

## 16. Git / commit status (Aug 21) + hygiene note

Branch: **`jay`**. Commits `4ca30fc`→`68c5756`→`d8e87b6` landed since §11 (Sales Rep/Collector dashboard work + Receive/Request Stock UI scaffolding — happened outside this Claude session, no functions wired yet per Jay's own commit message).

**Nothing from §13-§15's work is committed yet.** Modified: `ConfirmationDialog.js`, `Icon.js`, `Stepper.js`, `AppNavigator.js`, `ManageAccountsScreen.js`, `ManagerDashboardScreen.js`, `ManagerStockScreen.js`, `ReceiveStockPreviewScreen.js`, `StockLogsScreen.js`, `agentService.js`, `inventoryService.js`. New/untracked: `ProductPickerList.js`, `SaveableQRCode.js`, and all five Release Stock screens.

**New hygiene item, worth fixing soon**: `.gitignore` has a blanket `*.sql` rule (line ~297, originally meant for "database backups"). This means **every file in `capstone_docs/sql/` — all four migrations from Aug 18, 19, 20, and 21 — has never actually been tracked by git**, despite living in the repo folder and looking committed. They only exist on whichever machine ran this session. If a teammate pulls `jay` on a different machine, none of this SQL comes with it. Fix: add a narrow exception (`!capstone_docs/sql/*.sql`) above the blanket rule, then commit the four existing files.

## 17. Suggested first steps in a new session

1. Confirm Jay ran `2026-08-21_fix_release_stock_data_loss.sql` and retest a fresh Quick Register release end-to-end — confirm both a "Stock Received" and a "Stock Released" entry appear in Logs/Dashboard with correct item/unit counts (§15, unconfirmed as of session end).
2. Fix the `.gitignore` `*.sql` blanket rule (§16) before anything else gets lost the same way.
3. `git status`/`git diff` — review and commit §13-§15's work once the above is verified.
4. Test the QR-scan release path end-to-end (only Quick Register has been confirmed working so far) — pick a recipient, scan a real Receive Stock QR, adjust a quantity down, confirm, and check `branch_inventory` decremented correctly.
5. Carry-overs, still open: the three stray 0-byte files (6+ sessions now), direct-Supabase-vs-Express-API decision never written into `AGENTS.md`, `capstone_docs/proposal.txt` keep/gitignore decision, `useActivation.js`'s dead duplicate `return`, deciding on a real dev build (unblocks Save-to-Gallery, needed for offline sync later).

---

## 18. What got built Aug 23 (part 1) — Release Stock via Collector: dual recipient + destination map

Session opened with a full repo re-study (confirming §1-§17 still accurate) plus discovering — via `git log` — that a large wave of work had landed on the `jay` branch *outside* this Claude session since Aug 21: the `expo-export/` build-artifact folder finally got untracked, and a big batch of UI-only Manager/Sales-Rep screens appeared (Manage Returns, Manager Alerts, and six Sales Rep screens: Stock, Reports, Settings, Submit Report, Alerts/Discrepancies, Return Stocks). Verified via grep that every one of these has zero backend wiring (no `supabase`/service imports anywhere) except Sales Rep Settings' logout button — confirmed real UI scaffolding, not a regression to chase.

### The ask
Extend the Collector path of Release Stock (built Aug 20-21, direct-to-Sales-Rep only until now) per a mockup: when a Collector is picked as recipient, the manager must *also* pick the target Sales Rep the collector is delivering to, and pin a "Deliver to (destination)" location on a map, alongside the existing auto-captured "Deliver from" origin point.

**Divergence caught before building, confirmed with Jay**: his own description ("only the 2nd and 3rd step differ") undersold what the proposal's own Figures 27-30 describe — the manager picks *both* the Collector *and* the target Sales Rep in step 1 (not just the Collector), matching the mockup's two-person "Recipients:" card and the existing screen's own pre-written "Middleman / Bridge" subtitle. Jay confirmed the fuller (proposal-matching) reading was what he wanted.

**Map library decision**: Jay explicitly ruled out `react-native-maps`/Google Maps API — undocumented Android API key requirement crashes a production APK build. Built `src/components/common/MapLocationPickerModal.js` instead: a `WebView` (new dependency, `react-native-webview@13.16.1`) loading an inline Leaflet.js + OpenStreetMap-tiles HTML page from a CDN — free, no API key, no billing account, and the app already assumes an internet connection everywhere (Supabase, the "Online" pill on every screen) so this is consistent with that. Deliberately did *not* attempt to reproduce the mockup's more elaborate pre-drawn delivery-network route illustration (named hub waypoints, CDO-to-Butuan line) — that appears to belong to the separate, still-deferred live-tracking feature (see §19), not today's literal ask of a tap-to-pin destination.

### Schema (`capstone_docs/sql/2026-08-23_collector_release_delivery.sql`)
- `transactions.movement_type` CHECK widened to add `'collector'` alongside `'direct'`.
- Two new nullable columns on `transactions`: `destination_gps_id` (a second FK into `gps_coordinates`, so the row now has two GPS points) and `target_recipient_id` (the Sales Rep). Invariant CHECK: both set together for `'collector'`, both null for `'direct'`.
- `release_stock_batch` rewritten with 3 new trailing `DEFAULT NULL` params. **Real gotcha caught by design review before it shipped**: this is a different Postgres identity change than the `get_my_agent_accounts` incident (that was a changed *return* shape; this is a changed *argument list*) but has the same failure mode — `CREATE OR REPLACE` can't retarget a changed-arg-list function, it silently creates a second overloaded one and every existing named-param call starts failing with "function is not unique." Fixed the same way: `DROP FUNCTION` (old 9-arg signature) as its own statement before the `CREATE`.
- Branch-scoped `gps_coordinates` RLS policy widened to also match `destination_gps_id`.
- **Required, not optional, client-side fix caught by the same review**: `transactions` now has two FKs into `gps_coordinates`, which makes any unqualified `gps_coordinates(...)` PostgREST embed ambiguous (`PGRST201`) — for *every* row, including old `'direct'` ones, the moment the migration lands. Fixed in `inventoryService.getReleaseLogs()` with `!gps_id`/`!destination_gps_id` embed hints, and `StockLogsScreen.js`'s detail sheet updated to match (`getLogGps()` helper).

### Client
- New `ReleaseStockDeliveryScreen.js` (Collector path only, reached instead of `ReleaseStockConfirm`): "Deliver from" (auto GPS + `expo-location`'s free `reverseGeocodeAsync` for a human-readable label), "Deliver to" (opens `MapLocationPickerModal`, shows both origin/destination pins), mandatory photo, "Review Details" → forwards everything to `ReleaseStockConfirmScreen`.
- `ReleaseStockConfirmScreen.js` now branches on `movementType === 'collector'`: renders the mockup's richer "Confirm & Finish" recap (Recipients card with both people, Chain of Custody card with both coordinate pairs + the one delivery photo — no fabricated "photo 1 of 2" pagination, only one photo actually exists on this side — plus a static informational QR-verification banner) instead of the simple direct-path summary. Direct-path rendering/logic is completely untouched.
- `ReleaseStockRecipientScreen.js` gained a second required picker ("Deliver to (Sales Rep)") shown only when the Collector role tab is active, reusing the already-fetched `agentService.getMyAgentAccounts()` list.
- `.gitignore` fix, flagged as urgent at the end of §16: added `!capstone_docs/sql/*.sql` above the blanket `*.sql` rule — confirmed via `git status` that all 4 prior migration files plus today's are now visible to git (were never tracked before, on any machine).

## 19. What got built Aug 23 (part 2) — Track Deliveries screen

### The ask
Wire up the Manager Dashboard's dead "Track Deliveries" tile: show the status (Not Delivered / Delivered) of each Collector-mediated delivery. Jay was explicit that the status should only ever flip via a **future** Collector-side "mark delivered" action — not built today. He also described a **future** Collector-side "event-based location update" button (explicitly *not* live/continuous tracking — his own framing: "works similarly to Shopee's delivery status," i.e. discrete button-press checkpoints), asking that today's work leave room for it. Asked directly whether to also build that pressable Collector-side button today; Jay chose Manager-screen-and-schema-only, confirming the Collector-side pieces (both mark-delivered and the checkpoint button) are fully deferred.

### What got built
- `transactions.delivery_status` (`'not_delivered'`/`'delivered'`, NULL for direct releases) — populated by a `BEFORE INSERT` trigger, same pattern as `received_quantity`/`set_received_quantity` from the Aug 21 migration, so `release_stock_batch`'s source didn't need touching a third time. **Hit the exact same backfill gotcha as `get_my_agent_accounts`/`release_stock_batch`'s invariant checks before**: adding the CHECK constraint failed against Jay's own earlier Collector-release test data (`delivery_status` still NULL on existing rows, since the trigger only fires on new inserts) — fixed with a one-line `UPDATE ... WHERE movement_type = 'collector' AND delivery_status IS NULL` backfill before the constraint.
- `delivery_checkpoints` (new table — the proposal's `deliv_checkpoints_table`, which has no defined schema anywhere in the proposal text, so this shape is new): `transaction_id`, `latitude`/`longitude`, `captured_by`, `created_at`. RLS: branch-scoped SELECT only for managers — deliberately **no** owner-scoped policy (the usual `captured_by = auth.uid()` pattern), since `captured_by` will hold a Collector's id, which is never any real `auth.uid()` (see §4's resolved trade-off, §20). Nothing writes to this table yet.
- New `src/screens/manager/TrackDeliveriesScreen.js`: lists Collector-mediated transactions with a status pill, tap-through to a detail sheet showing both recipients, items, and a new reusable read-only `src/components/common/StaticRouteMap.js` (same Leaflet/OSM-via-WebView approach as `MapLocationPickerModal`, no interactivity) — shows the origin/destination pins plus the collector's last checkpoint once that exists. Says "No location updates from the Collector yet" today, honestly, since nothing populates `delivery_checkpoints` yet.

## 20. What got built Aug 23 (part 3) — Sales Rep Receive Stock, dynamic dashboard, Logs, Stocks

The biggest piece of the session — the first feature to actually need (and solve) the `auth.uid()`-is-always-null-for-agents gap flagged all the way back in §4 (Aug 14).

### The ask
Real backend for the Sales Rep's "Receive Stock" flow (until now, `ReceiveStockTypeSR.js`/`ReceiveStockSR.js`/`SalesRepStockScreen.js` existed only as UI mocks from an earlier, non-Claude session): scan the release QR a manager generated, confirm with a mandatory photo, and have that become the rep's own tracked stock — plus make the Sales Rep dashboard's stock stat dynamic (mirroring the Manager dashboard), and build a Sales Rep Logs screen "the same as the manager."

### The architectural blocker, solved for the first time
Sales Reps/Collectors are plain `user_profiles` rows verified once via `verify_agent_login`, with a session that's just that row persisted client-side in AsyncStorage — their Supabase client never gets a real session, so `auth.uid()` is permanently NULL for every call they make, forever. Every RLS policy in the app so far is `TO authenticated` keyed on `auth.uid()`, so an agent's client reading any RLS-protected table directly returns nothing. **Fix**: extend the exact pattern `verify_agent_login`/`create_agent_account` already use — `SECURITY DEFINER` RPCs, `GRANT EXECUTE TO anon`, taking the agent's id as an explicit `p_agent_id` parameter instead of relying on `auth.uid()`, each RPC re-verifying that id is a real `sales_rep`/`collector` row before trusting it (same defensive check `delete_agent_account` already does). Not a redesign of agent auth — explicitly out of scope per Jay's own "don't overhaul" instruction — just the same trust model (client-persisted session, no per-call cryptographic re-verification) applied to reads/writes generally, not only login.

This design went through the same dedicated design-review pass as the two prior schema-affecting features this session, which caught two things that would have silently broken the feature at first real use:
1. **Storage upload policy gap**: the existing shipment-photo bucket's INSERT policy is keyed on `auth.uid()` too — an agent's own proof-photo upload would be rejected by Storage RLS before the RPC is ever even called. Fixed with a dedicated `sr-acceptances/` path-prefix policy, `TO anon`.
2. **Missing manager-visibility RLS**: the acceptance-side GPS/photo needed their own branch-scoped SELECT policies (mirroring what the release flow already has), or a manager viewing a rep's acceptance would see the row but not the evidence.
3. **Race condition**: the review specifically flagged that a naive `SELECT-then-INSERT` "already accepted?" check has a TOCTOU gap, and that `INSERT ... ON CONFLICT DO NOTHING` would be the *wrong* fix — a losing concurrent call would silently continue into the stock-crediting loop and double-credit the ledger instead of erroring. Fixed with `SELECT ... FOR UPDATE` locking the `transactions` row by `qr_code` first, so a concurrent accept blocks and then correctly sees "already accepted," with `UNIQUE(transaction_id)` kept only as a hard backstop.

### Schema (`capstone_docs/sql/2026-08-23_sr_receive_stock.sql`)
- `stock_acceptances` (one row per confirmed receipt, own GPS+photo proof distinct from the release-side one, `UNIQUE(transaction_id)`) and `sr_inventory` (the rep's own resulting stock ledger, one row per line item, denormalized from `transaction_details` at acceptance time — a brand-new table, deliberately *not* a reuse of `branch_inventory`, since a rep's personally-carried stock is a different pool from the branch warehouse and merging them would corrupt the Manager Stocks screen's bucket counts). This is the proposal's `SR_inventory_table` (also no defined schema in the proposal text — new shape, following the app's existing `no _table suffix` naming).
- Four new `anon`-granted RPCs: `get_transaction_by_qr_code_for_agent` (QR lookup + recipient-match validation + resolved names, returns jsonb), `accept_stock_release` (the write path described above), `get_sr_inventory` (plain `SETOF sr_inventory`), `get_sr_activity_logs` (jsonb, built entirely inside the RPC since no PostgREST embed is available to an `anon` caller).
- Added mid-implementation, beyond the original plan: an `anon` SELECT storage policy (same `sr-acceptances/` prefix as the INSERT one) so the new Logs screen can actually display the photo an agent just took — the plan only had the INSERT half.

### Client
- `ReceiveStockSR.js` fully rewritten (was 100% hardcoded mock — nothing kept but the JSX shape/styling): scan → `getTransactionByQrCodeForAgent` → handles not-found/already-accepted/wrong-recipient states → shows the *real* resolved Collector-or-Manager source card (not just the pre-scan `handoffType` guess) + items + mandatory photo + GPS/device → Accept Stock. Deliberately **not** built: per-line-item ("per box") QR re-scanning — the mockup's checklist visual is read as two verification *states* (already-scanned, photo pending/done), not two scan actions, matching the proposal's own Figure 40-41 text description (one scan, one photo).
- `SalesRepDashboardScreen.js` got the same real-data treatment `ManagerDashboardScreen.js` already has: Total Items now sums `getSrInventory`, Recent Logs is real and tappable (jumps into the new Logs screen's detail sheet), and the previously-dead document icon now opens it. `Pending Stock` deliberately left hardcoded — per the proposal's own Figure 39 text, that stat means pending *Request Stock* requests, a different, still-unbuilt feature, not un-accepted incoming transactions.
- New `src/screens/salesrep/SalesRepLogsScreen.js` — same structure as `StockLogsScreen.js` (list + detail sheet + date `FilterSheet`), sourced from `getSrActivityLogs`.
- `SalesRepStockScreen.js` — existing mockup UI (product cards, Healthy/Almost-Out sections, search) kept as-is visually, wired to real `getSrInventory` data, bucketed with the same `STOCK_HEALTHY_THRESHOLD`/`NEAR_EXPIRY_DAYS` constants the Manager Stocks screen uses. The mock's fabricated "Pending Item"/"Missing Item" counts (a discrepancy-reconciliation feature that doesn't exist yet) replaced with a real total-batches/total-units summary instead of invented numbers.

## 21. Git / commit status (Aug 23) + hygiene notes

Branch: **`jay`**. Confirmed via `git log` that commits `c623c0b` through `f7514f6` (Manage Returns, Manager Alerts, six Sales Rep UI screens, app navigator update) landed on this branch outside this Claude session since §16 — all UI-only, no backend, per §18's opening paragraph.

**Nothing from today's work (§18-§20) is committed yet.** New dependency: `react-native-webview@13.16.1` (in `package.json`, via `npx expo install`). New/untracked: `capstone_docs/sql/2026-08-23_collector_release_delivery.sql`, `2026-08-23_track_deliveries.sql`, `2026-08-23_sr_receive_stock.sql`, `MapLocationPickerModal.js`, `StaticRouteMap.js`, `ReleaseStockDeliveryScreen.js`, `TrackDeliveriesScreen.js`, `SalesRepLogsScreen.js`. Modified: `.gitignore`, `package.json`, `AppNavigator.js`, `ManagerDashboardScreen.js`, `QuickRegisterReleaseScreen.js`, `ReleaseStockConfirmScreen.js`, `ReleaseStockMethodScreen.js`, `ReleaseStockRecipientScreen.js`, `ReleaseStockScanReviewScreen.js`, `StockLogsScreen.js`, `ReceiveStockSR.js`, `SalesRepDashboardScreen.js`, `SalesRepStockScreen.js`, `inventoryService.js`.

**The `.gitignore` `*.sql` hygiene item from §16 is now fixed** — `capstone_docs/sql/` confirmed visible to `git status` again, all 7 migration files (4 old + 3 from today) ready to be committed whenever Jay wants.

## 22. Suggested first steps in a new session

1. Run all three of today's SQL migrations in Supabase, in order: `2026-08-23_collector_release_delivery.sql` (**two-step — DROP FUNCTION alone first**, same discipline as the Aug 21/19 fixes), then `2026-08-23_track_deliveries.sql` (one paste, includes the backfill for existing test data), then `2026-08-23_sr_receive_stock.sql` (one paste, no DROP-first needed — no existing function's argument list changes).
2. Test the Collector release path end-to-end for the first time (§18): pick a Collector + target Sales Rep, pin a destination on the map, confirm both recipients/coordinate pairs render on the "Confirm & Finish" screen.
3. Test Sales Rep Receive Stock end-to-end (§20) — this is the session's biggest untested surface: scan a real release QR as a logged-in Sales Rep, confirm items/source card/photo/GPS all populate correctly, Accept Stock, then confirm scanning the *same* QR again cleanly rejects as "already accepted" (not a crash, not a double credit) and scanning a QR that belongs to a different rep cleanly rejects as "not assigned to you."
4. Confirm the Sales Rep Dashboard/Logs/Stocks screens reflect a fresh acceptance immediately, and that a Manager on the same branch can see the new `stock_acceptances` row's GPS/photo (the RLS gap the design review caught).
5. `git status`/`git diff` — review and commit §18-§20's work once the above is verified, plus the now-unblocked 4 older SQL files from §16.
6. Carry-overs, still open: the three stray 0-byte files, direct-Supabase-vs-Express-API decision never written into `AGENTS.md`, `capstone_docs/proposal.txt` keep/gitignore decision, `useActivation.js`'s dead duplicate `return`, a real dev build decision (Save-to-Gallery, offline sync).
7. Natural next features once the above is solid: the Collector-side "mark delivered" action and "update my location" checkpoint button (§19, schema is ready and waiting for both), and the Collector-side equivalent of today's Sales Rep Receive Stock (a Collector receiving a Collector-mediated release is the same RPC pair, just called from a Collector-role screen that doesn't exist yet).
6. Once Release Stock is fully verified: wire up the Sales Rep/Collector side of receiving a release (scanning the *release* QR — the mirror image of what Release Stock produces), and start on Collector-as-courier/multi-hop delivery logic (explicitly deferred in §14).

---

## 23. What got built Aug 24 (part 1) — Request Stock, end-to-end

Session opened with the usual restudy + a fresh Supabase schema dump from Jay, cross-checked against what §18-§20 were supposed to produce — matched exactly (`destination_gps_id`/`target_recipient_id`/`delivery_status` on `transactions`, `delivery_checkpoints`, `stock_acceptances`, `sr_inventory` all present with the right FKs), confirming all three Aug 23 migrations ran clean. Jay then confirmed the whole Aug 23 feature set ("everything seems to be working") before starting today's ask.

### The ask
The Sales Rep's "Request Stock" tile, until now a fully hardcoded mock (`RequestStockSR.js`, category-browse UI unrelated to the real product catalog, dead "Review Request" button): a rep should browse their own current stock (bucketed like the Stocks screen), tap products to build a request, review it with capture metadata, and send it to their branch's manager(s). The manager sees a live queue on the Dashboard's existing (also-hardcoded-since-first-scaffolded, labeled "Request") stat tile, and can Decline or Accept — Accept hands off into the *existing* Release Stock flow, pre-filled with the requesting rep and the requested items, auto-allocated against whatever's actually in `branch_inventory` (capped, not copied blind). Once that release completes, the request links back to it for traceability, and the rep sees the outcome (pending/accepted/declined) reflected on their own side.

### Architecture: two new tables, six new RPCs, another design review pass
Same review discipline as the three prior schema-affecting features this week (§18/§20 and the original Release Stock build) — caught four real issues before anything shipped:

1. **A genuine multi-manager race on Accept.** Requests route to *all* managers sharing the rep's branch, not one named manager — so two managers could both tap "Prepare" on the same request and silently overwrite each other's `resolved_by`. Fixed the same way `accept_stock_release` already was this week: `SELECT ... FOR UPDATE` locks the row first, then a `status <> 'pending'` guard, so the second concurrent call cleanly errors instead of racing.
2. **A live, not hypothetical, empty-`branch_ids` edge case.** This project's own Aug 14/16 session notes already document a real Sales Rep account found with `branch_ids = '{}'` (the old `admin-cli` bug). `submit_stock_request` resolves the agent's branch server-side and `RAISE EXCEPTION`s with a clear message on empty or multi-branch arrays, rather than letting an unguarded `branch_ids[1]` read hit a raw `NOT NULL` constraint violation.
3. **No validation on the fulfillment-linking call.** A client bug (stale cached transaction id, a retried call) could otherwise attach an unrelated release to a request with zero server-side proof they're related. `link_request_fulfillment` now checks the request is `'accepted'` and unlinked, and that the transaction's branch/`released_by`/`received_by` all actually match the request before linking — plus a hard `UNIQUE(fulfilled_transaction_id)` backstop.
4. **A `user_profiles` name-resolution gap.** No RLS policy in this app has ever proven "a manager can read a rep *another* manager on the same branch created" — so a raw client-side embed for the requester's name could silently come back null. Every cross-role name lookup in this codebase already resolves inside a `SECURITY DEFINER` function instead (never a raw `user_profiles` embed); `get_branch_stock_requests` follows the same rule.

**Deliberately kept simple, reviewed and judged fine**: `stock_requests.latitude`/`longitude` are plain columns, not routed through the shared `gps_coordinates` table like every other GPS capture in this app — there's no accompanying photo for a request, so there's no second table whose RLS could leave the usual gap. **Also deliberately not built**: an `'preparing'`/intermediate DB status — `fulfilled_transaction_id IS NULL` vs. not already tells you whether a `'accepted'` request truly completed, so the *display* status ("Preparing" vs. "Fulfilled") is derived client-side in `AgentStockRequestScreen.js` rather than stored. `decline_stock_request` was deliberately left callable from `'accepted'` too (guarded by `fulfilled_transaction_id IS NULL`) — the escape hatch for a request stuck in limbo because a manager tapped Prepare then backed out of Release Stock without finishing it.

New file: `capstone_docs/sql/2026-08-24_stock_requests.sql` — `stock_requests` + `stock_request_items` tables, manager-facing branch-scoped RLS, and 6 RPCs: `submit_stock_request` (agent-facing), `accept_stock_request`/`decline_stock_request`/`link_request_fulfillment` (manager-facing, real `auth.uid()`), `get_branch_stock_requests` (manager-facing, all statuses — feeds both the Dashboard stat and the queue screen) and `get_my_stock_requests` (agent-facing).

### Client
- **`RequestStockSR.js`** — full rewrite. Buckets *all* `PRODUCT_CATALOG` entries (not just what the rep already has — a 0-stock product is still requestable) by the rep's `sr_inventory` levels into Healthy/Almost-Out/Out-of-Stock, reusing `SalesRepStockScreen.js`'s exact bucketing logic. Tapping any product opens a `CustomModal` quantity stepper; "Save" adds/updates a cart line; a footer bar ("(N) View Request List") appears once the cart is non-empty. Removed the screen's `BottomNavBar` entirely — it's a dashboard-tile destination, not one of the 4 real bottom-nav tabs, matching the `ReceiveStockTypeSR`/`ReceiveStockSR` precedent.
- New **`RequestListSR.js`** — cart review per the proposal's own Figure 45 (inline +/- steppers right on the summary list, not a static recap), GPS/device/branch/timestamp metadata capture (same pattern as every other proof screen in this app — this is what "phone, location, date and time" in the ask maps to: device info, like every existing "Device: Infinix Zero 30 5G" row elsewhere, not a new phone-number field nothing in this schema has ever tracked), "Send Request" → `submit_stock_request` → simple success state.
- **`SalesRepDashboardScreen.js`** / **`SalesRepLogsScreen.js`** — `Pending Stock` stat (hardcoded since it was first scaffolded, explicitly left that way pending this feature) now counts real pending requests; Recent Logs/the full Logs screen both merge request status-change entries in alongside the existing accepted-stock logs (client-side merge + sort, same pattern the Manager dashboard already uses to merge receiving+release).
- **`ManagerDashboardScreen.js`** — the `pendingRequest` Quick Stat (scaffolded since it was first added, hardcoded `'3'`, never tappable) is now real and navigates to the new queue screen.
- New **`AgentStockRequestScreen.js`** — single feed (not tabbed — matches the mockup and the proposal's own "active workspace with a historical ledger below" framing as one continuous list). Pending rows get Decline/Prepare; "Preparing" (accepted, not yet fulfilled) rows keep a Decline escape hatch; "Fulfilled" rows get a "View Logs" button (simplified to just opening the Logs list, not deep-linked to that one entry — building single-transaction lookup plumbing for that wasn't worth it for this pass). "Prepare" calls `accept_stock_request` then navigates into Release Stock with a `prefillRequest` param.
- **`ReleaseStockRecipientScreen.js`** — gained `useRoute()` (had none before, confirmed clean to add) reading `route.params?.prefillRequest`. Pre-selects the requesting rep in whichever slot matches the active role tab (direct recipient, or target-Sales-Rep if the manager picks Collector) — the manager still picks the delivery *method* manually, only the ultimate recipient is pre-filled. "Next" skips `ReleaseStockMethod`'s manual scan/quick-register choice entirely when a request is being fulfilled (neither fits — the request already specifies exact products) and goes straight to a new auto-allocation screen.
- New **`ReleaseStockRequestReviewScreen.js`** — mirrors `ReleaseStockScanReviewScreen.js`'s stepper UI closely. Greedily allocates each requested product against the manager's live `branch_inventory` (already FIFO-sorted by `getBranchStock`, so no new query needed), capped at what's actually available, with an inline shortfall banner ("requested 15, only 10 available") — never blocks, the manager can still proceed with whatever's on hand. `ReleaseStockDeliveryScreen.js` and `ReleaseStockConfirmScreen.js` both updated to thread a `requestId` param through (the collector-path delivery screen wasn't forwarding it before — a real gap caught while wiring this up, since it only explicitly lists known param names rather than spreading `route.params`). Confirm screen calls `link_request_fulfillment` as a non-blocking follow-up right after a successful release — a failed link gets logged, not surfaced as a release failure, since the release itself already succeeded.

## 24. What got built Aug 24 (part 2) — Sales Rep Track Deliveries

### The ask
Wire up the Sales Rep dashboard's other dead tile: "Track Deliveries," mirroring the Manager's version (§19) but scoped to only the Collector-mediated deliveries where this rep is the `target_recipient_id`, with the same map-viewing behavior.

### What got built
Genuinely small next to §23 — pure read, no new tables, no write path, no race conditions, so this skipped the full design-review pass those two schema-affecting features got and was built directly. One new RPC, `get_my_deliveries(p_agent_id, p_limit)` (`capstone_docs/sql/2026-08-24_sr_track_deliveries.sql`) — same agent-facing `SECURITY DEFINER` + `GRANT TO anon` + explicit-id pattern as every other Sales Rep read this week, querying the same `transactions`/`transaction_details`/`gps_coordinates`/`delivery_checkpoints` data the Manager's screen already reads via a live RLS-gated embed, just filtered to `movement_type = 'collector' AND target_recipient_id = p_agent_id` instead of branch-wide (agents can't use that embed at all — no real `auth.uid()`). New `inventoryService.getMyDeliveries()` wrapper and new `SalesRepTrackDeliveriesScreen.js`, a close mirror of `TrackDeliveriesScreen.js` — same status pill, same tap-to-detail sheet, same `StaticRouteMap` — simplified to one recipient card ("From: {collector}") since the viewer *is* the target recipient, so there's nothing to show as a second name.

## 25. Git / commit status (Aug 24)

Branch: **`jay`**. Confirmed via `git log` that commit `1ac04aa` captured *all* of the Aug 23 session's work in one shot (27 files) before today started — nothing was lost, nothing external landed in between.

**Nothing from today (§23-§24) is committed yet.** New: `capstone_docs/sql/2026-08-24_stock_requests.sql`, `2026-08-24_sr_track_deliveries.sql`, `src/services/requestService.js`, `src/screens/salesrep/RequestListSR.js`, `src/screens/salesrep/SalesRepTrackDeliveriesScreen.js`, `src/screens/manager/AgentStockRequestScreen.js`, `src/screens/manager/ReleaseStockRequestReviewScreen.js`. Modified: `AppNavigator.js`, `ManagerDashboardScreen.js`, `ReleaseStockConfirmScreen.js`, `ReleaseStockDeliveryScreen.js`, `ReleaseStockRecipientScreen.js`, `RequestStockSR.js`, `SalesRepDashboardScreen.js`, `SalesRepLogsScreen.js`, `inventoryService.js`.

## 26. Suggested first steps in a new session

1. Run `2026-08-24_stock_requests.sql` then `2026-08-24_sr_track_deliveries.sql` in Supabase — both are single-paste, no DROP-first step needed (no existing function's argument list changes).
2. `git status`/`git diff` — review and commit §23-§24's work (Jay already confirmed it's working end-to-end in this session).
3. Test the two-manager race guard for real if possible (§23 item 1) — two accounts on the same branch, both try Prepare on the same request, confirm the second cleanly errors rather than racing.
4. Carry-overs, still open: the three stray 0-byte files, direct-Supabase-vs-Express-API decision never written into `AGENTS.md`, `capstone_docs/proposal.txt` keep/gitignore decision, `useActivation.js`'s dead duplicate `return`, a real dev build decision (Save-to-Gallery, offline sync).
5. Natural next features once the above is solid: the Collector-side "mark delivered" action and "update my location" checkpoint button (§19, schema's been ready and waiting since Aug 23), and a Collector-side "receive a release" flow (the same RPC pair Sales Rep Receive Stock already uses, just called from a Collector-role screen that doesn't exist yet) — both would finally give the Collector role real functionality beyond being a pass-through recipient in other people's flows.

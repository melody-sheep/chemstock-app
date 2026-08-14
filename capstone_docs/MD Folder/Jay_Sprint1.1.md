# ChemStock — Session Handoff Notes

Read this first in any new session on this repo. It condenses everything established in prior sessions so context doesn't have to be rebuilt from scratch. Claude does not retain memory across separate sessions — this file is the substitute.

Last updated: August 14, 2026 (end of agent-account-creation session)

---

## 1. Who's on this project

**Alther Adrian Liga, Maria Angela U. Mantiza, Clint John Mila, Jay Fahad P. Sultan, Gio Niel P. Yecyec.** Only Jay was present for both the Aug 13 and Aug 14 sessions covered below. Alther built the Manager Dashboard UI independently (see §3) and left his own notes in `alther_development.md`.

## 2. What this project is

**ChemStock** — a QR-enabled mobile inventory management system (capstone project) for **A and Aimee Laboratories / Cospachem Products**, a Philippine MSME distributing beauty/liniment products through a distributed sales force across the Cagayan de Oro and Butuan branches. Full requirements, literature review, and system design live in `capstone_docs/[PROPOSAL] ChemStock.pdf`. The proposal's ERD image (shown to Claude directly in the Aug 14 session, not re-extracted from the PDF) is the source of truth for planned tables — see §4 for how the live schema currently compares to it.

Core idea: replace paper-based stock receiving/releasing/returns with QR scanning, mandatory photo handover proof, GPS geotagging, agent-level loss tracking, and automated weekly reconciliation.

**Stack:** React Native (Expo ~57, RN 0.86), Android-only, Supabase (Postgres + Auth + Bucket storage), local SQLite for offline sync (not yet implemented). A separate `admin-cli/` (Express + web UI) exists for Super Admin activation-key management.

**Roles:** Super Admin (governance only, generates manager activation keys via `admin-cli`) → Branch Manager (Supabase-Auth-backed, creates Sales Rep/Collector accounts, receives/releases stock) → Sales Rep / Collector (field roles, **not** Supabase-Auth-backed as of Aug 14 — see §4). Role string values live in `src/constants/roles.js`: `manager`, `sales_rep`, `collector`.

## 3. Actual current implementation status

| Component | Status | Notes |
|---|---|---|
| Requirements, TAM study, proposal, Figma prototype | ✅ Done | |
| Expo/RN scaffold, navigation, base components | ✅ Done | |
| Login screen (UI + wired, all 3 roles) | ✅ Done | `src/screens/auth/LoginScreen.js` |
| Manager Activation screen (both steps, wired) | ✅ Done | `src/screens/auth/ManagerActivationScreen.js` |
| Manager Dashboard (real UI) | ✅ Done | Built by Alther Aug 14 — see below, not a placeholder anymore |
| Sales Rep / Collector dashboards (placeholder) | ✅ Done (Aug 14) | Just "Welcome `<name>`" — same bare-shell stage the Manager dashboard was at after Aug 13, deliberately not built out further today |
| Agent account creation (Manager → Sales Rep/Collector) | 🟨 Built, **last test not confirmed working** | See §4/§5 — the very last fix of the session (a case-only file rename not being picked up by Metro) was applied but never confirmed by an actual successful login before the session ended |
| Supabase: `activation_keys`, `activation_audit_log`, `branches`, `user_profiles` | ✅ Done | |
| Supabase: `activate_manager()` RPC | ✅ Done, confirmed working | |
| Supabase: `get_email_by_username()` RPC | 🟨 Exists, **still not confirmed working** | Carried over from Aug 13 — no bare-username manager login was tested Aug 14 either, only agent (Sales Rep/Collector) logins, which don't use this path at all |
| Supabase: `create_agent_account()` / `verify_agent_login()` RPCs | ✅ Done (Aug 14) | See §4 |
| Manager → create Sales Rep/Collector account UI | ✅ Done (Aug 14) | `src/screens/manager/AgentAccountsScreen.js` |
| Architecture: direct Supabase calls vs. Express API layer | 🟨 Recommended, still not formally recorded in `AGENTS.md` | Unchanged from Aug 13 |
| Everything else (inventory, transactions, QR, geotagging, photo proof, reconciliation, alerts, reports, offline sync) | ⬜ Not started | Scoped for Sprints 2–5 |

**Manager Dashboard UI (built by Alther, Aug 14, independent of the Claude session):** real navy header (profile/document/notification icons), collapsing `SecondaryHeader` (welcome text + branch/online status), Quick Stats row, 6-tile Main Operation grid (only "Agent Accounts" navigates anywhere), Recent Logs list, `BottomNavBar` with floating FAB. Built from a screenshot description, not the actual Figma/PDF — icons, colors, and stat data are approximations per his own notes in `alther_development.md`.

**Known repo hygiene item — still unresolved across 3 sessions now:** stray 0-byte files `./,`, `admin-cli/console.log('❌`, `admin-cli/{` are still present. Trivial to delete, just keeps not happening.

**Supabase Auth settings:** "Confirm email" is off (intentional, needed for manager activation's session flow). At one point during the Aug 13 session the whole Email provider got toggled off by mistake and was fixed — worth a occasional sanity check that it's still: provider ON, confirm-email OFF.

## 4. What got built Aug 14 — Sales Rep / Collector account creation

### The ask
Jay wanted a simple way for a Branch Manager to create Sales Rep/Collector accounts — explicitly **not** using the same auth flow as manager registration (no email confirmation, no activation key, no Supabase Auth signup UX) — and to be able to log those accounts in from the main Login screen into placeholder role dashboards by end of session.

### Proposed ERD vs. live schema (flagged per Jay's request to be told about divergences)
Jay shared the proposal's ERD image. Compared to what's actually live:
- Proposed `user_profiles_table`: `user_id`, `username`, `role` (ENUM), singular `branch_id`, `password_hash`. Live `user_profiles`: `id`, `username`, `full_name`, `email`, `role` (text+check), **array** `branch_ids`, `created_by` — the array exists because one activation key already supports multiple branches per manager; `password_hash` didn't exist until today (managers use Supabase Auth instead); `full_name`/`email`/`created_by` aren't in the ERD but are needed for the Supabase-Auth-backed manager flow.
- Proposed `branches_table.manager_id` (FK): deliberately not implemented — `user_profiles.branch_ids` is the single source of truth for the manager↔branch relationship instead, to avoid two places that could disagree.
- Everything else in the ERD (`deliv_checkpoints`, `media`, `transaction`, `transaction_details`, `gps_coord`, `branch_inventory`, `alert_log`, `SR_inventory`) — not built yet, expected for Sprints 2+.

### The architecture decision made today
Sales Rep/Collector accounts live **only** in `user_profiles`, with a real `password_hash` — no `auth.users` row, no email, no Supabase Auth involved at all. This actually matches the ERD better than the manager flow does (the ERD never had a separate auth-provider concept). Managers are completely unaffected — still Supabase-Auth-backed exactly as before.

**Known trade-off, explicitly flagged to Jay, not yet a problem but will be:** because agent accounts never get a Supabase Auth session, they have no JWT, so `auth.uid()` is always null for them. Fine for today's goal (log in, land on a placeholder dashboard) but means once Sprint 2+ needs Sales Reps/Collectors to read/write RLS-protected tables (inventory, transactions), this approach won't support that as-is and will need revisiting — likely a custom session/token scheme, or reconsidering whether agents should get real Supabase Auth accounts after all (with the manager-creates-account flow going through a privileged backend call instead of client-side `signUp()`, to avoid hijacking the manager's own session — see the `git log`/prior-session note on why client-side `signUp()` can't be used for this).

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
`seph@gmail.com` / `seph@2003`, role `sales_rep`, full name "Seph Plongplong" — created successfully via the new form. Login was still being debugged when the session ended (see §5) — **don't assume this account logs in cleanly yet, verify first.**

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

**End-of-session state**: the case-only-rename fix (item 8) was applied and a restart was suggested, but the session ended before Jay confirmed whether login actually succeeded afterward. **First thing to check next session.**

## 6. Git / commit status

Branch: **`main`** (this session ran directly on `main`, not a feature branch — different from earlier sessions).

As of session end, uncommitted in the working tree:
- Modified: `src/hooks/useActivation.js`, `src/navigation/AppNavigator.js`, `src/screens/auth/LoginScreen.js`, `src/screens/manager/AgentAccountsScreen.js`, `src/services/authService.js`
- Untracked: `src/screens/collector/`, `src/screens/salesrep/`, `src/services/agentService.js`

Nothing from today has been committed. Recommend reviewing and committing once the login flow is confirmed working.

Also still true from Aug 13: `src/hooks/useActivation.js` has a harmless-but-untidy leftover — a second, unreachable `return {...}` statement after the real one in the `useActivation` hook. Never got cleaned up, still there.

## 7. Suggested first steps in a new session

1. Confirm whether the Sales Rep login (`seph@gmail.com` / `seph@2003`) actually works after the case-rename fix + restart from the end of this session. If not, start debugging from there.
2. Once confirmed, test a bare-username **manager** login (no `@`) to finally verify the `get_email_by_username` path — this has been unverified across two sessions now.
3. `git status` / `git diff` — review and commit today's agent-account-creation work.
4. Delete the three stray 0-byte files (still hasn't happened across 3 sessions).
5. Decide whether the "no real auth session for agents" trade-off (§4) is acceptable long-term, or whether it needs to be revisited before Sprint 2 needs RLS-protected agent data access.
6. Update `admin-cli`'s key-generation form to populate `activation_keys.branch_ids` — every key generated so far still only writes the old free-text branch fields (carried over from Aug 13, still not done).
7. Write the direct-Supabase-vs-Express-API architecture decision into `AGENTS.md` (carried over, still not done).
8. Clean up the dead code in `useActivation.js` (§6).

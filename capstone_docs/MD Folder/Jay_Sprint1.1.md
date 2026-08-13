# ChemStock — Session Handoff Notes

Read this first in any new session on this repo. It condenses everything established in prior sessions so context doesn't have to be rebuilt from scratch. Claude does not retain memory across separate sessions — this file is the substitute.

Last updated: August 13, 2026 (end of Sprint 1 build session)

---

## 1. Who's on this project

**Alther Adrian Liga, Maria Angela U. Mantiza, Clint John Mila, Jay Fahad P. Sultan, Gio Niel P. Yecyec.** Only Jay was present for the August 13 session covered below.

## 2. What this project is

**ChemStock** — a QR-enabled mobile inventory management system (capstone project) for **A and Aimee Laboratories / Cospachem Products**, a Philippine MSME distributing beauty/liniment products through a distributed sales force across the Cagayan de Oro and Butuan branches. Full requirements, literature review, and system design live in `capstone_docs/[PROPOSAL] ChemStock.pdf` — read that for deep background (problem statement, TAM feasibility study results, ERD, DFD, use case diagrams, Figma screen-by-screen spec, tech stack rationale, evaluation methodology).

Core idea: replace paper-based stock receiving/releasing/returns with QR scanning, mandatory photo handover proof, GPS geotagging, agent-level loss tracking, and automated weekly reconciliation — because losses (100+ units/branch/year, ~₱30k in manager reimbursements) currently aren't caught until annual head-office audits.

**Stack:** React Native (Expo ~57, RN 0.85, React 19), Android-only, Supabase (Postgres + Auth + Bucket storage), local SQLite for offline sync (not yet implemented). A separate `admin-cli/` (Express + web UI) exists for Super Admin activation-key management.

**Roles:** Super Admin (governance only, generates manager activation keys via `admin-cli`) → Branch Manager (creates Sales Rep/Collector accounts, receives/releases stock) → Sales Rep / Collector (field roles). Role string values live in `src/constants/roles.js`: `manager`, `sales_rep`, `collector` (renamed from `salesrep` this session — see §4).

## 3. Actual current implementation status

| Component | Status | Notes |
|---|---|---|
| Requirements, TAM study, proposal | ✅ Done | |
| Figma prototype (~40 screens) | ✅ Done | Referenced throughout the proposal as Figures 16–55 |
| Expo/RN scaffold, navigation, base components | ✅ Done | |
| Login screen (UI + wired) | ✅ Done | `src/screens/auth/LoginScreen.js` |
| Manager Activation screen (UI + wired, both steps) | ✅ Done | `src/screens/auth/ManagerActivationScreen.js` — Step 2 now actually creates the auth user and profile (previously UI-only/mocked) |
| Manager Dashboard (placeholder) | ✅ Done | `src/screens/manager/ManagerDashboardScreen.js` — shows "Welcome `<name>`", nothing else built yet |
| Sales Rep / Collector dashboards | ⬜ Not started | `LoginScreen.js` still just shows an `Alert.alert` TODO for these roles; no screens exist |
| Supabase: `activation_keys`, `activation_audit_log` | ✅ Done | Existing from before this session |
| Supabase: `branches`, `user_profiles` tables | ✅ Done (this session) | See §4 for exact schema |
| Supabase: `activate_manager()` RPC | ✅ Done (this session) | Atomically marks key used + creates profile; see §4 |
| Supabase: `get_email_by_username()` RPC | 🟨 Created, **not yet confirmed working** | Needed for username-based login; last successful login test used the email directly, so the username path through this RPC hasn't actually been exercised yet — test it explicitly next session |
| `authService` / `activationService` | ✅ Done (this session) | Full login → activation → profile chain now works end-to-end, confirmed by manual testing through to the dashboard |
| Manager → create Sales Rep/Collector account flow | ⬜ Not started | Deliberately deferred — see §6, real technical blocker (not just unbuilt) |
| Architecture: direct Supabase calls vs. Express API layer | 🟨 Recommended, not formally recorded | Recommendation this session: keep direct-to-Supabase + RLS for client-initiated actions; the one operation needing backend privilege is staff-account creation (see §6). Not yet written into `AGENTS.md` as a team decision. |
| Everything else (inventory, transactions, QR, geotagging, photo proof, reconciliation, alerts, reports, offline sync) | ⬜ Not started | Scoped for Sprints 2–5 |

**Known repo hygiene item — still unresolved:** three stray 0-byte files exist (confirmed present as of this session): `./,` (repo root), `admin-cli/console.log('❌`, `admin-cli/{`. Safe to delete, just hasn't been done.

**Known security flags:** RLS is now enabled on `activation_keys`, `activation_audit_log`, `branches`, and `user_profiles` per the SQL run this session (self-reported by Jay, not independently re-verified — worth re-running the verification query below before trusting it). The Supabase service role key still lives in `admin-cli/.env`. Verify/rotate before any real pilot data touches the system.

```sql
-- Re-run to confirm RLS state next session
SELECT schemaname, tablename, policyname, cmd, permissive, roles
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
```

**Supabase Auth settings changed this session:** Authentication → Providers → Email — "Confirm email" is now **off** (needed so `signUp()` returns an active session immediately during manager activation, and so the RPC's `auth.uid()` check has a session to check against). Remember to turn this back on before the pilot. Mid-session it was briefly toggled fully off by mistake (the "Enable Email provider" master switch, not just "Confirm email") — that's fixed, but worth a sanity check next session that both settings are in the intended state (provider ON, confirm-email OFF).

## 4. What actually got built this session (Aug 13) — Sprint 1

**Database (Supabase SQL editor):**
- `branches` table: `id, name, region, city, address, is_active, created_at, updated_at`
- `user_profiles` table: `id` (FK → `auth.users`), `username` (unique), `full_name`, `email`, `role` (check: `manager`/`sales_rep`/`collector`), `branch_ids` (uuid array, not a join table — deliberate simplification, see rationale in chat history if needed), `created_by`, timestamps
- `activation_keys.branch_ids` column added (uuid array) — **not yet populated by `admin-cli`'s key-generation form**, which still only writes the old free-text `branch_names`/`branch_locations`. This means every key generated so far activates with `branch_ids = {}`. Updating `admin-cli` to populate this is unstarted and should be an early Sprint 2 (or late Sprint 1) task.
- RLS enabled + policies written for `branches` and `user_profiles` (self/service-role scoped only — no "manager can read their team" policy yet, intentionally deferred, not needed until Sprint 2+)
- `activate_manager(p_code, p_user_id, p_username, p_full_name)` — `SECURITY DEFINER` RPC that atomically validates the key, marks it used, and inserts the `user_profiles` row in one transaction (avoids the burned-key-no-profile race of doing this as two sequential client calls)
- `get_email_by_username(p_username)` — `SECURITY DEFINER` RPC, granted to `anon`, resolves a username to its registered email so login can accept either

**Code — files touched:**
- `src/constants/roles.js` — `SALES_REP` renamed `'salesrep'` → `'sales_rep'` to match what `LoginScreen.js` already hardcoded
- `src/services/activationService.js` — `validateKey()` now returns `branchIds`; `activateManager()` rewritten to call the `activate_manager` RPC instead of a bare `UPDATE`
- `src/services/authService.js` — `login()` and `getCurrentUser()` now fetch the matching `user_profiles` row and attach `role`/`branchIds`/`isActivated`/`full_name` to the returned user; `login()` also resolves a bare username to an email via `get_email_by_username` before calling `signInWithPassword`
- `src/hooks/useActivation.js` — added `completeSetup(username, password)` to the `ActivationViewModel`, wrapping register → activate into one call the screen can use
- `src/screens/auth/ManagerActivationScreen.js` — Step 2's `handleCompleteSetup` actually calls `completeSetup()` now and navigates to `ManagerDashboard` (or prompts email confirmation if no session came back)
- `src/screens/auth/LoginScreen.js` — manager branch of the post-login navigation effect now routes to `ManagerDashboard` instead of a placeholder alert
- `src/screens/manager/ManagerDashboardScreen.js` — **new file**, placeholder screen reading `route.params.name`
- `src/navigation/AppNavigator.js` — registered `ManagerDashboard`

**Status:** manually tested end-to-end — activation key → account setup → dashboard showing "Welcome `<name>`" — confirmed working as of the last message of this session.

**Open, known-not-fixed items from this session:**
- `authService.js` returns the profile's name as `full_name` (snake_case) in both `login()` and `getCurrentUser()`, but `LoginScreen.js`/`ManagerActivationScreen.js` read `user.fullName` / `result.profile.fullName` (camelCase). Not broken — it silently falls back to `username` — but the dashboard will show the username instead of the full name until this key is renamed to `fullName` in both spots in `authService.js`.
- `get_email_by_username` RPC path is unverified — last login test used the email directly (`credentials.username.includes('@')` was `true`, so the lookup branch was skipped). Test logging in with just the bare username next session.
- All of the above code changes are **uncommitted** in the working tree as of end of session (see §5).

**Debugging notes worth knowing for next time (all encountered and fixed this session):**
- A file (`ManagerDashboardScreen.js`) got created at `src/screens/auth/manager/` instead of `src/screens/manager/` — caused a Metro "Unable to resolve module" error. Fixed by moving the file.
- A manual edit to `ManagerActivationScreen.js`'s `handleCompleteSetup` left an unclosed `try` block (missing its `catch`) — Babel syntax error, `Missing catch or finally clause`. Fixed by rewriting the function with one clean outer `try/catch`.
- Twice, a fix that was correctly saved to disk still produced the *old* error in the terminal — both times it was a stale Metro bundle/cache, not a real bug. **If an error persists after a fix that looks correct on disk, clear cache and fully restart (`npx expo start -c`) before assuming the fix is wrong.**
- Supabase Auth has two separate, easy-to-confuse settings under Providers → Email: the **Email provider** master toggle, and **Confirm email** underneath it. Toggling the wrong one produces `Email logins are disabled` vs. `Email not confirmed` — different errors, different fixes.
- Users created via `signUp()` while "Confirm email" was on stay unconfirmed even after the setting is turned off — that setting only affects new signups. Existing stuck test accounts need a manual `UPDATE auth.users SET email_confirmed_at = now() WHERE email = '...'`.

## 5. Git / push & commit status

Current branch: **`claude/chemstock-team-intro-9d009d`** (different from the branch named in earlier handoff notes — this is a new session branch).

**As of end of session, none of the Sprint 1 work above is committed.** `git status` shows all the files listed in §4 as modified, plus `src/screens/manager/` as untracked. Nothing has been staged or committed — review the changes and commit when ready.

The previous handoff noted a GitHub App permissions issue (403 on push) as of August 12. That was not re-tested this session since nothing was pushed — re-verify if a push is attempted and it fails.

## 6. Suggested first steps in a new session

1. `git status` / `git diff` — review and commit the uncommitted Sprint 1 work from §4 before doing anything else, so it isn't accidentally lost.
2. Fix the `full_name` → `fullName` key naming in `authService.js` (§4, "open items") — quick, low-risk.
3. Test login with a bare username (no `@`) to confirm the `get_email_by_username` RPC path actually works.
4. Delete the three stray 0-byte files (§3).
5. Decide and build the Manager → Sales Rep/Collector account creation flow. **Real constraint, not just scope**: client-side `supabase.auth.signUp()` would hijack the manager's own session if called from their logged-in app, so this needs a privileged backend call (either a Supabase Edge Function using the service-role key, or a new `admin-cli`-style Express endpoint) — it can't be done the same way manager activation was.
6. Build placeholder Sales Rep and Collector dashboards + wire their `LoginScreen.js` navigation branches (currently still `Alert.alert` TODOs), for parity with the Manager dashboard.
7. Write the direct-Supabase-vs-Express-API architecture decision into `AGENTS.md` as a short ADR so it stops being an open question every session.
8. Re-run the RLS verification query in §3 to double check policy state.
9. Once the above is solid, re-read `capstone_docs/MD Folder/ChemStock_Sprint_Roadmap.md` for Sprint 1's full Definition of Done and confirm what's left before moving to Sprint 2.

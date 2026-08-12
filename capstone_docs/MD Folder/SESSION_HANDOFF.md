# ChemStock — Session Handoff Notes

Read this first in any new session on this repo. It condenses everything established in the prior session so context doesn't have to be rebuilt from scratch. Claude does not retain memory across separate sessions — this file is the substitute.

Last updated: August 12, 2026 (end of prior session)

---

## 1. Who's on this project

Team introduced themselves for that session only (per-conversation, not persisted): **Alther Adrian Liga, Maria Angela U. Mantiza, Clint John Mila, Jay Fahad P. Sultan, Gio Niel P. Yecyec**. If they want Claude to recognize them by name automatically in future sessions, that needs to be written down here or in `AGENTS.md` — introducing themselves mid-chat only works within that single conversation.

## 2. What this project is

**ChemStock** — a QR-enabled mobile inventory management system (capstone project) for **A and Aimee Laboratories / Cospachem Products**, a Philippine MSME distributing beauty/liniment products through a distributed sales force across the Cagayan de Oro and Butuan branches. Full requirements, literature review, and system design live in `capstone_docs/[PROPOSAL] ChemStock.pdf` — read that for deep background (problem statement, TAM feasibility study results, ERD, DFD, use case diagrams, Figma screen-by-screen spec, tech stack rationale, evaluation methodology).

Core idea: replace paper-based stock receiving/releasing/returns with QR scanning, mandatory photo handover proof, GPS geotagging, agent-level loss tracking, and automated weekly reconciliation — because losses (100+ units/branch/year, ~₱30k in manager reimbursements) currently aren't caught until annual head-office audits.

**Stack:** React Native (Expo ~57, RN 0.85, React 19), Android-only, Supabase (Postgres + Bucket storage), local SQLite for offline sync. A separate `admin-cli/` (Express + web UI) exists for Super Admin activation-key management.

**Roles:** Super Admin (governance only, generates manager activation keys) → Branch Manager (creates Sales Rep/Collector accounts, receives/releases stock) → Sales Rep / Collector (field roles).

## 3. Actual current implementation status

This is the ground truth from reading the code directly, not the proposal's assumed pace:

| Component | Status | Notes |
|---|---|---|
| Requirements, TAM study, proposal | ✅ Done | |
| Figma prototype (~40 screens) | ✅ Done | Referenced throughout the proposal as Figures 16–55 |
| Expo/RN scaffold, navigation, base components | ✅ Done | |
| Login screen + Manager Activation screen (UI) | ✅ Done | `src/screens/auth/` |
| Supabase: `activation_keys`, `activation_audit_log` | ✅ Done | Only 2 tables exist so far |
| Admin CLI (key management) | ✅ Done | Express server, rate limiting, audit logging, web UI — mature and separate from the mobile app |
| `authService` / `activationService` | 🟨 Partial | Login/activation work, but **no role or branch persists after activation** — profile fetching was explicitly removed from the code |
| `user_profiles` / `branches` tables | 🔴 **Missing — top blocker** | Nothing role- or branch-scoped can be built until these exist |
| Architecture: direct Supabase calls vs. Express API layer | 🔴 Undecided | Proposal specifies a 3-tier architecture (RN → Express API → Supabase); current code calls Supabase directly from the client |
| Everything else (inventory, transactions, QR, geotagging, photo proof, reconciliation, alerts, reports, offline sync) | ⬜ Not started | Manager/SalesRep/Collector screen folders exist but are empty |

**Known repo hygiene item:** two stray 0-byte files were created accidentally in `admin-cli/` (`console.log('❌` and `{`) — likely a broken terminal paste. Still uncleaned as of last session; safe to delete.

**Known security flags (from the project's own README):** RLS was reported disabled on `activation_keys`; the Supabase service role key lives in `admin-cli/.env`. Verify/rotate before any real pilot data touches the system.

## 4. Documents produced last session

- **`docs/ChemStock_Sprint_Roadmap.md`** (and a `.docx` twin) — the full sprint plan from kickoff to final defense: current snapshot, Sprint 0 (done) through Sprint 5, the 3-week pilot phase, wrap-up/defense, risks, and a mapping back to the original 23-week capstone Gantt chart. **Read this next** for the actual backlog and Definition of Done per sprint.
- **This file** (`docs/SESSION_HANDOFF.md`) — session continuity notes.

Per the roadmap, **Sprint 1 (Aug 12–24, 2026) is the active sprint** and its goal is exactly the top blocker above: create `user_profiles`/`branches`, wire `activateManager()` to write a profile, decide the architecture question, and get role-based navigation working.

## 5. Git / push status — important

Working branch: **`claude/chemstock-team-intro-0x64ml`**

As of last session, **the Claude GitHub App connected to this session does not have write access to `melody-sheep/chemstock-app`.** Confirmed two ways:
- `git push` → `403` directly from GitHub (not the egress proxy — checked `$HTTPS_PROXY/__agentproxy/status`, no relay failures)
- GitHub API via the integration → `403 Resource not accessible by integration`

This means **local commits may be sitting unpushed** on this branch. Check with `git log origin/claude/chemstock-team-intro-0x64ml..HEAD` and `git status` before assuming GitHub reflects reality. Don't waste time re-diagnosing this — it needs an org admin to grant the Claude GitHub App "Contents: write" access to this repo. If a new session finds push still failing with the same errors, this is why; if it succeeds, the permission was granted and any backlog of local commits should be pushed right away.

If files were sent directly to the team via chat instead of pushed (this happened last session for both the `.docx` and `.md` roadmap), check whether they were manually added to the repo, since the committed-but-unpushed local copies may now be stale or duplicated.

## 6. Suggested first steps in a new session

1. `git status` and `git log origin/<branch>..HEAD` — check for unpushed work before doing anything else, and retry the push once (permissions may have been fixed).
2. Re-read `docs/ChemStock_Sprint_Roadmap.md` for the active sprint's backlog.
3. Confirm with the team whether Sprint 1's architecture decision (direct Supabase vs. Express API) has been made.
4. Confirm whether `user_profiles`/`branches` tables have been created since — if not, that's still the place to start.

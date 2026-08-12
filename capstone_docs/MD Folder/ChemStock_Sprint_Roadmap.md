# ChemStock — Sprint Roadmap

**QR-Enabled Mobile Inventory for A and Aimee Laboratories (Cospachem Products)**

Team: Alther Adrian Liga • Maria Angela U. Mantiza • Clint John Mila • Jay Fahad P. Sultan • Gio Niel P. Yecyec
Repository: `melody-sheep/chemstock-app`
Prepared: August 12, 2026 — **living document, update at every sprint review**

---

## 1. How to Use This Document

This roadmap tracks ChemStock's development from project kickoff through final defense. It's meant to be a living document: at every sprint review or stand-up, update the **Status** column for the relevant sprint(s) so the whole team — and Claude, in future sessions — can see real progress at a glance without reading code or asking around.

Keeping this file in `docs/` means any Claude session working in this repo can read it directly for full context on what's done, what's next, and what's blocked, without you having to re-explain it each time.

**Status legend**

| Symbol | Meaning |
|---|---|
| ✅ | Done — shipped, tested, and merged |
| 🟨 | In Progress — actively being built this sprint |
| 🔴 | Blocked — cannot proceed until a dependency is resolved (see [Risks & Dependencies](#6-risks--dependencies)) |
| ⬜ | Not Started — planned, not yet begun |

---

## 2. Where We Are Today (Snapshot — August 12, 2026)

This reflects the actual state of the repository as of this document's preparation date, not the original capstone Gantt chart's assumed pace. It's the honest starting line for the roadmap below.

| Component | Status | Notes |
|---|---|---|
| Requirements gathering, TAM feasibility study, capstone proposal | ✅ | Interviews with CDO & Butuan branch managers complete; 38-respondent TAM pilot shows 87.4% adoption intent. |
| Figma high-fidelity prototype | ✅ | 40+ screens across Manager, Sales Rep, and Collector points of view. |
| React Native / Expo project scaffold | ✅ | Expo ~57, React Native 0.85, React 19; navigation (`AppNavigator`, `AuthStack`) configured. |
| Login screen (UI) | ✅ | `src/screens/auth/LoginScreen.js` |
| Manager Activation screen (UI) | ✅ | `src/screens/auth/ManagerActivationScreen.js` |
| Supabase: `activation_keys`, `activation_audit_log` tables | ✅ | Key generation, validation, expiry, audit trail all functional. |
| Admin CLI (Super Admin key management tool) | ✅ | Express server with rate limiting, audit logging, and a web UI; separate from the mobile app. |
| `authService` (Supabase Auth) | 🟨 | Login / register / logout / `getCurrentUser` work, but return no role or branch — profile fetching was explicitly removed. |
| `activationService` | 🟨 | Validates keys and marks them used, but never creates a persistent profile record for the activated manager. |
| `user_profiles` / `branches` tables | 🔴 | Do not exist yet. **The single largest blocker** — nothing downstream (roles, branch-scoped data, dashboards) can be built until this exists. |
| Architecture: direct Supabase calls vs. Express API layer for the mobile app | 🔴 | Proposal specifies a 3-tier architecture with an Express API; current code calls Supabase directly from the client. Needs a team decision. |
| Branch inventory, transactions, QR, geotagging, photo proof, reconciliation, alerts, reports, offline sync | ⬜ | Scoped in the proposal (Sections 1.5, 3.3) but no code yet. |
| Manager / Sales Rep / Collector dashboards | ⬜ | Screen folders exist (`src/screens/manager`, `salesrep`, `collector`) but are empty. |

---

## 3. Sprint Roadmap Overview

Sprints are two weeks long, running from today through the pilot testing phase described in the proposal's methodology (Section 3.5). Keep this table in sync with the detail sections below as each sprint closes.

| Sprint | Theme | Dates | Status |
|---|---|---|---|
| Sprint 0 | Foundational Phase (Planning, Design, Scaffold) | Jun 2026 – Aug 11, 2026 | ✅ |
| Sprint 1 | Foundation & Role System | Aug 12 – Aug 24, 2026 | 🟨 |
| Sprint 2 | Manager — Receiving & Branch Inventory | Aug 25 – Sep 7, 2026 | ⬜ |
| Sprint 3 | Manager — Release & Chain of Custody | Sep 8 – Sep 21, 2026 | ⬜ |
| Sprint 4 | Sales Rep & Collector Field Flows | Sep 22 – Oct 5, 2026 | ⬜ |
| Sprint 5 | Reconciliation, Alerts, Reports, Offline Sync | Oct 6 – Oct 19, 2026 | ⬜ |
| Pilot Phase | Deployment, Training & 2-Week Field Pilot | Oct 20 – Nov 9, 2026 | ⬜ |
| Wrap-Up | Documentation Finalization & Final Defense | Nov 10 – Nov 16, 2026* | ⬜ |

\* See the timeline note in [Risks & Dependencies](#6-risks--dependencies) — this runs about a week past the original Gantt chart's Week 23 (Nov 3–7, 2026) end date.

---

## Sprint 0 — Foundational Phase (Completed)

**Dates:** Jun 2026 – Aug 11, 2026 · **Status:** ✅ Done

**Goal:** Establish the project's requirements, design direction, and technical scaffold before feature development begins.

**Backlog**
- Conduct structured interviews with CDO & Butuan branch management to gather requirements
- Run the pre-implementation TAM feasibility study (38 respondents) using a Figma prototype
- Produce the full capstone proposal: problem statement, objectives, scope, literature review, methodology
- Design the system architecture, use case diagram, context diagram, Level 1 DFD, and ERD
- Design ~40 high-fidelity Figma screens across all three user roles
- Scaffold the Expo/React Native project (navigation, constants, styles, base components, services)
- Stand up the Supabase project and the Super Admin activation-key system (`activation_keys`, `activation_audit_log`)
- Build the Admin CLI tool for Super Admin key generation, revocation, and audit logging

**Definition of Done**
- Proposal approved and TAM results documented
- Figma prototype covers all planned screens
- Mobile app boots to the login screen; Super Admin can generate an activation key via the Admin CLI

---

## Sprint 1 — Foundation & Role System

**Dates:** Aug 12 – Aug 24, 2026 · **Status:** 🟨 In Progress

**Goal:** Close the auth/role gap that currently blocks every downstream feature, and lock in the backend architecture direction.

**Backlog**
- Design and create the `branches` table (`branch_id`, `name`, `region`, `city`, `address`, `manager_id`, `is_active`)
- Design and create the `user_profiles` table (`user_id` → `auth.users`, `username`, `role`, `branch_id`, timestamps)
- Wire `activationService.activateManager()` to insert a `user_profiles` row (role = manager, branch_id from the key) on success
- Update `authService.login()` / `getCurrentUser()` to fetch and attach role + branch from `user_profiles`
- Build the Manager → Create Sales Rep / Collector account flow (Figma Figure 19) using the same profile-creation pattern
- Team decision: direct Supabase calls from the mobile client vs. an Express API layer, per the proposed 3-tier architecture — document the decision in `AGENTS.md` or a short ADR
- Enable and verify Row-Level Security policies on `activation_keys`, `activation_audit_log`, `branches`, and `user_profiles`
- Wire up role-based navigation so Manager / Sales Rep / Collector land on distinct (even if placeholder) dashboards
- Repo hygiene: remove the stray `console.log('❌` and `{` files accidentally created in `admin-cli/`

**Definition of Done**
- A manager can activate a key, log in, and land on a role-correct dashboard shell showing their branch
- A manager can create a Sales Rep or Collector account; that account can log in and lands on its own dashboard shell
- RLS is verified enabled on every table currently in use

---

## Sprint 2 — Manager: Receiving & Branch Inventory

**Dates:** Aug 25 – Sep 7, 2026 · **Status:** ⬜ Not Started

**Goal:** A manager can receive a factory shipment into a trackable, FIFO-aware branch inventory with QR and photo evidence.

**Backlog**
- Create `branch_inventory` and `media` tables per the ERD
- Build QR batch generation for products without an existing code (Figma Figure 22)
- Build the scan-to-receive flow: scan or manually register a batch, quantity, manufacture/expiration dates (Figma Figures 21, 23)
- Enforce mandatory native-camera-only photo proof on receiving (block gallery import), uploaded to Supabase Bucket and linked via `media`
- Build the branch inventory dashboard: healthy / near-depletion / out-of-stock views, sorted for FIFO compliance (Figma Figure 20)
- Lay the groundwork for offline-safe local caching of scanned/queued items (`expo-sqlite`) before final commit

**Definition of Done**
- A manager can scan or generate a QR batch, attach a receiving photo, and see the item correctly reflected in the branch inventory dashboard

---

## Sprint 3 — Manager: Release & Chain of Custody

**Dates:** Sep 8 – Sep 21, 2026 · **Status:** ⬜ Not Started

**Goal:** Stock can leave the branch with a verifiable, geotagged, photo-documented chain of custody — whether handed over directly or routed through a collector.

**Backlog**
- Create `transaction`, `transaction_details`, and `gps_coord` tables
- Build the direct release flow: Manager → Sales Rep, face-to-face (Figma Figures 24–26)
- Build the remote release flow: Manager → Collector → Sales Rep (Figma Figures 27–30)
- Integrate `expo-location` to capture GPS coordinates at the point of release
- Enforce mandatory `expo-camera` photo proof on release, embedding GPS, device, and timestamp metadata
- Build the Manager's transaction ledger screen (Figma Figure 37)

**Definition of Done**
- A manager can release stock either directly to a Sales Rep or via a Collector, with GPS, photo, and timestamp captured and visible in the transaction ledger

---

## Sprint 4 — Sales Rep & Collector Field Flows

**Dates:** Sep 22 – Oct 5, 2026 · **Status:** ⬜ Not Started

**Goal:** Field roles can receive, request, and return stock, and collectors can move stock between the branch and the field with full tracking.

**Backlog**
- Create `SR_inventory` and `deliv_checkpoints` tables
- Sales Rep: receive stock via scan + photo + GPS confirmation (Figma Figures 40–41)
- Sales Rep: request stock from the manager (Figma Figures 44–45); Manager's request queue (Figma Figure 32)
- Sales Rep: return stock with salable/damaged condition split and photo proof (Figma Figure 49); Manager return approval (Figma Figures 33–34)
- Collector: accept deliveries and view assignment detail (Figma Figures 51–53)
- Collector: in-transit tracking with checkpoint logging to `deliv_checkpoints` (Figma Figures 54–55)
- Manager & Sales Rep: live delivery tracking views (Figma Figures 35–36, 42–43)

**Definition of Done**
- A full stock cycle — release → collector transit → Sales Rep receipt → sale reporting → return — runs end-to-end with every custody point logged

---

## Sprint 5 — Reconciliation, Alerts, Reports & Offline Sync

**Dates:** Oct 6 – Oct 19, 2026 · **Status:** ⬜ Not Started

**Goal:** Close the loop: reported field activity is automatically reconciled against released stock, discrepancies surface as alerts, and the app keeps working offline.

**Backlog**
- Create the `alert_log` table
- Sales Rep daily report submission — sold / returned per item with real-time discrepancy calculation (Figma Figure 48)
- Automated reconciliation engine comparing released stock vs. reported sales + returns, writing to `alert_log`
- Manager discrepancy/alerts dashboard (Figma Figure 31); Sales Rep alert detail and resolution flow (Figma Figures 46–47)
- Weekly/monthly report generation: print, PDF export, and share-to-chat (Figma Figure 38)
- Offline sync manager: queue writes locally in SQLite when offline, flush to Supabase automatically on reconnect (NetInfo)

**Definition of Done**
- A simulated discrepancy (released ≠ sold + returned) produces an alert visible to both the manager and the flagged Sales Rep
- A monthly report can be generated and exported in at least one format (PDF, print, or share)
- A transaction recorded while offline syncs correctly once connectivity returns

---

## Pilot Testing & Evaluation Phase

**Dates:** Oct 20 – Nov 9, 2026 (3 weeks) · **Status:** ⬜ Not Started

This phase follows the evaluation methodology defined in Section 3.5 of the proposal, run across both the Cagayan de Oro and Butuan branches (39 staff).

**Week 1 (Oct 20–26) — Deployment & Training**
- Deploy the app to all 39 staff across both branches
- Conduct hands-on training per role (Manager / Sales Rep / Collector)
- No evaluation instruments administered this week

**Week 2 (Oct 27–Nov 2) — Active Pilot, Cycle 1**
- Begin the daily Error and Discrepancy Log
- Administer the first round of the Time-Motion Study Log

**Week 3 (Nov 3–9) — Active Pilot, Cycle 2**
- Administer the second round of the Time-Motion Study Log
- Collect final Error and Discrepancy Log entries
- Distribute the UAT Survey and System Usability Scale (SUS) to all 39 participants
- Complete the Pre- vs. Post-Implementation Effectiveness Evaluation Checklist

---

## Wrap-Up — Documentation Finalization & Final Defense

**Dates:** Nov 10 – Nov 16, 2026* · **Status:** ⬜ Not Started

**Backlog**
- Compile pilot results into the Results & Discussion chapter (UAT scores, SUS score, time-motion deltas, discrepancy trends)
- Finalize the manuscript, appendices, and source code documentation
- Prepare the defense slide deck and run at least one mock defense
- Final capstone defense

**Definition of Done**
- Manuscript, source code, and defense materials are submitted and the defense is complete

---

## 6. Risks & Dependencies

- 🔴 **Blocking:** `user_profiles` / `branches` tables do not exist — every feature past login depends on Sprint 1 closing this gap first.
- 🔴 **Blocking:** architecture direction (direct Supabase vs. Express API) is undecided and affects how every service is written — resolve in Sprint 1.
- ⚠️ **Timeline:** the pilot phase, run per the proposal's own 3-week methodology (Section 3.5), pushes the defense to roughly Nov 10–16 — about a week past the original Gantt chart's Nov 3–7 estimate. Confirm the real defense date with your adviser and either compress the pilot or move the date.
- **Security:** RLS was flagged disabled on `activation_keys` in the project README — verify this is resolved before any pilot data is real.
- **Security:** the service role key currently lives in `admin-cli/.env` — rotate before production and keep it out of version control.
- **Field connectivity:** Sales Reps and Collectors operate across all of Misamis Oriental and Caraga — offline sync (Sprint 5) is not optional polish, it is required for the pilot to work at all.
- **Hardware:** confirm which Sales Reps/Collectors need company-provided smartphones ahead of the pilot's training week.

---

## Appendix — Mapping to the Original Capstone Gantt Chart

For traceability back to the proposal's 23-week Gantt chart (Figures 14–15), here is how this roadmap's sprints map to the original 12 deliverables.

| Original Gantt Deliverable | Covered By |
|---|---|
| 1. Development Planning & Environment Setup | Sprint 0 |
| 2. UI/UX Design and Wireframes | Sprint 0 |
| 3. Backend & Database Schema Design | Sprint 0 (initial ERD) → refined per-table across Sprints 1–5 |
| 4. Core Module 1 Development | Sprint 1 (Foundation & Roles) + Sprint 2 (Receiving) |
| 5. Core Module 2 Development | Sprint 3 (Release) + Sprint 4 (Field Flows) |
| 6. Midterm Evaluation / Internal Demo | End of Sprint 3 — recommend a demo checkpoint here |
| 7. Enhancement and Feedback Implementation | Sprint 4–5, folded into each sprint's backlog |
| 8. Frontend Polishing & Integration | Ongoing across Sprints 2–5; a dedicated polish pass recommended before the Pilot Phase |
| 9. Final Module Development & Testing | Sprint 5 (Reconciliation, Alerts, Reports, Offline Sync) |
| 10. System Testing & Bug Fixing | Pilot Testing & Evaluation Phase |
| 11. Documentation Finalization | Wrap-Up |
| 12. Final Defense Preparation & Mock Presentation | Wrap-Up |

---

*End of document. Keep this roadmap in `docs/` and update the Status fields as sprints close so anyone on the team — or Claude, in a future session — can see real progress at a glance.*

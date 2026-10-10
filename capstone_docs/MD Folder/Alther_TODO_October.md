# ChemStock — Alther TODO (October 2026)

Team: Alther Adrian Liga • Maria Angela U. Mantiza • Clint John Mila • Jay Fahad P. Sultan • Gio Niel P. Yecyec
Prepared: September 12, 2026 · Updated: October 6, 2026 — living checklist, check items off as they land and update the notes if scope changes.

Source: raw feature list from the team (Jay), broken down into actionable frontend/backend/database tasks per POV (Manager / Sales Rep / Collector).

**Status legend** (same as `ChemStock_Sprint_Roadmap.md`)

| Symbol | Meaning |
|---|---|
| ✅ | Done |
| 🟨 | In Progress |
| 🔴 | Blocked / needs a team decision first |
| ⬜ | Not Started |

---

## 🔴 PM Priority Check-In — Oct 7, 2026 (Alther, relayed via Messenger)

**Source:** Alther's PM chat, translated/organized here. Claude double-checked all 4 items against the actual code before writing this section — findings below each one, not just the ask.

### A. Offline feature tiers — Discord list, double-checked

```
Tier 0 — Already offline, zero work
  Product catalog, Legal Info/FAQ (static bundled content, no network call at all)
Tier 1 — Read-only cache, highest priority
  Stock Inventory (Manager & Sales Rep)
  Dashboard summary stats
Tier 2 — Read-only cache, secondary
  Logs/history screens (Stock Logs, SR Logs, Track Deliveries)
  Alerts/Discrepancies lists
Tier 3 — Offline write queue (single local outbox, single-writer actions, low conflict risk)
  Sales Rep daily report submission
  Sales Rep return/discrepancy-resolution request
  Collector GPS checkpoints (trip breadcrumbs)
  Collector "mark delivered" confirmation — only after the initial QR scan/lookup already happened online
Tier 4 — Skip, not viable offline
  Release Stock / Receive Stock (shared inventory, concurrent actors)
  Any QR scan-and-lookup step (always needs a live read)
```

- [x] 🔴 Tier 0 confirmed correct (zero work, already static)
- [x] ✅ **Tier 1/2 — done Oct 8.** See Implementation Log §1 below.
- [x] ✅ **Tier 3 — done Oct 8.** See Implementation Log §2 below.
- [x] Tier 4 confirmed correct, matches §65's own exclusion reasoning
- [x] ⚠️ **Conflict resolved:** GPS checkpoints are a manual one-shot tap (Collector taps a landmark label), not continuous tracking — confirmed by Alther. Safe to queue once `captured_at` (not sync time) was added. See Implementation Log §2.
- [x] ⚠️ Confirmed: "Collector 'mark delivered' confirmation" = `finishDeliveryLeg`, already scoped in §65 — same action, not a 5th flow.

### B. Notification feature — what Jay put on hold

Per `Jay_Sprint1.1.md` §62/§64: the **in-app** notification system (7 triggers, bell badges, `NotificationsScreen.js`) is built and confirmed working on-device.
- [ ] Real OS push (pop-up when app is closed) — **still correctly on hold, not started.** `expo-notifications` + `expo-constants`, new `push_tokens` table, a registration RPC, push-send wired into the same 7 trigger points. Needs a dev-client build to test at all — Expo Go on this SDK can't receive real push.
- [x] ✅ **`ConnectionPill.js` wiring — done Oct 8.** See Implementation Log §4 below.

### C. Sales Rep offline report submission — photo proof must survive reconnect

- [x] ✅ **Done Oct 8.** See Implementation Log §2 below.

### D. "Always logged in" after login — corrects Jay's own notes

- [x] ✅ **Done Oct 8.** See Implementation Log §3 below.

---

## 🔴 Bug found & fixed — Oct 9, 2026 (Jay)

**Report:** a Manager logs in successfully, closes the app without logging out, turns off the device's internet connection, then reopens the app. Expected: still logged in (per §3's "Always logged in," Oct 8). Actual: stuck on "Connecting to server..." for a while, then dropped on the Login screen — and can't log back in at all while offline, since login itself needs a live request.

**Root cause (confirmed by reading the code, not guessed):**
1. §3's "Always logged in" fix only covers *having* a persisted session — it never accounted for `authService._loadCurrentUser()` needing a **live `user_profiles` fetch** to rebuild the app-level user object (role, branch, name) for a Manager (Supabase-Auth user). The **agent** (Sales Rep/Collector) branch right above it already had an offline fallback (a cached profile it degrades to); the manager branch never got the same treatment. When that fetch fails offline, `BaseService.handleError()` (`src/services/BaseService.js:25`) always re-throws, the exception is only caught back in `App.js`'s `resolveExistingSession()`, which silently swallows it — so a perfectly valid session gets discarded instead of restored.
2. `App.js`'s `isConnecting` splash state stayed `true` until `testConnection()` *and* the full session-restore chain both finished, with no timeout on either — so offline, where a network call can take a while to actually fail rather than erroring instantly, "Connecting to server..." could sit on screen far longer than it should before (incorrectly) landing on Login.

**Not a database/SQL issue, not an auth overhaul** — this is the same class of fix already applied once correctly for agents, just missing for managers.

**Fix applied:**
- `src/services/authService.js`: added `MANAGER_PROFILE_CACHE_KEY`, mirroring `AGENT_SESSION_KEY`. The manager's resolved profile is now cached on every successful `login()` and every successful `_loadCurrentUser()` fetch, cleared on `logout()`. When the live `user_profiles` fetch fails, it falls back to this cache (matching session `id`) instead of throwing the whole session away. Only on a genuine first-ever offline launch (no cache yet) does it still fail as before — nothing else possible there.
- `App.js`: `testConnection()` is now capped at 6s (`CONNECTION_PROBE_TIMEOUT_MS`) via a `Promise.race` timeout, and runs **in parallel** with `resolveExistingSession()` instead of before it — session restore reads local storage only and has no reason to wait on a slow/hanging network probe.

**✅ Confirmed on device, Oct 9** (Jay) — logged in online, closed the app, went offline (no DNS/mobile data), reopened: landed straight on the Manager Dashboard, no Login screen, no blocking popup. Dashboard finished loading from the existing persisted-cache system (`useCachedFocusLoader`, §1 above) despite every live fetch failing with `UnknownHostException`, so it showed last-known data instead of a blank/broken screen.

**Found and fixed in the same pass:** a pre-existing dev-only "Connection Issue" alert (and a matching full-screen red error view) in `App.js` fired on every failed connection probe regardless of whether a session was actually restored — so the very first offline test blocked a *working* screen behind a scary popup. Both now only trigger when there's truly no session to fall back on.

**Known minor noise, not a functional bug:** several services (`AgentService`, `RequestService`, `ReportService`, `NotificationService`) log a second, blank `CodedError` with just a call stack after their first (correctly-messaged) failure — cosmetic, worth a cleanup pass on those services' error logging later, but doesn't affect behavior.

**Fourth fix, Oct 9 — duplicate discrepancy-resolution submissions + header redesign (Jay)**. While validating Tier 3's outbox for real (submitting a return request offline), found `ResolveDiscrepancyScreen.js` had no guard against resubmitting the same item — nothing stopped the user from re-entering the screen and enqueueing a second (or third) `discrepancy_resolution` outbox entry for the same `reportItemId`, confirmed in the device log (`[Outbox] Enqueued` fired twice for the same item in one session). The form also always started blank on re-entry, which looked like "the photo attachment didn't retain" but was really the user unknowingly building a second, separate request each time. Fixed: both `ResolveDiscrepancyScreen.js` and `AlertsDiscrepanciesSR.js` now check the live outbox (`useOutbox('discrepancy_resolution')`) for an existing queued entry matching that `reportItemId` — if found, the resolve screen shows an "Already Requested — Waiting to Sync" state instead of the form (photo card + submit button hidden), and the pending-list card on the Alerts screen shows "⏳ Saved offline — will send once you're back online" instead of nothing. Same pass also replaced both screens' hand-rolled headers with the shared `Header`/`SecondaryHeader` components already used elsewhere (matches `ManagerAlertsScreen.js`'s pattern) — as a side effect this also fixed a hardcoded "Online" label on `AlertsDiscrepanciesSR.js` that never actually reflected real connectivity; it now uses the same live `useConnectionStatus()` flag as everywhere else. Not yet device-tested.

**Fifth fix, Oct 9 — `SubmitReportSR.js` UI/UX overhaul + input-clipping bug (Jay)**. On a device screenshot, the Sold/Returns figure boxes were rendering a stray "U"-shaped glyph instead of showing empty/"0" — root cause: `figureInput`'s style had a fixed 34px height with no `textAlignVertical`/padding reset, so on this Android device the input's default line-box pushed the "0" placeholder down far enough that its top got clipped by the fixed-height container, leaving only the bottom curve visible (which reads as "U"). Fixed with `textAlignVertical: 'center'`, `paddingVertical: 0`, `includeFontPadding: false`, a taller 40px box, and an explicit light `placeholderTextColor` so an empty box is visually distinct from an entered value. Also replaced the screen's hand-rolled navy `topBar` with the shared `Header` component (matches `ResolveDiscrepancyScreen.js`/`AlertsDiscrepanciesSR.js`), restyled the online-status pill from a saturated green/red box to the same soft palette used elsewhere, swapped the small `PhotoProofCard` handover-photo widget for the larger dashed-border "tap to capture" card pattern already used on `ResolveDiscrepancyScreen.js`, and gave the disabled "Take a Handover Photo First" submit button its own flat gray color instead of navy-at-0.6-opacity (which was rendering as a washed-out purple and read as broken/disabled-by-accident rather than an intentional gating state). Not yet device-tested.

**Sixth fix, Oct 9 — `ResolveDiscrepancyScreen.js` let an already-pending request be resubmitted + slow GPS fix + orange header on `AlertsDiscrepanciesSR.js` (Jay)**. Device log caught the real bug behind a user report ("it says already pending but the photo isn't saved and it lets me attach again"): `ResolveDiscrepancyScreen.js`'s duplicate guard (added in the Fourth fix) only checked the local outbox (`useOutbox('discrepancy_resolution').pending`) — it never looked at `reportItem.latestRequest?.status`, the same field `AlertsDiscrepanciesSR.js` already reads to show "Return request pending manager review" on the list card. So once a request synced to the server, re-entering the resolve screen showed the normal capture form again; submitting re-uploaded a brand-new photo to storage (orphaned — never referenced by anything) and only then got rejected by `request_discrepancy_resolution` with `"A resolution request for this item is already pending manager review"` (confirmed in log at 14:44:37). Fixed by adding `alreadyPendingReview = reportItem?.latestRequest?.status === 'pending'`, combined with the existing outbox check into one `isLocked` flag that gates the photo card and submit button alike, with the "already pending" state message distinguishing "waiting to sync" (local/offline) from "waiting on your manager" (already synced). Separately fixed why the button felt slow even on a first legitimate submit: `handleSubmit` awaited `Location.getCurrentPositionAsync({})` with no bound — an indoor GPS fix can take 15-30s — even though the coords are best-effort context only (already silently swallowed on error). Wrapped it in a 6s `Promise.race` timeout so a slow/no fix now just falls back to no coords instead of stalling the whole submit. Also fixed `AlertsDiscrepanciesSR.js`'s `SecondaryHeader` using a saturated `#FF7800` orange banner that didn't match any other screen — swapped to the same soft red (`#FFEEEE`/`#FFD5D5`, text `#B91C1C`) `ManagerAlertsScreen.js` already uses for its equivalent "Alerts and Discrepancies" banner, including matching its online-pill dot/text colors. Not yet device-tested.

**Ninth fix, Oct 10 — reworked the Eighth fix after Jay's feedback: no manual branch picker, derive it (Jay)**. Jay's correct pushback on the Eighth fix: a Sales Rep shouldn't have to manually choose a branch at all — the branch "must be automatically learn[ed]... since the manager uses stock from the specific branch where the product came." Rewrote `2026-10-10_submit_daily_report_multi_branch.sql` from scratch around a new `_sr_primary_branch(agent)` helper — the branch holding the most of the agent's current remaining stock, traced through `sr_inventory -> transactions.branch_id` (their only branch, in practice, almost always). `submit_daily_report` and `get_my_sr_report_status` both derive it this way now; the `p_branch_id` picker parameter from the Eighth fix is gone entirely, and so is `SubmitReportSR.js`'s `BranchSelector` chip row — replaced with a small read-only "Filing for {branch}" label that only even appears for a multi-branch agent. While tracing this through, found the bug went deeper than just `submit_daily_report`'s own branch check: `get_my_sr_report_status`, `_build_daily_report`, and `_file_overdue_sr_reports` all computed an agent's "in custody" stock from `sr_inventory` with **no branch filter at all** — for a multi-branch agent this silently merged both branches' quantities into one number. All three (plus the new helper) now join `transactions` and filter to the one branch a report is being filed under, so the items shown and the branch the report is attributed to always agree, and a report never silently includes stock from a branch it isn't for. This is also the very likely root cause of the separate bug reported the same session — see below.

**Tenth fix, Oct 10 — SR could enter Sold+Return greater than In Custody (Jay)**. Device screenshot: In Custody 30, Sold 40, Return 20 (60 > 30), Discrepancy showing "30 Over" in a warning-colored box — `updateFigure` in `SubmitReportSR.js` only ever stripped non-digit characters from the input, with no upper bound at all. Jay's own hypothesis that this traced back to the same multi-branch gap as the Ninth fix (merged branch quantities producing a wrong, inflated In Custody figure the UI then let you exceed) is plausible and addressed by that fix, but the missing bound is a real, independent bug regardless of cause. Fixed two ways: client-side, `updateFigure` now clamps so `sold + returns` can never exceed `inCustodyQuantity` as you type (typing past the limit just stops increasing that field); server-side, `_build_daily_report` (same migration as the Ninth fix) now also rejects `sold_quantity + return_quantity > in_custody_quantity` with a clear error — defense in depth, since nothing at the schema level ever enforced this relationship (`daily_report_items`'s own CHECK constraints only require each column individually `>= 0`).

**Eleventh fix, Oct 10 — `SubmitReportSR.js` stat-card icon polish (Jay)**. Per "the icons were ugly" — the Sold Stocks and Return stat badges used fully saturated, mismatched colors (`#3B2FC9` indigo, `#F72E75` hot pink) with white icons, clashing with the soft-pastel palette established everywhere else this session. Restyled both to the same light-background/colored-icon treatment the Given Stock badge already used: Sold Stocks → soft green (`#EAFBF2` bg, `#1E7A3A` icon, matching the "settled/success" color used on Alerts/Resolve Discrepancy), Return → soft blue (`#E3F2FF` bg, `#0085F9` icon, matching the "preparing" status color already used on `SalesRepStockRequestsScreen.js`). Not yet device-tested.

**⚠️ Action needed:** `2026-10-10_submit_daily_report_multi_branch.sql` (Ninth/Tenth fix, now fully rewritten — its own earlier picker-based version was never run) must be run in the Supabase SQL editor before any of this takes effect. Until then, `submit_daily_report` is still whatever `2026-10-06c_notifications_system.sql` last defined, and a multi-branch agent (confirmed real: Clint, Iponan + Butuan) still cannot submit a daily report at all.

**Offline-sync audit, Oct 10 (Jay)** — not a code change, a verified investigation prompted by Jay's question: "if an SR is offline and someone else takes the last of an item online first, does the offline SR's queued request conflict when it syncs?" Traced the actual data flow rather than guessing:
- **No inventory race exists for `stock_request`.** `submit_stock_request` only INSERTs a request row (`stock_requests`/`stock_request_items`) — it never checks or reserves `branch_inventory` at request time. A manager reviews pending requests manually and only checks live current stock when they actually fulfill one via Release Stock (which is itself Tier 4, online-only, per row 40 of the offline tiers). So two reps requesting the same low-stock item can't corrupt anything — the manager sees current real stock at fulfillment time regardless of when either request was submitted or synced. Confirmed this matches the proposal's own stated design ("Discrepancy alerts are presented as notifications requiring manager investigation, not as automatic determinations" — the whole system leans on human review at the contested points, not automatic allocation).
- **Real gap #1 — synced timestamp ≠ actual action time.** `stock_requests`/`daily_reports`/`discrepancy_resolutions` all stamp `created_at DEFAULT now()` at INSERT time, which for an outbox-queued entry is whenever it finally syncs, not when the user actually tapped submit while offline. A manager's queue sorted by `created_at` can show an offline rep's request as arriving *after* one submitted later by someone who stayed online. This exact bug class was already caught and fixed once — for GPS checkpoints specifically, which got a dedicated `captured_at` column distinct from sync time (see row 48, "Conflict resolved"). `stock_requests`/`daily_reports`/`discrepancy_resolutions` never got the equivalent treatment. `outboxService.js`'s `enqueue()` already captures the true origination time (`entry.createdAt = Date.now()`) locally — it's just never sent to the server. Not fixed yet; needs a product decision on whether display-order fairness is worth a schema change here.
- **Real gap #2 — a stuck/failed outbox entry never tells the user anything.** `outboxService.js`'s `flush()` (lines ~211-258): when an executor throws, the entry's `lastError` is recorded and the loop stops (FIFO — don't race ahead of a failure that'll likely repeat), but there is no alert/notification shown to the user beyond the screen's own static "Pending — N waiting to sync" banner. If a synced entry gets genuinely rejected by the server for a real reason (not just "offline, try later" — an actual validation failure), it retries forever with the exact same error and the user has no way to know without opening the screen and noticing the pending banner still hasn't cleared. No code changed yet — flagged for the team to decide whether this needs a push/in-app notification on sync failure, separate from the online/offline `daily_report_submitted`-style notifications that already exist.
- **Real gap #3 — offline daily-report-with-a-discrepancy tells the SR nothing.** The proposal explicitly states "sales representatives are automatically notified following the submission of their daily reports if the automated reconciliation engine detects any variances" (capstone proposal, line ~3006). Checked `SubmitReportSR.js`'s `handleFinalize`: the "Report Submitted — Discrepancy Found" alert (with a "Resolve Now" shortcut) only fires on the **live, online** success path — the offline branch returns early with just the generic "Saved — Will Send Later" message, before `discrepantCount` is ever surfaced. There is also no `notifications` CHECK-constraint type for "your own report has a variance" at all (the existing types are all manager-facing or request-resolution-facing) — so even after a queued report with a discrepancy syncs successfully, the SR is never told. They'd only find out by opening Alerts/Discrepancies themselves.
- **Documentation note, not a bug:** the capstone proposal (line ~1517) specifies `expo-sqlite` for the local offline queue; the actual implementation uses an AsyncStorage-backed queue (`outboxService.js`) instead. Functionally equivalent (a persisted FIFO queue that flushes on reconnect), but worth knowing before a defense Q&A about the stack as documented.

**Twelfth fix, Oct 10 — four more SR screens had zero offline caching, confirmed by device log (Jay)**. Device log from a real `npx expo start` offline test (no network at all, `UnknownHostException` on every call) confirmed exactly what the Oct 10 audit predicted: `SubmitReportSR.js` showed "No in-custody stock to report today" while genuinely holding 30 units, because `getMySrReportStatus` had no cache fallback. Same log run also caught two more screens with the identical gap that weren't on the original Third-fix list: `RequestStockSR.js` (`Branch list error` / `getBranchStockForAgent failed`, both silently falling to empty with nothing to show) and `ReturnStocksSR.js` (`getMyReturnRequests failed`, no cached fallback). Auditing the rest of `src/screens/salesrep/` for the same `useFocusEffect`-without-`useCachedFocusLoader` pattern turned up a fourth: `SalesRepReportsScreen.js` (the "Report Generation" / Daily Report History screen) — same gap, never caught because no offline test had opened it yet. All four retrofitted onto the same `useCachedFocusLoader` pattern already proven on Dashboard/Stock/Backpack:
- `SubmitReportSR.js`: `figures` (the in-progress sold/return typing) is local UI state, not server data, so it's reset only when the actual set of product codes changes (tracked via a ref-compared signature) — not on every background refresh of the same item set, which would otherwise silently wipe out whatever the SR was mid-typing.
- `RequestStockSR.js`: `requestService.getAgentBranches` doesn't distinguish "genuinely zero branches" from "the call failed" (both return `[]`), so an empty result now falls back to the previously cached branch list instead of blanking the branch selector and, with it, the entire stock list (since stock is filtered by `selectedBranchId`).
- `ReturnStocksSR.js`: straightforward same-pattern retrofit.
- `SalesRepReportsScreen.js`: same retrofit, plus a drive-by fix — its "Online" status pill was hardcoded (`backgroundColor: '#B7FFD6'`, static "Online" text, no connection check at all), the exact same bug already found and fixed on `AlertsDiscrepanciesSR.js` earlier. Now reads live `useConnectionStatus()` like every other screen.

Audited but left as-is: `SalesRepDeliveryDetailScreen.js` (the delivery itself arrives via navigation params from an already-cached screen; only the collector's live presence badge is a direct fetch, and degrades acceptably to absent rather than broken) and `SalesRepSettingsScreen.js` (`authService.getCurrentUser()` already has its own offline fallback to a cached profile, from the Oct 9 manager-session-restore fix — no separate caching needed here). Not yet device-tested.

**Thirteenth fix, Oct 10 — stuck photo spinner, clipped offline label, and `NotificationsScreen.js` caching, found from a real device screenshot pass (Jay)**. Jay ran both the online full-navigation test and the real offline test, then sent screenshots of every screen for review rather than describing each bug individually. Three real issues found:
- `ResolveDiscrepancyScreen.js`'s "Submitted Photo" spinner span forever on a Settled item (screenshot). Root cause: the `useEffect` that loads photo/GPS/device detail only ever called `setIsDetailLoaded(true)` on the success path — a failed `getMyReturnRequests` (confirmed firing in the log, `[ERROR] [ReportService] getMyReturnRequests`) returned early without it, so the screen never fell back to "Photo unavailable" and just spun indefinitely. Fixed with `try/finally` so the loaded flag is always set regardless of outcome.
- The "Online"/"Offline · [time]" label in `SubScreenSecondaryHeader` (shared by `SubmitReportSR.js` and the manager's Receive Stock screen) got visibly clipped off the right edge of the screen on a long title like "Today's Report (Submitted)" (screenshot: "Offline · last onl..."). The title `Text` had no `flexShrink`, so it took its full natural width and pushed the status badge past the screen edge instead of the two sharing the row. Fixed with `flexShrink: 1` + `numberOfLines={1}` on the title — benefits every screen using this shared component, not just Submit Report.
- `NotificationsScreen.js` (shared bell-icon screen, all 3 roles) showed "No notifications yet" while a `getMyNotifications` fetch was visibly failing in the log (screenshot) — same "empty state indistinguishable from failed fetch" bug class as every other screen fixed this session, just never audited since it's outside `src/screens/salesrep/`. Retrofitted onto `useCachedFocusLoader`; the screen's own optimistic mark-as-read behavior is preserved via a local `notifications` copy reseeded from the cached snapshot on every load.
- Confirmed NOT a bug: "I can't type in Sold/Returns" on `SubmitReportSR.js` — the screenshot's own title ("Today's Report (Submitted)") and green "Report already submitted" banner show a report was already genuinely filed that day, confirmed by a live (non-cached) server fetch — the form is correctly locked, not broken.
- Confirmed working from the same screenshot pass: Dashboard, Stock, Backpack, Reports (incl. the Oct-10 status-pill fix), Alerts/Discrepancies, My Stock Requests, and Settings all showed correct cached data and correct offline indicators. The real offline test's queued `stock_request` also correctly retried (`[Outbox] Sync attempt failed, will retry later`) on the next app launch instead of being lost. Not yet device-re-tested for this round's 3 fixes specifically.

**Fourteenth fix, Oct 10 — Direct/Collector handoff types weren't actually mutually exclusive, queued stock requests were invisible, and Receive Stock's final Accept step is now offline-capable (Jay)**:
- `ReceiveStockSR.js` had a comment explicitly documenting that the handoff-type button ("Direct From Manager" vs "Via Collector Delivery") was deliberately cosmetic — any valid QR worked regardless of which button got you there, since `batch.movementType` from the server was treated as the only source of truth. Jay's explicit ask reverses this: a 'direct' QR scanned via "Via Collector Delivery" (or vice versa) is now rejected with a clear message before the batch preview ever shows, instead of silently resolving.
- `RequestListSR.js`'s `handleSend` had no duplicate-submission guard, confirmed by Jay actually sending the same cart offline twice. Investigated whether to block resubmission the same way `discrepancy_resolution`/`daily_report` do — decided against it, since stock requests are a multi-item cart, not a fixed single target, so a second "duplicate-looking" send isn't necessarily wrong the way resubmitting the same day's report would be. The real, higher-value fix: `SalesRepStockRequestsScreen.js` ("My Stock Requests") only ever showed server-synced requests — a request queued offline was completely invisible there until it synced, which is what made it feel safe/invisible to send again. It now merges in `useOutbox('stock_request').pending`, shown first, labeled "Waiting for Network."
- Traced the Dashboard's "4 Pending Stock" vs. the stock-requests list showing only 2 — confirmed this is cache staleness between two independently-refreshing screens (`sales-rep-dashboard` and `sales-rep-stock-requests` each cache and refresh on their own schedule), not a bug introduced this session; recommended Jay confirm by refreshing both screens back-to-back while online rather than treating the two cached numbers as required to always match.
- Investigated Jay's ask that Receive Stock itself work fully offline (scan a QR while offline, sync later). Confirmed this cannot work as asked: a QR code is only a unique lookup key (`get_transaction_by_qr_code_for_agent`) — it carries no product/quantity/manager data of its own, so the lookup step has no way to resolve without a live connection, matching Tier 4's original "QR scan-and-lookup always needs a live read" reasoning exactly. Asked Jay to choose between (a) queue only the final Accept confirmation after a live scan+lookup, (b) redesign QR codes to embed full payload data (bigger change, new integrity risks, touches Release Stock too), or (c) leave it online-only. Jay chose (a). Implemented: new `receive_stock` outbox executor (replays `uploadStockAcceptancePhoto` + `acceptStockRelease`); `handleAccept` now queues instead of failing when offline (or when connection drops mid-submit), with a distinct "Saved — Will Send Later" success screen instead of "Stock Accepted"; added the same pending-sync banner and live online/offline pill pattern used everywhere else this session (this screen's pill was also hardcoded to "Online" — same bug class as `AlertsDiscrepanciesSR.js`/`SalesRepReportsScreen.js` earlier, now fixed).
- `NotificationsScreen.js` (bell icon) showed "No notifications yet" during a cold-offline-from-launch test — re-verified the Oct 10 caching fix is structurally correct; this specific device may simply never have completed a successful online load of this exact screen since that fix landed (disk cache only populates after one successful fetch). Needs a retest: open Notifications while online first, confirm it shows real data, then force-quit and reopen offline. Not re-fixed since no actual bug was found in the code.

Not yet device-tested for any of this round's changes.

**Eighth fix, Oct 9 — `submit_daily_report` hard-fails for a multi-branch Sales Rep (Jay)** — ⚠️ **superseded by the Ninth/Tenth fix below** (this entry's `p_branch_id`-picker approach and `BranchSelector` UI were replaced same-day after Jay's feedback that the branch should never be manually picked; kept here only as the original diagnosis/history, not the current fix). Device log: Clint (branch_ids = Iponan + Butuan) could not submit a daily report at all — `submit_daily_report` RPC error every attempt: `"Your account is assigned to more than one branch — daily reports require a single branch"`. This is the exact same bug class already fixed once for `submit_stock_request` in `2026-10-08c_submit_stock_request_multi_branch.sql` (Jay's original "a Sales Rep is always single-branch" assumption, confirmed wrong by this same account) — `submit_daily_report` just never got the same fix. `get_my_sr_report_status` (the in-custody figures shown on the screen) is unaffected — `sr_inventory` has no `branch_id` column at all, so those figures are already correct regardless of branch. New migration `2026-10-10_submit_daily_report_multi_branch.sql`: `submit_daily_report` now takes an optional `p_branch_id` — a single-branch agent is unaffected (auto-derives as before), a multi-branch agent must pass one or gets the same clear error (now only for a stale client). **This migration has not been run against the database yet — it must be run in the Supabase SQL editor before this fix takes effect.** Client side: `reportService.submitDailyReport` now accepts/forwards `branchId`; `SubmitReportSR.js` fetches the agent's branches (`requestService.getAgentBranches`, same call `RequestStockSR.js` already uses) and shows a `BranchSelector` chip row right under the header — renders nothing for a single-branch agent, so unaffected accounts see no change. Not yet device-tested, and blocked on the migration being run first.

**Seventh fix, Oct 9 — the Sixth fix's GPS timeout regressed into a hard DB failure, plus a full Resolve/Alerts UX pass (Jay)**. Device log from the very next test run showed the 6s GPS timeout from the Sixth fix firing as designed (`Location error: Location request timed out`) and then falling back to `null` coordinates exactly as that fix intended — except `request_discrepancy_resolution` unconditionally does `INSERT INTO gps_coordinates (latitude, longitude, ...)` with both columns `NOT NULL` (confirmed by reading `2026-10-06c_notifications_system.sql:449-450`), so every submit now failed outright with `"null value in column \"latitude\"... violates not-null constraint"` — worse than the original slowness, since now it always failed after a 6s wait instead of sometimes succeeding after a long one. Root cause of the slowness itself, found while fixing this: `CameraCaptureModal.js`'s `handleCapture` already resolves a GPS fix the moment the photo is taken and passes it back via `onCapture(uri, coords)` — but `ResolveDiscrepancyScreen.js` wired `onCapture={setPhotoUri}`, silently discarding that second argument, then did a *second*, fully redundant location fetch from scratch at submit time. Fixed properly: `handleCaptured(uri, coords)` now keeps the coords captured alongside the photo (`photoCoords` state) and `handleSubmit` reuses them, only falling back to a fresh resolve (now `getLastKnownPositionAsync` first — near-instant, no GPS wait — then a bounded fresh fix as a last resort) if the capture didn't get one in time; if neither produces a fix, submission is blocked up front with a clear "Location Required" alert instead of ever sending `null` into a NOT NULL column. Also fixed: repeated failed-submit retries were re-uploading the same unchanged photo to a new storage path every time (wasted uploads, more orphaned media) — added an `uploadedPhoto` cache keyed by `photoUri` so a retry reuses the already-uploaded `storagePath` unless the user actually retook the photo. Per a longer UX pass requested the same day: `AlertsDiscrepanciesSR.js`'s banner dropped the red background entirely (now uses `SecondaryHeader`'s own default neutral style, matching `RequestStockSR.js`/`ReturnStockVerifyScreen.js`/etc., not `ManagerAlertsScreen.js`'s red after all — red was still not what was wanted); removed the small warning-triangle/checkmark icons that sat below each item's thumbnail on both Pending and Settled cards (redundant with the existing colored badge, which already does the same job top-right of the card); added small `Icon`s before the "In Custody"/figure-row labels (Released/Sold/Return/Missing or Over) on both `AlertsDiscrepanciesSR.js` and `ResolveDiscrepancyScreen.js`, reusing the same icons as `SubmitReportSR.js`'s stat cards (`checkmarkCircle` for Sold, `returns` for Return) for consistency; Settled cards are now tappable too (previously only Pending was). Tapping either now opens `ResolveDiscrepancyScreen.js` in a new read-only detail state (driven by `reportItem.resolutionStatus === 'resolved'` for Settled, or `latestRequest.status === 'pending'`/local-outbox for Pending) that fetches the originally-submitted photo + GPS + device + timestamp via `reportService.getMyReturnRequests` (matched by `latestRequest.id` against `resolutionRequestId`) and a `createSignedUrl` on `shipment-media` — same data/pattern `ReturnStockVerifyScreen.js` already uses manager-side, now reused read-only for the agent; an offline-queued-but-unsynced item instead previews its own locally-saved photo (`outboxService` entry's `localPhotoUri`) since there's no server copy yet. A rejected request now also shows its reject reason in a banner above the resubmit form, which previously only showed up in the Alerts list, not here. Finally, the Photo Proof section no longer sits inside a bordered/padded card — title + image/placeholder now sit directly in the screen's own padding, same in the capture, pending, and settled states. Not yet device-tested.

**Third fix, Oct 9 — `SalesRepBackpackScreen.js` and `SalesRepStockRequestsScreen.js` had zero offline caching (Jay)**. Unlike Dashboard/Stock (both roles, Tier 1), these two screens were never wired into `useCachedFocusLoader` at all — plain `useState`/`useFocusEffect` with a raw fetch and no fallback. Confirmed via device log: `getSrInventory` failures (`UnknownHostException`) appeared even *before* the deliberate offline test started (real intermittent Wi-Fi), and since these screens had nothing to fall back to, any failure — planned or accidental — just showed blank/zero. Retrofitted both to the same `useCachedFocusLoader` pattern already proven on Stock/Dashboard (previous-snapshot fallback on failed fetch). Not yet device-tested.

**Second real bug found and fixed, Oct 9, while validating Sales Rep offline (Jay)** — `connectionStatus.js`'s global online/offline flag never actually flipped to offline on Android/Expo Go, confirmed by every `[Cache]` log line reporting `"online": true"` throughout an entire offline test session where dozens of calls were visibly failing with `UnknownHostException`. Root cause: `supabaseClient.js`'s `trackedFetch` only called `markOffline()` when `error instanceof TypeError` — the shape a failed `fetch()` throws on iOS/web. On this Android setup it throws Expo's own `CodedError` instead, so the check silently never matched. **This is not just cosmetic** — `ConnectionPill.js` (the Online/Offline indicator on the 3 delivery map screens) reads this same flag, so it has very likely been silently stuck showing "Online" during every real offline test anyone's run on Android. `App.js`'s own splash-screen check was unaffected (it catches its own error directly, doesn't depend on this flag). **Fix**: removed the `instanceof TypeError` narrowing — any `fetch()` rejection at all means a network-level failure (an HTTP error status still resolves normally, it never reaches the catch), so any rejection now marks offline regardless of error class. Confirmed by code read, not yet re-tested on device — next offline test should show `"online": false"` correctly and `ConnectionPill` should flip to red on the map screens.

---

## ✅ Implementation Log — Oct 7/8, 2026

Everything below is backend/database-touching, written down in full per Alther's request — if anything breaks later, this is the paper trail. **None of it has been device-tested beyond what's explicitly marked "confirmed on device."**

### Database migrations (run in this order, all in `capstone_docs/sql/`)

| File | What it does | Status |
|---|---|---|
| `2026-10-08_delivery_checkpoint_captured_at.sql` | Adds `delivery_checkpoints.captured_at` (backfilled from `created_at`); `log_delivery_checkpoint` gains optional `p_captured_at` param (old 5-arg signature dropped first) | ✅ Run, confirmed via schema dump |
| `2026-10-08b_delivery_checkpoint_read_paths.sql` | `get_my_deliveries` and `get_my_collector_deliveries` switched from reading `dc.created_at` to `dc.captured_at` for checkpoints — without this, the write-side fix above would be invisible (right time stored, wrong time still displayed) | ✅ Run |
| `2026-10-08c_submit_stock_request_multi_branch.sql` | `submit_stock_request` gains optional `p_branch_id` (ownership-validated against the agent's own `branch_ids`; old 6-arg signature dropped first). Fixes a real bug found on device: Clint (multi-branch Sales Rep, Iponan + Butuan) could not submit any stock request at all — "Your account is assigned to more than one branch" fired every time, because Jay's "a Sales Rep is always single-branch" assumption (§50/§56) was wrong, not just untested | ✅ Run, confirmed `pronargs: 7`, then confirmed submitting on Clint's device |

**Known gotcha hit again tonight, for the record:** adding a parameter to an existing function changes its signature, so a plain `CREATE OR REPLACE` leaves the *old* version behind as a separate overload instead of replacing it — same issue as the Aug 19 `get_my_agent_accounts` incident. Every migration above does an explicit `DROP FUNCTION IF EXISTS` (old signature) before the `CREATE`. Also hit again: PostgREST's schema cache not picking up a function change until `NOTIFY pgrst, 'reload schema';` is run manually afterward.

### §1. Tier 1/2 — persisted read-caching

`src/hooks/useCachedFocusLoader.js` upgraded to write every successful load to AsyncStorage (`chemstock_cache_<key>`), not just the in-memory `Map` it had before — so a cold app launch with no network now paints the last-known data instead of a stuck skeleton. In-memory behavior is unchanged; this is additive.

Applied to 9 screens total (each with its own "if every sub-fetch failed, keep the previous snapshot entirely" fallback, so a dead network never quietly blanks out data that was already showing):
`ManagerDashboardScreen`, `SalesRepDashboardScreen` (already used the hook, upgraded for free), `ManagerStockScreen`, `SalesRepStockScreen`, `StockLogsScreen`, `SalesRepLogsScreen`, `ManagerAlertsScreen`, `AlertsDiscrepanciesSR`, `TrackDeliveriesScreen`, `SalesRepTrackDeliveriesScreen`.

**Decision recorded:** uses AsyncStorage, not `expo-sqlite`/NetInfo as the original proposal names. This is a deliberate, documented divergence — not an oversight. The Tier 3 outbox (below) already established this pattern; Tier 1/2 just extends it for consistency and to avoid adding a new native dependency on an Expo-Go-only test setup (this project's own repeated history of new-native-module pain, see `Jay_Sprint1.1.md` §7).

### §2. Tier 3 — offline write queue

**New:** `src/services/outboxService.js` (AsyncStorage-persisted FIFO queue, photo persistence via `expo-file-system/legacy` into `pending-outbox/`, flushes on reconnect/app-launch/45s safety interval) and `src/hooks/useOutbox.js`.

5 executors registered, each wired into its screen with the same pattern (already-offline → enqueue immediately; live call fails while still online → today's unchanged error; live call fails and now offline → enqueue instead of erroring):
- `daily_report` — `SubmitReportSR.js`
- `discrepancy_resolution` — `ResolveDiscrepancyScreen.js`
- `stock_request` — `RequestListSR.js`
- `delivery_checkpoint` — `CollectorDeliverStockScreen.js` (`handleLogCheckpoint`)
- `finish_delivery_leg` — `CollectorDeliverStockScreen.js` (`handleFinishDelivery`) — approximates `tripCompleted` locally from already-loaded leg data when queued, worded as "looks like" since it's not server-confirmed

**Deliberately NOT given an executor:** `startDeliveryTrip`. It navigates into a screen keyed by a server-generated `tripId` that doesn't exist until the call actually runs — queuing it would strand the Collector on a screen with nothing to show. Also never on the PM's own Discord list. Reasoning is written into `outboxService.js` itself.

### §3. "Always logged in"

`App.js`: calls `authService.getCurrentUser()` before rendering, regardless of the connection-test outcome (session restore works offline too). `AppNavigator.js`: accepts `initialRouteName` prop, defaults to `'Login'`, set to the correct role dashboard when a session is found. No route params passed through — confirmed by reading all 3 dashboard screens that none of them read `route.params`, they already self-fetch via `getCurrentUser()`.

### §4. `ConnectionPill` wiring

Added to the 3 actual delivery **map** screens (not every screen with an "Online" header, which is a much bigger, out-of-scope cosmetic sweep — 26 files have some hardcoded "Online" text, most of it unrelated decoration): `TrackDeliveryDetailScreen.js` (Manager), `SalesRepDeliveryDetailScreen.js`, `CollectorDeliverStockScreen.js`. Inserted into the existing `topOverlayColumn`, directly under `MapLegend` — the slot the original (never-actually-applied) Oct 5/6 notes already described.

Note: the *other* "Online"/"Last online" text already visible on these same map screens (for the Collector/Sales Rep being tracked) is a different, already-correctly-live system (`presenceService.js` / `touch_presence` / `get_presence`) — not touched, not part of this gap.

### Other fixes made along the way (found via device testing, not originally scoped)

**PM request status: A, B, C, D above are all done.** Everything from here down is extra work that came up afterward — bug fixes you found on device, plus a UI redesign pass you asked for on top. Written out in full, file by file, so any of it can be found and reverted on its own if something breaks — this section is the "fix it back" reference.

#### `BranchSelector.js` — rewritten twice, here's the full history

1. **Original bug:** switching branches made the newly-active chip visually overlap the inactive one. Root cause: `gap` inside a horizontal `ScrollView`'s `contentContainerStyle` not reliably applying on Android once a chip's style array changes reference (happens every press, since `[styles.chip, active && styles.chipActive]` is a new array each time).
2. **First fix attempt (insufficient):** swapped `gap` for explicit `marginRight` per chip. Looked right in the one screenshot checked, but the bug was still reproducible — this ruled out spacing as the actual cause.
3. **Current version — full rewrite:** replaced the whole approach. `ScrollView` → plain `View`, `TouchableOpacity` → `Pressable` (no internal Animated-opacity wrapper, the more likely real cause of the Android stacking issue). **Confirmed working by you** ("its now working!") in this form.
4. **Then changed again per your "make it 1 row" request:** chips no longer `flexWrap` — every chip now gets `flex: 1`, so N chips always divide the row evenly and share one line, truncating text (`numberOfLines={1}`) instead of ever wrapping to a second row. **This specific version has NOT been re-confirmed on device** — it was built after the last confirmed check-in, so re-test it before assuming it's still good.
5. **Alignment fix, separate issue:** the chip row didn't line up with the title text above it on 6 of the 8 screens that use `BranchSelector`. Root cause was inconsistent `edgePadding`: 3 screens needed `edgePadding={SPACING.md}` (label sits in a header with no padding of its own — `SalesRepStockScreen.js`, `ManagerStockScreen.js`, `RequestStockSR.js`), 3 needed `edgePadding={0}` (label already sits inside a padded container, so any non-zero value double-pads — `AgentAccountsScreen.js`, `ReleaseStockRecipientScreen.js`, `ReceiveStockPreviewScreen.js`), and 2 were already correct as-is (`ManagerAlertsScreen.js`, `ManageReturnsScreen.js` — their own negative-margin "bleed" trick already nets out right). **Not device-tested.**

**To revert `BranchSelector.js` to before any of tonight's changes:** go back to `ScrollView horizontal` + `TouchableOpacity` + `gap: SPACING.sm` in `row`, drop the `edgePadding={0}`/`{SPACING.md}` props added to the 6 screens above.

#### `AgentStockRequestScreen.js` — redesigned

Off-brand pink/red theme (hardcoded `SecondaryHeader` color overrides `backgroundColor="#FFF5F8"` / `borderColor="#F9C9DA"`, pink card borders `#F9C9DA`/`#FFF9FB`) replaced with the neutral theme every other screen uses (component defaults, `#EAEFF5` border on white). Action buttons resized from the default `52/18` down to `44/14` (the card-embedded Decline/Prepare/Continue pair) and `40/14` for "View Logs" — which also got `width={140}` + a `document` icon instead of stretching full-width, matching `ReceiveStockPreviewScreen`'s Share/Done button sizing. **Not device-tested.**

#### Multi-branch Sales Rep stock request bug — **confirmed fixed on device** (Clint's account)

Covered above in the SQL migrations table (`2026-10-08c_submit_stock_request_multi_branch.sql`) — the one piece of tonight's extra work that's actually been verified end-to-end on a real device, not just code-complete.

### §5. Stock screens UI overhaul (Manager Stock + Sales Rep Stock) — Oct 8, later session

Everything in this section applies identically to **both** `ManagerStockScreen.js` and `SalesRepStockScreen.js` (same layout, same fixes, same components). **None of it is device-tested yet.**

**New shared components:**
- `src/components/common/InfoTooltip.js` — small red "?" badge; tap shows a short message in a centered popup (built on React Native's own `Modal`, not a `ScrollView`, specifically to avoid repeating the `BranchSelector` class of bug). Appears instantly (`animationType="none"`), card corners `borderRadius: 2` (near-zero), per your request.
- `src/components/common/StockSectionHeader.js` — colored dot (same dot the original design used, not a new icon) + label, with the tooltip `?` sitting immediately next to the label (not pushed to the row's far edge). Replaces the old "Label (Parenthetical Explanation)" pattern on all 3 stock buckets — the explanation now lives in the tooltip:
  - 🟢 "In-Stock" — *"These products have healthy stock levels — no action needed."*
  - 🟡 "Almost Out" — *"These products are running low — plan to resupply soon."*
  - 🔴 "Out of Stock" — *"These products have no stock left on the shelf."*

**`src/components/common/Input.js`** — gained an optional `height` prop (default `44`, unchanged everywhere else that uses this component). Stock screens pass `height={40}` for a more compact search bar.

**`src/components/common/FilterSheet.js`** — redesigned rows: optional icon badge + optional description line per option, a tinted background for the selected row, a radio circle instead of a bare checkmark. The "All Batches" / "Near Expiry Only" options on both Stock screens now carry an icon (`grid` / `warningTriangle`) and a description line.

**`src/components/common/StockBatchCard.js`** — `CARD_WIDTH` 144→120 (shrunk, per request). **Also fixed a real inconsistency**: the card had no fixed height, only content-sized — an out-of-stock card (no batch/expiry text lines) was visibly shorter than an in-stock card (has a status pill + 2 extra text lines). Added a fixed `CARD_HEIGHT: 176`, so every card is now exactly the same box regardless of section; an out-of-stock card just carries a little empty space at the bottom instead of shrinking.

**Search/filter row:** search bar `height={40}` (was 44), filter button `40×40` / `borderRadius: 10` (was `44×44` / `12`), filter icon `18` (was `20`).

**Collapsible "3rd header" (branch chips + search/filter row) — scroll-hide behavior, rewritten twice:**
1. **First version:** manual scroll-delta tracking, hide after >6px moved in one `onScroll` callback, `Animated.timing` 200ms toggle. **Bug:** judged each `onScroll` callback individually — a fast flick down easily exceeded 6px (hiding worked), but a gentle scroll-up fires many callbacks with tiny per-frame deltas that individually never crossed the threshold, so the header stayed stuck hidden no matter how far you scrolled up in total.
2. **Second attempt:** same `Animated.timing` toggle, but accumulated distance since the last direction change instead of judging single callbacks (18px threshold), plus a "within 4px of the top always force-shows" safety net. Still reported not working.
3. **Third attempt:** replaced the hand-rolled logic entirely with `Animated.diffClamp`, the standard React Native primitive built for this exact UI — still reported not working.
4. **Abandoned, reverted to static — current state.** After 3 attempts, pulled the scroll-hide behavior entirely rather than keep debugging blind. Branch chips + search/filter row are a plain, always-visible `View` again (`styles.stockHeaderStatic`), with a `borderBottomWidth: 1` / `#EAEFF5` divider line added to visually separate it from the stock cards below, per your request. All `Animated`/`scrollY`/`diffClamp`/`collapsibleHeight`/`onScroll` code removed from both screens — nothing scroll-driven left in either file. This is the current, simpler, untested-but-low-risk state (it's just a static view with a border, not a novel animation).

---

## Status summary (October 6, 2026)

**Achieved in code** (device check pending unless marked ✅ Confirmed)
- ✅ Confirmed: live Online / Last online status on the delivery maps, with the collector's and Sales Rep's photos (rows 64, 67).
- ✅ Confirmed: Jay's Oct 5 work merged into `main` (commit `fb4069d`).
- Release Stock flow: branch chips, Items to Release card, Take Photo Proof card, confirm branch, rounder cards, camera flashlight, pin far-warning (rows 30–50).
- Pin Delivery Destination map: profile-photo origin marker, glass controls, search bar (offline list empty for now), distance and address insight (rows 40–49).
- Delivery map (all three POVs): shared legend, glass zoom column, status pills, glass header and sheets, dashed arrow route with orange-to-red gradient, photo markers, arrows kept under markers (rows 52–63, 66–75).
- Checkpoint timeline: clock time with age, one shared builder for all roles (row 51).
- Performance: account lookup cached 60 s; dashboards use the cache hook and skeletons only on first load (rows 39, 46).
- Dialogs: shared confirm dialog sized to its content (row 69).
- Multi-branch: branch selector on stock and requests; branch choice on receive and release (rows 26–27).

**Done in the database** (run by you)
- `2026-10-06_presence_last_seen.sql`: `last_seen_at` column, `touch_presence`, `get_presence`.
- `2026-10-06b_delivery_parties.sql`: `get_delivery_parties`.

**Still pending**
- **Run these SQL files** (Jay, Oct 5), not yet confirmed: `2026-10-05_reset_agent_password.sql`, `2026-10-05_daily_report_media_policy_fix.sql`.
- **Decide the stock request branch rule** before running `submit_stock_request` (see row 29).
- **Device checks** for every row marked "Device check pending" above.
- **Known bug, not fixed:** checkpoints logged on a cancelled trip stay on the transactions and show on the next trip's timeline (see §1.3 and row 65).
- **Design decision, not made:** a checkpoint logged at a stop is written to every in-transit delivery on the trip. With two Sales Reps, each one's timeline shows the other's stop.
- **Not built yet:** the collector's pin move on arrival (logged), offline checkpoint queue, and the collector's own last-online status on their own screen.
- **Modern minimal design pass:** the delivery screens still need the full redesign you asked for. The buttons are done (row 75); the rest is open.
- **Sweep items still open:** skeleton loading on about 12 screens; header format and status-bar overlap checks; Manager Receive Stock "Scan QR" not connected; Print QR smoke test on all 4 screens; stock photo device check; FAQ and Laws wording review by the team; ManagerReports branch default.
- **Lists still reload on every visit:** Track Deliveries, Stock, and Logs. The cache hook is ready to apply.
- **Database indexes:** not written yet. Review before running.
- **Connection:** the phone can't reach the PC on SHALOM_5G (client isolation). Use the phone hotspot for device testing.
- **Admin CLI branch review:** after midterm (§5).

---

## 0. Priority order

1. 🟨 **UI enhancement & bug sweep** — Manager first, then Sales Rep, then Collector (see §1)
2. 🟨 **PRIORITY** — Print option for every generated QR code (code fixed Oct 3; device verification pending, see §2)
3. 🟨 Stocks Photo (bundled product photos in place; device check pending, see §3)
4. ✅ Fill the FAQ and Laws screen (see §4)

---

## 1. 🟨 UI enhancement & bug sweep — Manager first

**Goal:** polish the UI and find bugs across all three POVs, one role at a time. Manager first.

**How to work it:**
1. Test each screen on a real device (Expo Go via `npx expo start -c --tunnel`).
2. Log every bug in the table at the bottom: date, POV, screen, what happened, expected behavior.
3. Fix in small batches per screen group, and tick the box only after the fix is confirmed on device.

**Multi-branch (Oct 4):** a manager or rep can cover more than one branch, and each branch has its own storage. Screens show one branch at a time, and a batch or request goes to one branch.

**Pending database actions (run in Supabase SQL editor, then test):**
- [ ] `get_branch_stock_for_agent` — Sales Rep Stock and Request Stock show branch stock
- [ ] `submit_stock_request` with `p_branch_id` — sending a request for a multi-branch rep. ⚠️ Conflicts with Jay's Oct 5 notes (see the conflict note in §1.2). Decide before running.
- [ ] If "could not find the function … in the schema cache" appears: `NOTIFY pgrst, 'reload schema';`
- [ ] `capstone_docs/sql/2026-10-05_reset_agent_password.sql` (Jay, Oct 5). Not yet confirmed run.
- [ ] `capstone_docs/sql/2026-10-05_daily_report_media_policy_fix.sql` (Jay, Oct 5). Not yet confirmed run.

### 1.1 Manager (priority now)

**Dashboard & navigation**
- [ ] `ManagerDashboardScreen.js` — Total Items, Recent Logs, Request tile, FAB QR scanner, profile icon. *Oct 5 (Jay, `fb4069d`): count badges on Reports & Returns and Alerts tiles; reports and discrepancies in Recent Logs. Device check pending.*
- [ ] Bottom nav: tab highlight is correct after going back to Dashboard (fixed Aug 26, re-verify)

**Stock**
- [ ] `ManagerStockScreen.js` — Healthy / Almost Out / Out of Stock buckets, search, near-expiry filter
- [x] Branch selector on Stock — shows one branch's stock at a time (device check pending)
- [ ] `ProductBrowserScreen.js` — catalog photos, out-of-stock dimming
- [ ] `StockLogsScreen.js` — date filters, detail sheet, QR print/save, shipment photo loads. *Oct 5 (Jay): reports and discrepancies shown as ledger rows that open the detail screen.*

**Receive stock**
- [ ] `ReceiveStockScreen.js` / `AddNewBatchesScreen.js` — check whether items added in Add New Batches flow back into Receive Stock's scanned/queued list (noted as not connected in earlier logs)
- [ ] `ReceiveStockPreviewScreen.js` — GPS gating, scroll-to-review gate, success screen (scroll fixed Oct 3)
- [x] Multi-branch receive — manager picks the branch before Register; single-branch managers unchanged (device check pending)

**Release stock**
- [ ] `ReleaseStockMethodScreen`, `ReleaseStockRecipientScreen`, `ReleaseStockScanReviewScreen`, `ReleaseStockDeliveryScreen`, `ReleaseStockConfirmScreen` — step indicator spacing, recipient photos, success QR. *Oct 5 (Jay): branch picker for multi-branch managers in `ReleaseStockRecipientScreen.js`.*
- [ ] `ReleaseStockRequestReviewScreen.js` — flow started from a Sales Rep request

**Returns, alerts, reports**
- [ ] `ManageReturnsScreen.js` / `ReturnStockVerifyScreen.js` — accept / reject, rejected request can be resubmitted. *Oct 5 (Jay): branch filter on the Reports tab; handover photo in report detail.*
- [ ] `ManagerAlertsScreen.js` — sort control, discrepancy resolution. *Oct 5 (Jay): agent name and branch on each alert; All Branches filter.*
- [ ] `ManagerReportsScreen.js` — weekly / monthly Print, PDF, Share-to-Chat on a real device (never tested live). Open: defaults to the first branch; decide if reports show one branch or all.

**Accounts & delivery tracking**
- [ ] `ManageAccountsScreen.js` — role filter, avatars, Remove Account confirmation. *Oct 5 (Jay): ⋮ menu with Reset Password and Remove Account. Needs `reset_agent_password` SQL run first.*
- [ ] `AgentStockRequestScreen.js` — request queue, Decline / Prepare. *Oct 5 (Jay): Continue button for requests stuck in Preparing.*
- [ ] `TrackDeliveriesScreen.js` — route map and checkpoint history (not yet tested against a real Collector trip)

**Settings & profile**
- [ ] `ManagerSettingsScreen.js` — Log Out, FAQ/Laws links, permission rows (currently static, not live permission reads)
- [ ] `EditProfileScreen.js` — photo set/change shows on Header, Settings avatar, and dashboard

**Cross-screen polish**
- [ ] Skeleton loading on the remaining screens that still show a bare spinner or nothing (about 12 screens)
- [ ] `BottomActionBar` not yet used on `ManagerActivationScreen.js` and `ManageAccountsScreen.js`
- [ ] Header format is consistent (left-aligned title, back arrow only on sub-screens)
- [ ] Content not overlapping the status bar on any Manager screen

### 1.2 Sales Rep (after Manager)
- [ ] Dashboard, Stock, Logs, Request Stock, Request List, Submit Report, Alerts & Discrepancies, Resolve Discrepancy, Return Stock, Reports, Track Deliveries, Settings
- **Discovery (Oct 4): multi-branch reps and managers.** A rep or manager can cover more than one branch (e.g. Iponan and Butuan). Each branch has its own storage, so stock is per branch, not one combined total. Implemented: a branch selector (`BranchSelector.js`) on Manager Stock, Sales Rep Stock, and Request Stock, so each screen shows one branch's stock. One request goes to one branch: switching branch with items in the request list asks first, then clears the list. The request list is fixed to the chosen branch. Still open: the manager assigning a rep to a single branch (separate topic, to be tackled later).
- [ ] **Discovery (Oct 4): multi-branch Sales Reps can't send stock requests.** Clint (Iponan / CDO and Butuan) was blocked by `submit_stock_request`, which only accepted one branch. Business rule: a rep registered to a branch covers both branches. Fix in progress: the rep picks the branch on the request list, and the function takes `p_branch_id` (SQL pending run on the database). App side done in `RequestListSR.js` / `requestService.js`.
- [ ] **Topic for later (not in scope now):** managers can assign a Sales Rep to one branch only, to override the multi-branch default. Needs a manager-side UI and a decision on how that affects the rep's stock view.
- [ ] Request Stock popup redesign (image on the right, round +/− buttons, smaller Cancel/Save) — device check pending
- [x] Decision: a request holds one branch. Switching branch with items in the list asks first, then clears it (device check pending)
- [ ] Sales Rep Stock and Request Stock on branch stock (not personal backpack) — device check pending

### 1.3 Collector (after Sales Rep)
- [ ] Dashboard, Accept Deliveries, Deliver Stock, Trip Review, Delivered Stock, Delivery Detail, Settings
- [ ] End-to-end test with a real Collector trip (never run end-to-end yet)

### Bugs found

| Date | POV | Screen | What happened | Expected | Status |
|---|---|---|---|---|---|
| Oct 3 | Manager | Print QR (shared component) | Printed QR was blank | QR image appears in print preview | ✅ Fixed in code, device check pending |
| Oct 3 | Manager | Batch Registered | Share/Done buttons could not be scrolled to | Screen scrolls to reach the buttons | ✅ Fixed in code, device check pending |

### Sweep log (running, newest at bottom)

Each entry: what was reported, the screen, and what was changed or still needs doing. Summarized at the end of the sweep.

| # | Date | POV | Screen | Report / prompt | Notes |
|---|---|---|---|---|---|
| 1 | Oct 3 | All | App launch (tunnel) | App stuck on splash: "New update available, downloading..." after tunnel start | Environment, not a code bug. Metro bundled OK (4550 modules); Expo Go stalls on its update download over the tunnel. Workaround: force-close Expo Go and rescan. |
| 2 | Oct 3 | Manager | Release Stock → Step 1 "Give Out Stock" (`ReleaseStockRecipientScreen.js`) | Sales Rep / Collector profile cards are too short | Fixed in code: `agentCard` now min 150px tall with vertical padding. Device check pending. |
| 3 | Oct 3 | Manager | Release Stock → Step 1 "Give Out Stock" | Search bar sits too close to the Sales Rep / Collector cards | Fixed in code: search input wrapped with a 24px top margin (`searchWrap`). Device check pending. |
| 4 | Oct 3 | Manager | Stepper on all Release Stock steps (`Stepper.js`) | "Step X of 3" label too small | Fixed in code: label 13 → 15px. Shared component, so all steps match. Device check pending. |
| 5 | Oct 3 | Manager | Release Stock → Step 1 role cards | Sales Rep / Collector cards need top margin and more height | Fixed in code: 24px top margin, taller padding. Device check pending. |
| 6 | Oct 3 | Manager | Release Stock → Step 2 "Urgent Release!" (`QuickRegisterReleaseScreen.js`) | Too much red | Fixed in code: header tint and title, camera icon, photo row border now neutral. Red kept on the Quick Register button. The required-field asterisk is still red. Device check pending. |
| 7 | Oct 3 | Manager | Release Stock → Step 2 "Search Product" | Search bar should match the Receive Stock design | Proposal only, awaiting verdict |
| 8 | Oct 3 | Manager | Release Stock → Step 2 product picker (`ProductSelectScreen.js`) | Crash `Cannot read property 'fullName' of undefined` when going to step 3 | Cause: Done navigated back with `navigate` without `merge`, which replaced the route params and dropped the recipient. Fixed in code with `{ merge: true }`. Device check pending. |
| 9 | Oct 3 | Manager | Release Stock → Quick Register after picker Done | Still crashes on Next: the picker's Done pushed a new Quick Register screen instead of returning to the existing one, so the recipient was missing. The debug log showed `paramKeys: ["pickedProducts"]` only. | Cause: React Navigation only reuses an earlier screen when `pop: true` is set. Fixed with `{ merge: true, pop: true }`. Device check pending. |
| 10 | Oct 3 | Manager | Release Stock → Step 2 Next | Next allowed with MFG/EXP unset; date buttons didn't look tappable | Fixed in code: Next is disabled until every item has MFG and EXP, EXP is after MFG, and a photo is taken. A hint line names the blocker. Date buttons are now chips (warning outline when unset). Receive Stock uses the same shared check. Device check pending. |
| 11 | Oct 3 | Manager | Release Stock → Step 3 (Confirm) logic | Asked for a second photo after step 2 already captured one; device name built from model only | Fixed in code: Quick Register uses the step 2 shipment photo as the handover proof and uploads it once. Device name = brand + model (`src/utils/deviceInfo.js`, shared with Receive Stock). Expo device info needs no permission. UI redesign pending. |
| 12 | Oct 3 | Manager | Release Stock → Step 3 layout | Icons missing, device row used a box icon, duplicate photo capture | Fixed in code: device row uses a phone icon, branch a house icon, time a clock. Shared success layout `QRSuccessView.js` used by release success. Device name via `src/utils/deviceInfo.js`. Device check pending. |
| 13 | Oct 3 | Manager | Release Stock → Step 3 summary | Summary had no icons, did not match Figma | Fixed in code: new `ReleaseSummaryCard.js` (orange header, tray icon, collapse toggle, product thumbnails). Batch numbers not shown yet (not in release items). Device check pending. |
| 14 | Oct 3 | Manager | Release Stock → success QR screen | Could not scroll to Share/Done | Fixed in code: `QRSuccessView` is a scroll container. Device check pending. |
| 15 | Oct 3 | Manager | Dashboard header, branch location | Long branch name ran under the illustration | Fixed in code: branch shown as "Ipon..., Butu..." (4 letters per branch), truncated, and tapping it opens Edit Profile. Shorter length is a one-line change if you want "But...". Device check pending. |
| 16 | Oct 3 | Manager | QR scanner (all screens using `QRScannerModal`) | Scanner looked different from the app and used Google branding | Fixed in code: in-app scanner with white corner frame, dark background, title and hint. Flashlight toggle added. Cancel-and-reopen not verified. Device check pending. |
| 17 | Oct 3 | Manager, Sales Rep | Dashboard and Stock scan buttons; Sales Rep dashboard scan | Scans only displayed the code | Fixed in code: Manager scans look up the receiving batch (`src/utils/scanLookup.js`) and show a summary or "No Match". Sales Rep dashboard scan opens Receive Stock with the code. Manager Receive Stock "Scan QR" still not connected. Device check pending. |
| 18 | Oct 3 | Manager | Release Stock photo sections | Did not match Receive Stock's shipment proof layout | Fixed in code: Quick Register step 2 uses `ShipmentProofRow`; Step 3 uses the shared `PhotoProofCard` (photo, expand badge, "From … to …") with the same viewer. Receive Stock preview still has its own copy of the card. Device check pending. |
| 19 | Oct 3 | Manager | Stock page cards | Cards too square and too large; status text above the image | Fixed in code: taller, smaller cards; status pill moved under the image. Device check pending. |
| 20 | Oct 3 | Manager | Stock page section headers | Large gap above "In-Stocks" and weak section hierarchy | Fixed in code: tighter search spacing, larger section titles, bigger status dots. Device check pending. |
| 21 | Oct 3 | All | Logging and debugging | No way to send the session's events and screen history for diagnosis | Added: screen-tagged log buffer, navigation and event logs, global error capture, and "Share Debug Log" in each Settings screen. Device check pending. |
| 22 | Oct 3 | Manager | Release Stock → Step 2 product picker | Picker grid and layout needed a separate screen | Built: `ProductSelectScreen` (multi-select, Done returns the picks), shared `ProductGridTile`, `SearchDropdownField` with `onFieldPress`. Device check pending. |
| 23 | Oct 4 | Sales Rep | Dashboard, Quick Stats "Total Items" | Tapped opened the branch stock, but the card is the rep's personal backpack | Fixed: new `SalesRepBackpackScreen` ("My Backpack", personal `sr_inventory`), backpack icon added to `Icon.js`. Device check pending. |
| 24 | Oct 4 | Sales Rep | Stock and Request Stock | All products showed out of stock; anon-key agents can't read `branch_inventory` under RLS, so the query returned no rows silently | Fixed in code: `getBranchStockForAgent` → `get_branch_stock_for_agent` RPC. SQL to run on the database. Device check pending. |
| 25 | Oct 4 | Sales Rep | Request Stock → Send Request | Blocked: "Your account is assigned to more than one branch", for a rep covering both branches | Fixed in code: `p_branch_id` sent; `submit_stock_request` updated SQL to run on the database (see discovery in §1.2). Device check pending. |
| 26 | Oct 4 | Manager, Sales Rep | Stock and Request Stock, all branches | Stock from both branches was added into one total; a request could exceed the branch's stock; items vanished when switching branch | Fixed in code: `BranchSelector` on Manager Stock, Sales Rep Stock, and Request Stock filters to one branch; switching branch with items asks before clearing; request list fixed to the chosen branch. No new SQL. Device check pending. |
| 27 | Oct 4 | Manager | Receive Stock → Receive and Generate QR | Batch was always registered to the manager's first branch, with no choice | Fixed in code: multi-branch managers choose the branch on the preview screen (`BranchSelector`); the button stays disabled until they do; the chosen branch is saved and shown on the receipt. Single-branch managers unchanged. No new SQL. Device check pending. |
| 28 | Oct 5 | Manager, Sales Rep | Jay's commit `fb4069d` (on `origin/jay`, not yet in `main`) | Committed: multi-branch manager features, QR share as image, stock batch detail screen, count badges, reset agent password, Continue for Preparing requests, report photo policy fix | Next: merge `origin/jay`, run the two `2026-10-05_*.sql` files, device check. Source: Jay's `Jay_Sprint1.1.md` §50–§59. |
| 29 | Oct 5 | Manager, Sales Rep | Stock request branch rule (conflict) | Jay's notes (§50, §56) say a Sales Rep is always single-branch and the backend already derives the branch, so `p_branch_id` was removed client-side. The Oct 4 discovery above says reps cover both branches and needs `p_branch_id`. | Open decision for the PM. Don't run the `submit_stock_request` SQL until it's settled. |
| 30 | Oct 5 | Manager | Add New Batches → Generate QR Code: branch chips | Chips were clipped at the right edge and the first chip was indented twice. "Receive into which branch?" showed only after branches loaded. Chips were blue. | Fixed in code: `BranchSelector` has an `edgePadding` option (edge-to-edge scroll, first chip aligned with the title); chips are neutral (dark text, grey outline, filled charcoal when selected); heading shows at once with skeleton chips while loading. The chip change is shared, so Stock, Request, Release, and Accounts chips are neutral too. Device check pending. |
| 31 | Oct 5 | Manager | Add New Batches → Generate QR Code: location | Location was captured when the photo was taken, but the QR screen showed "Locating…" again and waited for a second fix. | Fixed in code: camera capture passes its GPS fix through `AddNewBatches` to the preview screen, which reuses it. A photo retaken on the preview screen updates the fix. Device check pending. |
| 32 | Oct 5 | Manager | Generate QR Code: branch hint | Hint said "Choose the branch below", but the chips are above it. | Fixed in code: now "Choose a branch above". Device check pending. |
| 33 | Oct 5 | Manager | Generate QR Code: branch icon | House icon was small and thin. | Fixed in code: Phosphor `home` icon, size 20, regular weight. Bold was too heavy. Device check pending. |
| 35 | Oct 5 | Manager | Release Stock → Step 1 "Give Out Stock": branch chips | Chips indented past the title and clipped at the screen's padding, same as Receive Stock. | Fixed in code: `BranchSelector` takes `edgePadding` (the screen's own side padding) so the row runs edge to edge and lines up with the title. Used here with 16px, on Receive Stock with 24px. Device check pending. |
| 36 | Oct 5 | Manager, Sales Rep | Camera capture (`CameraCaptureModal.js`), Shipment Proof and other photo screens | No flashlight in the photo camera, unlike the QR scanner. | Fixed in code: flashlight toggle in the top-right of the live camera, same icons as the scanner. Turns off when the camera closes or a photo is taken. Device check pending. |
| 37 | Oct 5 | Manager | Release Stock → Step 3 "Confirm & Finish": Transaction Details branch | Branch stayed on "Loading branch…" even though it was picked in step 1. The card read the manager's single `branchName`, which a multi-branch manager doesn't have. | Fixed in code: the branch name is looked up from the chosen `branchId`. Shows "Branch unavailable" if it can't be found. Device check pending. |
| 38 | Oct 5 | Manager | Release Stock: cards and frames too round | Corner radius was 12–16px on the release cards and banners, which looked too soft. | Fixed in code: cards and banners on the Delivery and Confirm screens, plus the shared `PhotoProofCard`, `ShipmentProofRow`, and `ReleaseSummaryCard`, now use 8px. Pills and round badges are unchanged. Device check pending. |
| 39 | Oct 5 | Manager, Sales Rep | Dashboard Quick Stats and cards reloaded on every visit, with skeletons each time | Every return to the dashboard re-ran all queries and showed the skeleton again. | Fixed in code: new shared hook `src/hooks/useCachedFocusLoader.js`. The last result is kept per screen; skeletons only show when nothing is cached yet; a revisit within 30 seconds reuses the result, and a later revisit refreshes it quietly. Both dashboards use it. Other screens still load on every visit. Device check pending. |
| 40 | Oct 5 | Manager | Release Stock → Pin Delivery Destination map: first open had no current-location dot | The map page was built once, before the GPS fix arrived, so the origin never showed until the modal was reopened. | Fixed in code: the origin is pushed into the running map (`window.setOrigin`) on load and whenever the fix changes, without reloading the page, so a pin already placed is kept. Device check pending. |
| 41 | Oct 5 | Manager | Release Stock → Pin Delivery Destination map: look and controls | The origin was a plain blue square, the header and footer were flat, and there were no map controls outside Leaflet's own. | Fixed in code: the origin is the manager's profile photo (initials when there is none) in a pulsing ring. The header, zoom/recenter column, and footer are glass panels (`COLORS.glassSurface` / `glassBorder`). Leaflet's zoom buttons are off, and the glass buttons drive the map. No new packages and no new map or routing services. Real blur and the dark or satellite maps are left out for now. Device check pending. |
| 42 | Oct 5 | Manager | Release Stock → Pin Delivery Destination map: starting view and footer buttons | The map didn't center on the manager until the arrow was tapped, and Cancel and Confirm sat side by side and were too large. | Fixed in code: the map centers on the manager's position once the first fix arrives, unless a destination is already pinned. Confirm and Cancel stack as full-width rows at 44px height, and the footer is tighter. Device check pending. |
| 43 | Oct 5 | Manager | Release Stock → Pin Delivery Destination map: destination marker | The destination was a drawn red teardrop, not the app's location icon. | Fixed in code: the marker is the Phosphor map-pin glyph, stored as `mapPin` in `Icon.js` and drawn inside the map with the app's error colour. The `location` icon in the app is unchanged. Device check pending. |
| 44 | Oct 5 | Manager | Release Stock → Pin Delivery Destination map: pre-confirm details | The pin showed only coordinates, with no sense of how far it is or what place it is. | Added in code: an insight card above the buttons shows the straight-line distance from the manager ("5.2 km away", using `utils/distance.js`), the coordinates, and the address for the pinned point (the device geocoder the delivery screen already uses, in `utils/formatPlace.js`). The address updates 400 ms after each drag or tap. Distance is straight-line, not a road route. Device check pending. |
| 45 | Oct 5 | Manager | Release Stock → Pin Delivery Destination map: destination marker style | The destination pin used the outline glyph, which looked too thin on the map. | Fixed in code: the solid (fill) map-pin glyph, stored as `mapPinFill` in `Icon.js`, is now the destination marker. Device check pending. |
| 46 | Oct 5 | All | Code health: `authService.getCurrentUser()` ran several database calls on almost every screen focus | Logs showed the session, profile, branch names, photo URL, and for agents an RPC, repeated on each screen. | Fixed in code: results are reused for 60 seconds. Login and logout clear the cache. `clearCurrentUserCache()` is there for profile edits (the Edit Profile screen should call it after saving). Device check pending. |
| 47 | Oct 5 | Manager | Release Stock → Confirm & Finish: "Items to Release" card | The header had a filled white icon box and a filled toggle button, and only the small arrow expanded the list. | Fixed in code: the whole header is the toggle. The icon sits on the orange tint with no box, and the header has a divider only while open. The chevron turns in 150 ms. The list opens and closes instantly. Device check pending. |
| 48 | Oct 5 | Manager | Release Stock → Step 3 "Take Photo Proof" | The photo was a small thumbnail, tapping it reopened the camera, and it showed no metadata, unlike the shipment proof. | Fixed in code: a photo card with a preview and a full-size viewer, plus rows for location, device, and time. Retake happens from the viewer. Device check pending. |
| 49 | Oct 5 | Manager | Release Stock → Pin Delivery Destination map: search | No way to find a place by name. | Added in code: a search bar below the header. It checks the offline list (`constants/savedPlaces.js`, empty for now) first, then the device geocoder when online. Choosing a result moves the map there. A "Search needs a connection" message shows offline. Device check pending. |
| 50 | Oct 5 | Manager | Release Stock → Pin Delivery Destination map: far-pin warning | No check on how far the pin is from the manager. | Added in code: a pin more than 200 m from the manager's current position asks "Confirm anyway" before saving. The reference is the current position, which is the pickup point at release time. Collector-side checks come with checkpoints. Device check pending. |
| 51 | Oct 5 | Manager, Sales Rep, Collector | Checkpoint timeline ("Current Location") time display and ordering | Each row showed only a relative time ("12m ago"). Each role built its own list: the manager sorted, the Sales Rep trusted the server's order, and the collector dropped the origin row when there were no coordinates. | Fixed in code: each row shows the clock time with the age ("2:10 PM · 12m ago"), via `formatCheckpointTime`. One shared builder, `utils/checkpointTimeline.js`, sorts the checkpoints and adds the origin row for all three roles. Only the origin label stays role-specific ("Picked up by Collector" / "Trip Started"). Device check pending. |
| 52 | Oct 5 | Collector, Manager | Delivery map: legend and Cancel overlap; legend and overlays differed between roles | Cancel sat over the map's zoom control. Legend and glass styles were copied per screen, so they drifted apart. | Fixed in code: shared `MapLegend` component and `styles/glass.js` (`glassPanel`). Collector and Manager use both. Cancel moved to the top left, under the legend. Device check pending. |
| 53 | Oct 5 | Collector | "Go to Next Stop" / "Finish Delivery" button too large | Button was full height, bigger than the manager's action buttons. | Fixed in code: 48px height, 15px text. Device check pending. |
| 54 | Oct 5 | Collector, Manager, Sales Rep | Cancel Delivery dialog bulky | Large icon and title, full-height buttons. | Fixed in code: smaller icon badge, title, 44px buttons, shorter dialog. This is the shared `ConfirmationDialog`, so every confirm dialog uses it. Device check pending. |
| 55 | Oct 5 | Collector, Manager | Delivery bottom sheet: not glass; collapsed sheet too tall (gap above "Go to Next Stop") | White sheet, fixed 150px collapsed height on the collector screen. | Fixed in code: glass sheet on both screens (`COLORS.glassSurface` + border). Collector collapsed height 150px → 112px. Device check pending. |
| 56 | Oct 5 | Manager | Delivery map: Sales Rep and Collector shown as plain dots/pins, no photo or role icon | `StaticRouteMap` only drew dots. | Fixed in code: optional `lastCheckpointAvatar` and `destinationAvatar` props draw the person's profile photo (or initials) in a role-coloured ring, with a map-pin badge. Manager detail passes the Collector and Sales Rep photos from the roster. Device check pending. |
| 57 | Oct 5 | Collector | Collector's map: own marker had no photo; Sales Rep marker has no photo | Collector screen didn't pass its photo. Sales Rep photos aren't in the collector's delivery data. | Done: the collector's own marker uses its photo and initials. Superseded by row 67 (done). |
| 58 | Oct 5 | All delivery POVs | "Online" label always green; no offline state | Header hard-coded "Online" on every screen. | Fixed in code: connection status is tracked from the Supabase requests the app already makes (`services/connectionStatus.js`, wired in `supabaseClient.js`). Green dot and "Online" when reachable; red dot and "Offline · last online 2:10 PM" when not. Updates only on change. Device check pending. |
| 59 | Oct 5 | All delivery POVs | Zoom buttons collided with the "In Transit" pill; status pill and legend overlapped | Leaflet's zoom buttons sat top right under the status pill. | Fixed in code: Leaflet zoom off. A glass zoom column (`MapZoomControls`) drives the map through `StaticRouteMap`'s ref. Status pill moved under the legend, on the left. Device check pending. |
| 60 | Oct 5 | All delivery POVs | Detail header and bottom sheet not glass enough; "Hide Details" sat on the content with no gap | Header and sheet were white or too transparent; no spacing under the toggle. | Fixed in code: header is glass (`SubScreenSecondaryHeader glass`), sheets use `COLORS.glassStrong` (92%), and the toggle row has spacing below it. The sheet is not blurred: true blur needs `expo-blur`, which isn't installed. Device check pending. |
| 61 | Oct 5 | All delivery POVs | Map legend copied per screen, Sales Rep legend used the wrong labels | Each screen had its own legend styles. | Fixed in code: all three use `MapLegend`, and the old legend styles were removed. Device check pending. |
| 62 | Oct 5 | All delivery POVs | Online/offline status not visible on the map | Status only showed in the header. | Fixed in code: a glass `ConnectionPill` (green Online, or red Offline with last online time) sits over the map under the legend on all three delivery screens. Device check pending. |
| 63 | Oct 5 | Manager, Sales Rep | "In Transit" pill on the map; sheet sections unevenly spaced | Status pill sat over the map; sheet had ad hoc margins. | Fixed in code: status pill is a shared `DeliveryStatusPill` beside "Recipients" / "Delivered By", in orange with a continuous pulse for In Transit. Sheet sections use one `gap`. Device check pending. |
| 64 | Oct 6 | Manager | Person status on the delivery map (Collector and Sales Rep): online or last online | No record of when people were last active. | Built in code: each app records its last active time (throttled to every 2 min) through `touch_presence`. The manager's map reads it with `get_presence`. Online if seen in the last 3 min, otherwise "Last online 2h ago". Each person's marker has a green or red dot, and the status line is under their name. Shows "Status unknown" until the SQL is run. **Needs `capstone_docs/sql/2026-10-06_presence_last_seen.sql` run in Supabase.** Device check pending. |
| 65 | Oct 6 | Sales Rep, Collector | Person status not yet on the Sales Rep and Collector maps | Their delivery data has no collector ID, and the collector's stop markers aren't wired. | Superseded by row 67 (done). |
| 66 | Oct 5 | Manager, Sales Rep, Collector | Route line between people was faint | Opacity 55%, thin dots. | Fixed in code: solid blue route line, 5px wide, with a bolder dash pattern. Device check pending. |
| 67 | Oct 6 | Sales Rep, Collector | Map: the other person on the delivery had no photo or online status | Their delivery data has no collector or Sales Rep ID or photo. | Built in code: `get_delivery_parties` (`capstone_docs/sql/2026-10-06b_delivery_parties.sql`, **run it in Supabase**) returns both people with photo path and last-seen time, only to the two people on that delivery. Sales Rep map shows the collector's photo and status. Collector map shows each stop's Sales Rep as a photo marker. Device check pending. |
| 68 | Oct 6 | Sales Rep, Collector | Map layout: distance pill overlapped Cancel; labels cut at the edge | Fixed in code: distance pill moved below Cancel; map fit has wider side padding. Device check pending. |
| 69 | Oct 6 | All | Confirm dialogs (Cancel Delivery, Log Out) clipped the second button and sat on the screen edge | Fixed height (250px) too short; no bottom safe-area padding. | Fixed in code: `ConfirmationDialog` sizes to its content, and `Modal` adds bottom padding for the phone's navigation bar. Device check pending. |
| 70 | Oct 6 | All delivery POVs | Route line was a thick solid-looking blue dash | One blue dashed line. | Fixed in code: thinner dashes (2px), each with an arrowhead pointing along the route. Colour blends from the collector's orange to the Sales Rep's red along the route. Device check pending. |
| 71 | Oct 6 | Collector, Sales Rep | Route arrows drawn over the people's photo markers | Arrowheads sat above the markers. | Fixed in code: arrowheads sit below all markers (`zIndexOffset`). Device check pending. |
| 72 | Oct 6 | Collector | Sales Rep photo missing on the trip review "Recipients" card | Trip data has no photo; the card read an empty field. | Fixed in code: each leg's Sales Rep photo comes from `get_delivery_parties`. Device check pending. |
| 73 | Oct 6 | Sales Rep | Sales Rep's own marker plain red, no photo | Only the collector had a photo marker. | Fixed in code: the Sales Rep's own marker uses their photo and initials. Device check pending. |
| 74 | Oct 6 | Collector | "In Transit" pill missing in the details sheet | Only the Manager and Sales Rep sheets had it. | Fixed in code: pill beside "Current Location" on the collector's map sheet. Device check pending. |
| 75 | Oct 6 | Collector | Track Delivery / Cancel Delivery buttons side by side and too large | Full-height buttons in a row. | Fixed in code: stacked full-width rows, 44px high, 15px text. Device check pending. |
| 34 | Oct 5 | Manager | Generate QR Code: Shipment Proof section | Redundant, since the handover photo is already taken on the previous screen. | Removed from `ReceiveStockPreviewScreen.js`. The Photo Proof photo can still be retaken from its viewer. Device check pending. |

---

## 2. 🟨 PRIORITY — Print option every time a QR is generated

**Goal:** wherever the app currently shows a QR code with "Save to Gallery," add a "Print" action next to it.

**Current status:** Print is wired into the shared QR component and works on device (QR shows in the print preview). Oct 3 fixes: the printed image was blank because the raw base64 string was used as an image source (now a proper data URI); the printed sheet and the on-screen card were redesigned for clearer hierarchy; the Batch Registered success screen was made scrollable so Share and Done are reachable. Still needs a full pass on all 4 screens (see test steps in chat).

**Grounded in current code** — every QR display in the app already goes through one shared component, `src/components/common/SaveableQRCode.js`. It's used in exactly these 4 places, no others:
- `src/screens/manager/ReceiveStockPreviewScreen.js` — Manager, after receiving a shipment
- `src/screens/manager/ReleaseStockConfirmScreen.js` — Manager, after releasing stock
- `src/screens/manager/StockLogsScreen.js` — Manager, viewing a past receiving QR in the log detail sheet
- `src/screens/salesrep/SalesRepLogsScreen.js` — Sales Rep, viewing a past QR in log detail

Collector currently only **scans** QR codes (`QRScannerModal.js`) and never generates/displays one — so no Collector-side work is expected for this item unless that changes later.

**Because it's one shared component, this is a single well-scoped change, not four separate ones.**

### Frontend
- [x] Add a "Print" button to `SaveableQRCode.js` next to the existing "Save to Gallery" button
- [x] Use `expo-print` — build a printable HTML layout (QR image + code text) and call `Print.printAsync()`
- [x] Fall back to `expo-sharing` if `Print.printAsync()` isn't available on a device
- [x] Fix blank printed QR (raw base64 used as `<img src>`) — Oct 3
- [x] Redesign printed sheet hierarchy and on-screen card layout — Oct 3
- [x] Make the Batch Registered success screen scrollable so Share/Done are reachable — Oct 3
- [ ] Manually verify on all 4 screens above (smoke test, since they share one component)

### Backend / Server / Database
- [x] None needed — this only prints data that's already been fetched to the screen. No new tables, RPCs, or storage.

---

## 3. Stocks Photo

**Decision:** option (A) — static bundled photos — was chosen and implemented on Oct 2 (19 product photos in `assets/product_images/`, wired into `productCatalog.js`). Option (B) (manager-uploadable photos with a `products` table) is deferred.

### Frontend (all 3 POVs where the catalog/photos surface)
- [x] Manager — `ProductBrowserScreen.js` / `ManagerStockScreen.js` / `StockBatchCard.js`: photo per product
- [x] Sales Rep — `SalesRepStockScreen.js`: photo per product
- [x] Collector — `CollectorDeliveryDetailScreen.js`, `CollectorTripReviewScreen.js`, `CollectorDeliveredStockScreen.js`: photo per product
- [x] Fallback UI for products with no photo yet (box icon)
- [ ] Device check on the Collector screens and the final 19-product catalog

### Open data question
- [ ] Confirm whether any branch has live stock recorded under the removed codes (HPDL, RSCS, BSCS, GSP, PCB). Those rows still display because they come from the database, not the catalog.

### Backend / Database — only if option (B) is chosen later
- [ ] New `products` table (code, name, image storage path) or a lighter `product_photos` lookup table
- [ ] New Supabase Storage bucket (e.g. `product-media`), manager-write / branch-read policies
- [ ] RLS: decide if photos are branch-scoped or global (global makes more sense here)

---

## 4. ✅ Fill the FAQ and Laws screen

**Current status:** Implemented and validated in the shared settings flow. FAQ and Laws are available to Manager, Sales Representative, and Collector users. Content remains app-managed static content so it can be reviewed and revised by the team without database changes.

### Content (needs the team, not code)
- [x] Add role-specific FAQ content for Manager, Sales Representative, and Collector workflows
- [x] Add Data Privacy Notice and Terms of Use content
- [x] Add operational guidance for location data, transaction proof, delivery proof, and accountability
- [ ] Team/PM review and approve the final FAQ and legal wording

### Frontend
- [x] Build the shared `src/screens/common/LegalInfoScreen.js` for FAQ and Laws content
- [x] Wire all three Settings screens to the shared detail screen
- [x] Add an FAQ row to Manager, Sales Representative, and Collector Settings
- [x] Add Laws/legal rows to Manager, Sales Representative, and Collector Settings
- [x] Hide the bottom navigation on the detail screen and add scroll-safe bottom spacing
- [x] Add expandable FAQ cards, role context, section icons, and additional Laws sections

### Backend / Database
- [x] No backend or database changes required
- [x] Android Expo bundle validation completed successfully

---

## 5. ⬜ After midterm — Branch management review (admin-cli)

**Status:** not started. Review after midterm; do not change before then.

**Why:** duplicate branches were created during rapid testing (e.g. "CDO" and "Cagayan de Oro Branch" are the same branch). Branch creation in `admin-cli` lacks checks.

### Findings (from code review, Oct 4)
- [ ] Typos and name variations create new branches (exact, case-insensitive match only)
- [ ] No database unique constraint on branch name; create is not atomic, so simultaneous keys can duplicate a branch
- [ ] Web form does not show existing branches or warn about near-matches
- [ ] Duplicate names in the same form are not flagged
- [ ] Inactive branches (`is_active`) are still matched and assignable
- [ ] Name is put into `ilike` unescaped (`%` / `_` act as wildcards)
- [ ] Location text is saved into the `city` column
- [ ] No branch list, rename, deactivate, or merge in the admin tools

### CDO duplicate clean-up (needs PM approval)
- [ ] Confirm METRO is a separate branch from IPONAN BRANCH
- [ ] Merge "Cagayan de Oro Branch" and "CDO" into one branch, renamed "Cagayan de Oro City"
- [ ] Re-point `branch_inventory`, `receiving_batches`, `stock_requests`, `transactions`, `daily_reports`, `delivery_trips`, and the `branch_ids` arrays on `user_profiles` and `activation_keys`
- [ ] Back up first; run in one transaction; then remove the old branch

### Suggested fixes (in order)
1. Pick existing branches from a list in the key form instead of typing names
2. Normalise names before matching; warn on near-matches
3. Add a unique constraint on branch name; make the create atomic
4. Reject duplicate names within one form; ignore inactive branches
5. Add a branch list page with rename and deactivate

---

*Living document — update status symbols and add specifics as work starts. Keep this in `capstone_docs/MD Folder/` alongside the sprint roadmap and session handoff notes so any team member (or Claude, in a future session) has full context without re-explaining.*

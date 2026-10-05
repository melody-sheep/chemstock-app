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

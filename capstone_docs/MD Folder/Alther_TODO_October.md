# ChemStock — Alther TODO (October 2026)

Team: Alther Adrian Liga • Maria Angela U. Mantiza • Clint John Mila • Jay Fahad P. Sultan • Gio Niel P. Yecyec
Prepared: September 12, 2026 · Updated: October 3, 2026 — living checklist, check items off as they land and update the notes if scope changes.

Source: raw feature list from the team (Jay), broken down into actionable frontend/backend/database tasks per POV (Manager / Sales Rep / Collector).

**Status legend** (same as `ChemStock_Sprint_Roadmap.md`)

| Symbol | Meaning |
|---|---|
| ✅ | Done |
| 🟨 | In Progress |
| 🔴 | Blocked / needs a team decision first |
| ⬜ | Not Started |

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

### 1.1 Manager (priority now)

**Dashboard & navigation**
- [ ] `ManagerDashboardScreen.js` — Total Items, Recent Logs, Request tile, FAB QR scanner, profile icon
- [ ] Bottom nav: tab highlight is correct after going back to Dashboard (fixed Aug 26, re-verify)

**Stock**
- [ ] `ManagerStockScreen.js` — Healthy / Almost Out / Out of Stock buckets, search, near-expiry filter
- [ ] `ProductBrowserScreen.js` — catalog photos, out-of-stock dimming
- [ ] `StockLogsScreen.js` — date filters, detail sheet, QR print/save, shipment photo loads

**Receive stock**
- [ ] `ReceiveStockScreen.js` / `AddNewBatchesScreen.js` — check whether items added in Add New Batches flow back into Receive Stock's scanned/queued list (noted as not connected in earlier logs)
- [ ] `ReceiveStockPreviewScreen.js` — GPS gating, scroll-to-review gate, success screen (scroll fixed Oct 3)

**Release stock**
- [ ] `ReleaseStockMethodScreen`, `ReleaseStockRecipientScreen`, `ReleaseStockScanReviewScreen`, `ReleaseStockDeliveryScreen`, `ReleaseStockConfirmScreen` — step indicator spacing, recipient photos, success QR
- [ ] `ReleaseStockRequestReviewScreen.js` — flow started from a Sales Rep request

**Returns, alerts, reports**
- [ ] `ManageReturnsScreen.js` / `ReturnStockVerifyScreen.js` — accept / reject, rejected request can be resubmitted
- [ ] `ManagerAlertsScreen.js` — sort control, discrepancy resolution
- [ ] `ManagerReportsScreen.js` — weekly / monthly Print, PDF, Share-to-Chat on a real device (never tested live)

**Accounts & delivery tracking**
- [ ] `ManageAccountsScreen.js` — role filter, avatars, Remove Account confirmation
- [ ] `AgentStockRequestScreen.js` — request queue, Decline / Prepare
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

*Living document — update status symbols and add specifics as work starts. Keep this in `capstone_docs/MD Folder/` alongside the sprint roadmap and session handoff notes so any team member (or Claude, in a future session) has full context without re-explaining.*

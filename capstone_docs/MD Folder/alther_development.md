# Alther — Development Log

Manager Dashboard UI build session — August 14, 2026.

---

## What was created

### New screens
- `src/screens/manager/ManagerDashboardScreen.js` — first real Manager Dashboard screen (previously an empty folder). Includes:
  - Navy `Header` with profile icon, title, document + notification icons
  - `SecondaryHeader` welcome block ("Welcome, {name}!") + status row (Online indicator, branch name with location pin)
  - Quick Stats row (Total Items, Pending Request)
  - Main Operation grid (Receive Stock, Release Stock, Manage Returns, Alerts/Discrepancies, Track Deliveries, Agent Accounts)
  - Recent Logs list
  - Bottom nav bar with floating action button
  - Collapsing `SecondaryHeader` on scroll (hides scrolling down, reappears scrolling up, always shown at the very top)
- `src/screens/manager/AgentAccountsScreen.js` — placeholder screen wired up from the "Agent Accounts" tile (empty for now, just the header)

### New reusable components (`src/components/common/`)
- `SecondaryHeader.js` — full-width info bar below the main Header; supports an optional right-side illustration image slot (not wired to an asset yet)
- `StatCard.js` — quick-stat tile (duotone icon, value, label, left accent stroke)
- `ActionCard.js` — menu grid tile (duotone icon + title)
- `LogListItem.js` — activity log row (circular duotone icon badge + text)
- `BottomNavBar.js` — fixed 4-tab bar (Dashboard/Stock/Reports/Settings) split into two groups with a floating center FAB in the gap between them

### Updated
- `Header.js` — added `showProfileIcon`, `showDocumentIcon`, `showNotificationIcon`, configurable `paddingHorizontal` (existing screens unaffected — all new props default off)
- `Icon.js` — added real Phosphor icons (`profile`, `document`, `notification`, `location`, `package`, `person`, `trayDown`, `trayUp`, `checkCircle`, `returns`, `warning`, `navigation`, `users`, `home`, `bookmark`, `settings`, `grid`), each verified against the installed package source rather than guessed. Added `duotoneColor`/`duotoneOpacity` pass-through so two-tone icons can use independent fill/stroke colors.
- `colors.js` — added an accent palette (`accentGold`, `accentPink`, `accentPurple`, `accentOrange`, `accentBlue`) reused from the existing LoginScreen animation colors
- `authService.js` — `login()` / `getCurrentUser()` now also look up branch name(s) from the `branches` table via the profile's `branch_ids`
- `AppNavigator.js` — registered `ManagerDashboard` and `AgentAccounts` routes
- `project_structure(DONT_DELETE).txt` — synced to the actual file tree

---

## Known gaps / things done from memory, not from the real spec

This UI was built from a screenshot description and general dashboard conventions, **not** the actual Figma file or the proposal PDF (couldn't be opened this session — no PDF renderer available in this environment). So:

- Icon choices (Phosphor `TrayArrowDown`, `NavigationArrow`, `ArrowsClockwise`, etc.) are reasonable guesses, not confirmed against the actual Figma icon set
- Exact colors for Quick Stats / Main Operation badges are approximations
- The Quick Stats/Recent Logs data (`1,240`, `3`, the two log entries) is hardcoded placeholder data, not wired to real Supabase queries yet
- No illustration asset in `SecondaryHeader` yet (slot exists, image not supplied)
- Only "Agent Accounts" navigates anywhere — the other 5 Main Operation tiles have no screens yet

## Next goal

Revisit the dashboard UI against the **actual Figma designs** — icon set, exact colors/spacing, and any layout details this session guessed at — instead of the approximated version built here.

---

# Session — August 16, 2026

Receive Stock flow (two screens), a batch of shared-component reuse fixes, and a Login screen polish pass that turned up a real app-wide bug.

---

## What was created

### New screens (`src/screens/manager/`)
- `ReceiveStockScreen.js` — Shipment Identification flow off the dashboard's "Receive Stock" tile: dotted-border tap-to-scan QR zone, "No QR on Product?" fallback into a Generate New Batch button, a Scanned/Queued Items list (dashed empty state), and a Confirm & Register action that opens a `ConfirmationDialog` instead of sitting as a permanent on-page warning banner.
- `AddNewBatchesScreen.js` — reached from "Generate New Batch": product search/select, removable product chips, a qty-stepper item list, a photo-proof row (stubbed — needs `expo-camera`), and a computed items/units summary. Product data (`MOCK_PRODUCTS`) is hardcoded — no `products` table exists yet.

### New reusable components (`src/components/common/`)
- `SyncStatusBadge.js` — online/offline-sync dot + label, used in both new screens' headers; `offline` state reserved for Sprint 5's local SQLite sync.
- `SubScreenSecondaryHeader.js` — the title + `SyncStatusBadge` header row, extracted after it turned up byte-for-byte identical in both new screens.
- `ConfirmationDialog.js` — bottom-sheet "are you sure?" dialog (icon + title + description + Confirm/Cancel), built on the existing `Modal.js`.
- `src/styles/shadows.js` — `SHADOWS.card` / `SHADOWS.cardSoft` tokens, extracted after the same 6-property shadow recipe started drifting between `StatCard` and `ActionCard`.

### Updated
- `Button.js` — new `outline` variant, `icon`/`iconPosition`/`iconWeight`/`iconSize` props. Also fixed its own default `width` (was a stray `screenWidth - 40`; every screen using it was already overriding that wrong value anyway — now correctly `screenWidth - SPACING.lg * 2`).
- `WarningSection.js` — new `variant="banner"` (bordered/tinted/inline) and an `icon` override, alongside the original `centered` style.
- `Header.js` — baked in `zIndex: 20`/`elevation: 20` so it always paints above a collapsing `SecondaryHeader`; fixed a hardcoded `marginLeft: 25` title gap down to `SPACING.sm`.
- `SecondaryHeader.js` — bottom-only 0.5px hairline border (was accidentally all sides); now exports `SUBSCREEN_HEADER_HEIGHT`.
- `Icon.js` — added `qrCode`, `plus`, `lock`, `calendar`, `camera`, `minus`, `xCircle`, `caretDown`, each verified against the installed `phosphor-react-native` source before adding, not guessed.
- `Input.js` — added `icon="search"`.
- `StatCard.js` / `ActionCard.js` — larger icons, left-aligned icon+text grouping, shadows now pulled from `shadows.js`.
- `ManagerDashboardScreen.js` — fixed a real bug where the collapsing `SecondaryHeader` painted over the primary `Header` on scroll (the `Header.js` zIndex fix above); wired the `2nd_header_scan_img.png` illustration; Quick Stats/Main Operation spacing and shadow tuning.
- `AppNavigator.js` — registered `ReceiveStock` and `AddNewBatches`; the dashboard's "Receive Stock" tile navigates now instead of `screen: null`.

### Login screen (`LoginScreen.js`, `AnimatedTextDot.js`)
- Fixed real animation jank: the background color was animating with `useNativeDriver: false` (color interpolation can't be native-driven), competing with the character-typing `setInterval` on the same JS thread. Replaced with a two-layer opacity crossfade (native-driven). Also found — and ultimately removed — a `fadeAnim` value that was animated every cycle but never wired to any rendered style; a later attempt to actually use it as a text-dim effect read as flicker rather than polish, so text opacity is just constant now.
- **Found a real, previously-unknown app-wide bug**: `translucent` and `backgroundColor` props on `<StatusBar>` don't exist in the installed `expo-status-bar@57.0.1` — confirmed directly from `node_modules/expo-status-bar/build/types.d.ts`. They'd been silent no-ops in **7 files across the whole app** (Login, both ManagerActivation steps, ManagerDashboard, AgentAccounts, ReceiveStock, AddNewBatches) since before this session. Removed from all 7.
- Restyled "Access is restricted..." (was hardcoded `#FF0000`) into a soft tinted pill, and "Manager Activation" (previously the *same* red as the warning — semantically confusing) into a navy outlined pill with a key icon. Added a divider separating it into its own footer section from the core login controls.

---

## Known gaps / open items

- **Status bar background still doesn't visually match the animated background on the team's test device.** Root-caused as far as code can go: `expo-status-bar` has no background-color API left in this SDK, and testing is via **Expo Go**, a pre-built binary that can't pick up any native-level fix (the deprecated `androidStatusBar` app.json key needs a rebuild Expo Go can't do). Real fix needs a custom dev client (`eas build` or `npx expo run:android`) — a bigger workflow change, not made unilaterally this session. Worth revisiting alongside the Sprint 2 move to `expo-camera`, which will likely require a dev client anyway.
- `ReceiveStockScreen` and `AddNewBatchesScreen` aren't data-bridged — items added in "Add New Batches" don't flow back into Receive Stock's "Scanned or Queued Items," so that section and the Confirm button's real gating always show empty in this pass.
- `AddNewBatchesScreen`'s product catalog is 100% mock data — no `products` table exists in Supabase yet.
- Same no-Figma-access caveat as the Aug 14 entry applies to the Receive Stock UI too — built from mockups pasted in-chat, not the Figma file itself.

## Next goal

Wire the Receive Stock → Add New Batches loop to real Supabase data once a `products`/inventory table exists (Sprint 2 per the roadmap), and decide whether to prioritize the dev-client migration now (unblocks both QR scanning and the status bar polish) or defer it further.

---

# Session — August 24, 2026

Repo integration (merged the team's three branches into `main`), a Sprint 1 planning pass, and a long UI/UX overhaul across the Add New Batches → Preview & Confirm flow — new reusable components, several real bugs found and fixed along the way, and an app-wide skeleton-loading system started.

---

## Repo / planning

- Merged `origin/jay`, `origin/gio`, `origin/clint` into `main` via a throwaway `integration-test` branch (fast-forwarded cleanly — `gio` and `clint` turned out to already be fully contained in `jay`'s branch, so only one real merge happened). Pushed to `origin/main`; branch cleaned up after.
- Walked through a full Sprint 1 plan (`user_profiles`/`branches` schema, RLS policies, an `activate_manager()` RPC for atomicity, the username→email login-resolution gap, the manager→create-Sales-Rep/Collector privilege problem with client-side `signUp()`) — advisory only, not committed as code this session; written up for manual execution.

## What was created

### New reusable components (`src/components/common/`)
- `SpotlightHint.js` — dims the screen and cuts a highlighted hole around a *real* on-screen element via an SVG mask (`react-native-svg`, no new dependency), with a callout + "Got it" button. Built to replace an initial banner-style hint that added a new UI element instead of pointing at the existing one.
- `QuantityStepper.js` — minus/plus buttons framing an editable quantity `TextInput` in one bordered pill, so a count can be typed directly instead of only stepped one at a time.
- `ShipmentProofRow.js` — the "take/retake photo" action row (full-height camera panel, duotone status icon, label, optional "view" button), extracted out of `AddNewBatchesScreen` so `ReceiveStockPreviewScreen` could reuse it identically for retaking before final submit.
- `SkeletonBlock.js` — pulsing placeholder rectangle (RN `Animated` API, no gradient library needed), the primitive behind every skeleton shape.
- `SkeletonCard.js` — exports `SkeletonCard` (thumbnail + lines, matching the shape most list/card screens already use) and `SkeletonList` (a few stacked in one call).
- `LoadingSpinner.js` (`src/components/ui/`) — this file existed but was **completely empty (0 bytes)** since before this session; written for real now (centered `ActivityIndicator`, `fill` prop for section vs. full-screen use).

### New hooks (`src/hooks/`)
- `useFirstTimeHint.js` — tracks whether a named onboarding tip has been dismissed on-device (AsyncStorage via the existing `storage.js` wrapper, same pattern as `productUsage.js`), so a tip shows once ever, not on every visit. Pairs with `SpotlightHint`.

### Icon.js additions
- `trashSimple` (Phosphor `TrashSimple`) and `expand` (Phosphor `ArrowsOut`) — both verified against the installed package source before adding, continuing the standing rule for this file.

### formatters.js additions
- `formatCoordinates()` — "14.5995°N, 120.9842°E" style, hemisphere letters derived from the actual coordinate sign rather than hardcoded (stays correct outside the Philippines too).
- `formatDateTime()` — "May 20, 2024 | 02:30 PM" style, replacing ad hoc `.toLocaleString()` calls.

### Rebuilt: `ReceiveStockPreviewScreen.js`
Registered Items now uses the real, editable `RegisteredItemsList` (qty stepper, Mfg/Exp date pickers, remove) instead of a dumb read-only list, so a mistake can be fixed on this screen instead of forcing a trip back. Added a "Photo Proof" card (real captured photo, tap-to-zoom via `CameraCaptureModal`'s existing viewer, "From Factory to {manager's real name}", GPS/Branch/Device/Date rows) built to match a UI spec screenshot the team provided. Clarified with the team first that this is the *pre-submit* screen (batch numbers, per-item camera/download icons, and "Go Back to Dashboard" in the mockup all only make sense post-submission) before building it — kept the real "Receive and Generate QR" action and dropped the icons that had no real pre-submit meaning.

## What was fixed / changed

### `AddNewBatchesScreen.js` + `RegisteredItemsList.js` (multi-pass redesign)
- Item card layout rebuilt to spec: 92×120 image frame, Name → Qty → Mfg → Exp info stack, delete pinned top-right, quantity stepper pinned bottom-right.
- Mfg/Exp date logic (`useItemDatePicker.js`): the calendar itself now constrains selectable dates (`minimumDate`/`maximumDate`) so Exp literally can't be picked before Mfg, in either entry order — enforced at the UI, not just validated after the fact.
- **Added a real gate that didn't exist before**: both "Save to Preview" and "Receive and Generate QR" now block (alert + disabled button) if any item is missing a Mfg or Exp date.
- **Real bug found and fixed**: the image frame's height didn't match its row because `itemRow` had its own padding *on top of* a hardcoded child height — padding pushes a flex row taller regardless of a fixed-height child, so the row was silently ~32px taller than the image. Fixed by moving padding onto the text content instead of the row.
- **Real bug found and fixed**: an earlier attempt at "auto-matching" height used `alignSelf: 'stretch'` with a percentage-sized placeholder `Image` inside — percentage dimensions inside a flex-stretch-only parent is a known React Native/Yoga trouble spot and caused the card to blow up to fill the screen. Reverted to explicit fixed pixel values.
- Card borders iterated per feedback down to bottom-only + a 2px gap between cards; image frame roundness set to 0 (square) at final request; the placeholder "box" icon (shown on every card today — no catalog product has a real photo yet) now renders small and centered instead of stretched edge-to-edge across the frame.
- `ShipmentProofRow` swapped in in place of ~50 lines of now-duplicated inline JSX/styles (see component list above).

### `ProductChip.js` ("Selected Products" chips)
- Removed the tinted thumbnail background (`item.tint` placeholder colors, same root cause as the `StockBatchCard` fix below) — plain white frame with a neutral outline instead.
- Frame settled at a fixed 92×80 with a small (8px) radius after a round-trip through fully square corners; user feedback was every other surface in the app is rounded, so a totally square chip read as inconsistent.
- The order-number tag and remove control both sit flush in their respective top corners (no inset gap), matching corner rounding only on their own outer corner.
- **Real bug found and fixed**: an earlier edit left two `chipRemove` keys in the same `StyleSheet.create()` object — the second silently won regardless of what the JSX intended, so the remove control kept rendering as a full-height rail after the JSX had already been changed back to a corner tag. `tint` prop removed entirely from the component (dead after the background removal).

### `CameraCaptureModal.js`
Split the camera-permission request out of the full-screen black camera view into the existing bottom-sheet `Modal.js` — asking for a permission doesn't need to take over the whole screen the way the live camera does.

### `LoginScreen.js`
Removed the always-visible "Access is restricted..." banner; it now only appears in a confirmation modal (reusing `Modal.js` + `WarningSection.js`) when "Manager Activation" is tapped, saving permanent screen space for something only relevant at that moment. Also found the divider and "Manager Activation" button were both using `COLORS.border` (a pale blue) as an outline — replaced with the app's standard neutral gray divider and a borderless filled pill.

### `StockBatchCard.js` / `ProductBrowserScreen.js`
- Removed tinted thumbnail backgrounds (`thumbTint` prop dropped entirely).
- **Real bug found and fixed**: the product icon only ever rendered on `wireframe={false}` cards — meaning the "All Products" grid (which is always `wireframe`) has never shown an icon at all. Now unconditional.
- Removed the "Out of Stock" text badge (icon + dimming alone now signal it).
- Cleaned up an `outOfStockBadge`/`outOfStockBadgeText` style pair that was defined but never actually referenced anywhere in the render — pre-existing dead code, unrelated to this pass, removed while in the file.
- Since `StockBatchCard` is shared, this fixes both `ProductBrowserScreen`'s two sections *and* `ManagerStockScreen`'s in-stock/out-of-stock rows in one place.

### `Button.js`
Default `hasShadow` flipped `true → false`, default `height` reduced `56 → 48`, applied app-wide except `LoginScreen.js` — checked first that it's the only screen explicitly overriding both props, so the shared-default change can't silently touch it.

### `StatCard.js` / `ActionCard.js`
Removed their shadow (`SHADOWS.card` / `SHADOWS.cardSoft`) at the component level, so it's fixed everywhere they're used (all three dashboards' Quick Stats and Main Operation grids) rather than per-screen. `LogListItem.js` already had no shadow — nothing to change there.

### Skeleton loading rolled out to
- `ManagerDashboardScreen.js`, `SalesRepDashboardScreen.js` — **neither had any loading state at all** before this; both could flash "—" / an empty-state message before real data arrived. Added `isLoading`, skeletons for Quick Stats, Recent Logs, and the welcome-name/branch header text.
- `CollectorDashboardScreen.js` — its Quick Stats and Recent Logs are still 100% hardcoded placeholders (no service backs them — Collector features aren't built yet per the roadmap), so skeletoning fake data there would've been dishonest UI. Scoped to just the one real async part: the welcome-name/branch fetch.
- `ManagerStockScreen.js` — already had `isLoading` wired up but showed a bare spinner; swapped for content-shaped skeleton card rows.

---

## Known gaps / open items

- Skeleton loading is proven out on 4 screens; a grep survey found **12 screens total** with a loading state (`ReceiveStockPreviewScreen`, `ProductBrowserScreen`, `SalesRepStockScreen`, `SalesRepLogsScreen`, `TrackDeliveriesScreen`, `StockLogsScreen`, `ReleaseStockScanReviewScreen`, `ReleaseStockRecipientScreen`, `ManageAccountsScreen` still on bare spinners or nothing).
- `ReceiveStockPreviewScreen`'s Photo Proof card only shows one photo — the UI spec screenshot showed "Photo 1 of 2" with pagination dots, but the actual capture flow only ever produces one photo. Didn't fabricate fake multi-photo pagination against real single-photo data.
- `SpotlightHint` measures its target's on-screen position once (on layout); if the manager scrolls before dismissing it, the highlighted hole won't follow — acceptable for now since it appears right as the target comes into view, but worth a scroll-aware re-measure if it becomes noticeable.
- Investigated a reported "device metadata isn't obtaining exact details" issue — `authService`/`inventoryService` were already pulling real data from Supabase/`expo-device`/`expo-location`, not mocked. Improved the *display formatting* (GPS hemisphere letters, date format, device label simplified to just the model name) since that's what was concretely fixable without a reproducible runtime symptom to chase further.
- Sprint 1's actual schema/RLS/RPC work (the planning pass above) is still not applied to Supabase — remains manual follow-up.

## Next goal

Extend the skeleton-loading pattern to the remaining ~11 screens (mechanical repeat of the same `SkeletonBlock`/`SkeletonList` swap now that it's proven out), then pick up Sprint 1's actual database work (`branches`/`user_profiles`, RLS, the `activate_manager()` RPC) since that's still the single biggest blocker per the sprint roadmap.

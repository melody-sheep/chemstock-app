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

---

# Session — August 26, 2026

A full redesign of the "Batch Registered" QR success screen, a proper `fill`/`accentColor` extension to `Button.js`, Settings screens built out for all three roles, and a real (not cosmetic) bottom-nav bug found and fixed across 7 screens.

---

## What was created

### "Batch Registered" success screen (`ReceiveStockPreviewScreen.js`)
Full redesign of the post-registration success state — was a bare checkmark + QR + one "Done" button floating in a centered `ScrollView`. Now: the existing `successCircle` duotone icon (soft green halo + checkmark, zero new assets) instead of a plain icon; a "receipt" card (Branch, Items/units, real registration timestamp — captured fresh at the moment of success, not reused from the earlier photo-capture time); a working `Share` button (native `Share.share()`, no new dependency) alongside `Done`; converted from a scrollable, vertically-centered layout to a fixed top-anchored one sized to fit without scrolling on one screen.

### `Button.js` — real `fill` variant + `accentColor` prop
Requested colors for one-off buttons (Share, Save to Gallery) kept coming out navy/blue because `outline`'s border/text/icon color was hardcoded to `COLORS.primary` with no override. Rather than patch it with `style`/`textStyle` overrides (which can't reach the icon — that's fed by an internal JS variable, not a style prop), added a real `accentColor` prop that `outline` and the new `fill` variant (solid-color background, white text/icon) both read consistently. Backward compatible — every existing `outline`/`black`/`primary` usage elsewhere is untouched since `accentColor` defaults to `null`.

### `SaveableQRCode.js` polish
QR code now sits in its own inset bordered panel instead of floating on the card background; the raw code string is a pill badge instead of plain text; "Save to Gallery" is now a solid green `fill` button (`accentColor={COLORS.success}`) with a `trayDown` icon, and the card stretches full-width (`alignSelf: 'stretch'`) so the button isn't stuck matching just the QR's narrow width.

### Settings screens — all three roles now consistent
- `ManagerSettingsScreen.js` (new) — profile card, Account (Edit Profile/Change Password stubs), Privacy & Permissions (GPS/Camera/Gallery/Notifications), About (Data Privacy/Terms/App Version), Log Out. Registered in `AppNavigator.js`, wired to the dashboard's Settings tab and (previously dead) profile icon.
- `SalesRepSettingsScreen.js` already existed from Jay's branch with the same structure — its profile icon was never actually wired to open it; fixed.
- `CollectorSettingsScreen.js` (new) — same structure, Collector-specific copy (delivery checkpoints instead of stock receiving/release). Registered, wired to both the Settings tab and profile icon — Collector had neither a settings screen nor a working profile icon before this.

All three share one static-design caveat: permission rows are local UI state (GPS switch, Camera/Gallery "Granted" pills), not live device permission reads yet — same as how `SalesRepSettingsScreen.js` was already built, kept consistent rather than making the new two more "real" than the original.

## What was fixed

### Bottom nav tab highlighting — real bug, not cosmetic
Reported symptom: navigating to Stock correctly highlighted it, but navigating back to Dashboard left the *previous* tab highlighted until something else forced a re-render. Root cause: `BottomNavBar`'s `activeTab` was driven by local `useState` on the dashboard/settings screens, mutated to the *destination* tab right before `navigation.navigate()` away — and since navigating back to an already-mounted screen doesn't remount it, that stale value just sat there. `ManagerStockScreen.js`, `SalesRepStockScreen.js`, `ManagerAlertsScreen.js`, and `ManageReturnsScreen.js` were already doing this correctly (a plain hardcoded `activeTab="stock"` string, no state — there's never a legitimate reason for a screen's own tab identity to be mutable). Removed the unnecessary `useState`/`setActiveTab` from the 7 screens that had it instead (`ManagerDashboardScreen`, `SalesRepDashboardScreen`, `CollectorDashboardScreen`, all three Settings screens, `SalesRepReportsScreen`) and matched the already-correct pattern everywhere.

### `RegisteredItemsList.js` — loop-safety guard added on request
Extended the `onLayout` → `measureInWindow` → `setSpotlightTarget` measurement (added last session for `SpotlightHint`) with an explicit no-op guard: the state updater now returns the exact same object reference when the new measurement matches the old one, which React treats as "no change" and skips the re-render — makes the settle-after-one-pass guarantee true by construction instead of relying on `onLayout` only firing on real frame changes.

### Bottom nav — floating FAB, real tap feedback, and a genuine performance pass
The FAB moved from a flat in-row slot back to floating above the bar, straddling the top border (half above/half below), matching the "before" look the team wanted. Tap feedback went through several iterations before landing right: `Pressable`'s native `android_ripple` turned out to be Android-only (silently renders nothing on iOS/web) and its timing/color aren't adjustable, which is why it wasn't visible and couldn't be slowed down to observe — replaced with a custom two-phase `Animated`-driven ripple (grows while held via `onPressIn`, fades on release via `onPressOut`), extracted into a reusable `src/hooks/useRippleAnimation.js` so the same effect isn't duplicated between the four tabs and the FAB. Along the way fixed a real bug where the ripple was faintly visible even at rest (opacity math mapped the idle value to 0.3 instead of 0) and another where the ripple could visually poke out above/below the bar (fixed by clipping the tabs row in `overflow: 'hidden'`, kept separate from the FAB so its intentional float isn't clipped too). `TabButton` wrapped in `React.memo` so switching tabs only re-renders the two tabs whose active state actually changed.

### Manager-side flow alignment — a real double-padding bug, not just polish
`Stepper.js` (the "Step X of X" indicator used across the Release Stock flow) had its own hardcoded horizontal padding baked in — harmless in `ManagerActivationScreen` where the hosting screen supplies zero padding of its own, but a real bug everywhere else: `ReleaseStockRecipientScreen` and its five sibling screens already wrap it in a ScrollView with its own padding, so the Stepper text was sitting doubled-up (~48px indent) while every sibling control sat at the screen's actual padding. Root cause fixed at the component level — `Stepper` no longer applies its own margin, the hosting screen always does — and while at it, standardized those six screens' content padding from `SPACING.lg` (24px) down to `SPACING.md` (16px) to match their own `Header`'s already-16px inset, which the Stepper flow had silently drifted from. Also gave the Sales Rep vs. Collector role cards in `ReleaseStockRecipientScreen` distinct icons (`person` vs. the existing `truck`) — they'd both been using the same generic `person` icon.

### New component: `BottomActionBar.js`
A screen's one major bottom action (Next / Confirm & Register / Receive and Generate QR) was previously either a bordered `View` sitting as a normal ScrollView sibling, or — on `ReceiveStockScreen`/`AddNewBatchesScreen`/`ReceiveStockPreviewScreen` — just the last item inside the ScrollView, meaning it only became reachable after scrolling all the way down. Built a reusable fixed, safe-area-aware bottom bar (same absolute-positioned, `useSafeAreaInsets` construction as `BottomNavBar`) with no border line, and rolled it out to the Release Stock flow (5 of its 6 screens — `ReleaseStockMethodScreen` has no bottom CTA to move) and the Receive Stock flow (all 3 screens). Each hosting screen now reserves the bar's exact height in its own ScrollView padding via the exported `useBottomActionBarHeight()` hook, so the bar can never cover the last scrollable item.

### `Button.js` — disabled/active colors fixed, height standardized
Two real color bugs, both app-wide since they live in the shared component: disabled buttons rendered `COLORS.primaryLight` (a pale lavender that read as a stray/broken background rather than "not ready yet") — now `COLORS.textSecondary` (gray), matching a pattern already used manually elsewhere in the app (`ManagerActivationScreen`'s own continue button). The `black` variant — the de-facto primary CTA color used in 21 files — rendered pure `#000000` instead of the app's actual navy; now renders `COLORS.primary`. Separately, button height was inconsistent (default 48 vs. three call sites explicitly overriding to 52, including two buttons stacked on the same screen at different heights) — raised the component default to 52 and deleted the now-redundant per-screen overrides, so the height lives in one place.

### Login button was never actually gated
`LoginScreen`'s Login button was only `disabled={isLoading}` — active and pressable with empty username/password fields the whole time, only ever graying out mid-request. Now also requires both fields to have content: `disabled={isLoading || !username.trim() || !password}`.

### `ReceiveStockPreviewScreen` — two real submission-gating bugs
"Receive and Generate QR" sat as the last ScrollView item (same reachability problem `BottomActionBar` fixed elsewhere) and could be pressed before GPS had actually resolved. The second one was a real backend crash, not cosmetic: `receiveStockBatch`'s RPC has a `NOT NULL` constraint on `gps_coordinates.latitude`, and pressing the button while `coords` was still `null` (location fetch still in flight) submitted `latitude: undefined`, surfacing as a raw Postgres `23502` error instead of a friendly message. Fixed by gating submission on `!coords` the same way the existing item/date/photo checks already work (inline `Alert` + a matching `disabled` condition), with the button's own label reflecting the wait ("Getting Your Location…" / "Location Unavailable"). Also added a genuine "must review everything first" gate — a new `src/hooks/useScrolledToEnd.js` (tracks scroll position; also handles the case where content is short enough that no scroll is even needed) blocks the button and relabels it "Scroll Down to Review" until the manager has actually reached the bottom of the screen.

### `CameraCaptureModal.js` — no more blue on a camera screen, plus live metadata
Retake/Use Photo were navy-on-navy after the `Button.js` color fix above made the situation worse (both `outline` and `black` now read blue-ish). Replaced with a faked glassmorphism look — translucent white + light border, no real blur library pulled in for one screen — Retake as a ghost pill, Use Photo as a solid frosted pill with dark text. Along the way caught a second real bug: `variant="outline"`'s icon/text color comes from `accentColor || COLORS.primary`, so without setting `accentColor` explicitly the new icons (`returns` for Retake, `checkmark` for Use Photo) would've rendered navy again regardless of the button's background. Also added a live metadata strip (timestamp, GPS, device model) shown only for a freshly-captured photo — not for re-viewing an already-saved one, since there's no historical metadata to show in that case — so the promise made elsewhere ("photo will include timestamp, GPS, and device info") is now actually visible at capture time.

### `RegisteredItemsList.js` — image sizing settled
Several rounds of height/roundness/margin iteration on the product image inside each item row. Landed on: no roundness (reverted after a brief detour through matching the card's own 12px radius), row height bumped 120→132, and — the one genuine bug in this pass — the image's left margin was 0px while its top/bottom margins were coming from implicit flex-centering, so they didn't actually match despite looking close. Fixed with explicit equal `marginLeft`/`marginTop`/`marginBottom` (all `SPACING.sm`) on the image wrapper instead of relying on centering alone, so all three sides are provably equal rather than coincidentally close.

### "Save to Gallery" — a real fix, not a workaround
Reported as "Failed to Save" with no further detail. Root cause: `expo-media-library`'s full gallery-write access has been blocked inside Expo Go since SDK 48 (a Google Play policy restriction Expo itself enforces — confirmed via the exact rejection message logged: *"Due to changes in Androids permission requirements, Expo Go can no longer provide full access to the media library"*), not a bug in this app's code. Rather than leave a dead-end error, added two fallbacks in order: (1) Android's Storage Access Framework — the user picks a real folder (e.g. "Pictures") via the native picker and the file is written straight into it, so it actually shows up in Gallery; not blocked in Expo Go since it's a different permission model than `MediaLibrary`'s broad photo/video access. (2) the native share sheet (`expo-sharing`, newly added dependency) as a last resort — but that only *sends* the file to whatever app is picked, it doesn't save a copy anywhere on its own, so the UI says exactly that upfront instead of implying it was saved.

### App-wide logging cleanup
A pasted device log showed the console dominated by a single line — `Icon.js` logging `"Rendering name=..."` on every render of every icon on screen (dozens per screen) — drowning out the actually-useful backend/service logs. Removed that one directly, found the identical pattern in `ActionCard.js`, `StatCard.js`, and `LogListItem.js` and removed those too. A second, much larger pass swept the rest of the codebase (26 files: every service, both auth hooks, and the remaining screens/components still using raw emoji `console.log` instead of the existing clean `debugLog`/`logError` utility) to strip emoji in favor of plain `[TAG]` text and cut real noise, not just cosmetic emoji. Worst offender: `useAuth.js` was logging the full auth state — **including the raw plaintext password** — on every single keystroke; deleted entirely along with matching per-render/per-call "Hook called" tracking logs, `useActivation.js`'s identical pattern, and ~40 similar lines in `ManagerActivationScreen.js` (per-keystroke field-length logs, animation/scroll choreography narration). `BaseService.handleError()` was also logging the same error six separate times immediately before calling `logError()`, which already captures all of it — cut to just the one call. **Found a related real bug while reviewing the sweep's results**: `authService.register()`'s failure path passed the entire raw `userData` object — plaintext password included — into `handleError()`, which logs its context verbatim; fixed to pass only `{ email, username }`.

---

## Known gaps / open items

- Permission rows across all three Settings screens are still static/local state, not real `expo-location`/`expo-camera`/`expo-media-library` permission queries — matches the "static design first" instruction this session, but will need wiring to actual permission APIs before these are trustworthy.
- Edit Profile, Change Password, Data Privacy Notice, and Terms of Use are all `handleComingSoon` stubs on every role's Settings screen — visible, tappable, but not built.
- Skeleton loading still only covers 4 of the ~15 screens with a loading state (unchanged across every session so far).
- `BottomActionBar` covers the Release Stock and Receive Stock flows but not literally every screen with a bottom CTA — `ManagerActivationScreen`'s bespoke bottom warning+button block and `ManageAccountsScreen` weren't converted, left as candidates for a future pass rather than guessed at without being asked.
- "Save to Gallery" still can't do a true one-tap direct-to-Photos save inside Expo Go — that specific capability needs a real dev client (`eas build` / `npx expo run:android`), same underlying constraint noted for the status bar back on Aug 16. The Storage Access Framework fallback is a real save, just one extra tap (picking the folder) versus the ideal.

## Next goal

Sprint 1's actual database work (`branches`/`user_profiles`, RLS, `activate_manager()` RPC) remains the single biggest carried-over blocker across every session log entry so far. Secondary candidates: extend `BottomActionBar` to the remaining bottom-CTA screens now that the pattern is proven; wire the Settings screens' permission rows to real device permission state; extend skeleton loading to the remaining screens.

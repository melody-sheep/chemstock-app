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

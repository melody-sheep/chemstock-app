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

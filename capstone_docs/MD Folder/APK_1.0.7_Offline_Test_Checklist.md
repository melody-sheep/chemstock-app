# ChemStock APK 1.0.7 — Test & Offline Screenshot Checklist

Build under test: **1.0.7 (versionCode 7)**, preview APK, built Oct 21, 2026 4:30 AM (commit `cbde1f5*`, i.e. with uncommitted UI work).
Tick each box as you go. Send screenshots in groups, one role at a time.

## How to take the offline screenshots
- Use **airplane mode** (Wi-Fi and mobile data both off), not just weak signal.
- Keep the **status bar visible** in every screenshot (time + airplane icon).
- Add a one-line caption: the step number and what you did.

---

## A. Fresh install, no saved data (do this first)
Install 1.0.7, open it with airplane mode ON, before logging in.

- [ ] A1. Login screen while offline — clear offline message, no crash
- [ ] A2. Try to log in offline as each role — friendly "needs internet" message, no blank screen or crash
- [ ] A3. Manager Activation Step 1: type a key, press the send arrow — needs-internet message, not a red error
- [ ] A4. Turn Wi-Fi on, then log in — dashboard loads, Online pill turns green

## B. Cached, short offline (minutes)
Log in online, open every tab once so it caches, then turn airplane mode ON and open each screen again.
One screenshot per screen, offline.

### Manager
- [ ] B1. Dashboard — Online pill reads "Offline · as of …"
- [ ] B2. Stock tab — chips, counts and cards still showing
- [ ] B3. Reports tab
- [ ] B4. Transaction Logs list, then one log detail
- [ ] B5. Notifications
- [ ] B6. Receive Stock — try to register a batch offline (what message?)
- [ ] B7. Release Stock — try to release offline (what message?)
- [ ] B8. Manage Accounts list

### Sales Rep
- [ ] B9. Dashboard
- [ ] B10. Stock tab and Backpack
- [ ] B11. Request Stock → add items → Request List → Send Request offline (expect "Saved — will send later" + Pending banner)
- [ ] B12. Submit Report offline (take photo, submit) — queued state
- [ ] B13. Receive Stock (scan/accept) offline — "Saved — will send later"; item shows in Backpack as "Received — waiting to send"
- [ ] B14. Return Stocks list and Alerts & Discrepancies
- [ ] B15. Track Deliveries and a delivery detail map (map tiles won't load offline; screen must not break)

### Collector
- [ ] B16. Dashboard (Needs attention, Active)
- [ ] B17. Accept Deliveries list (date chips, timestamps)
- [ ] B18. Delivery Details, then try Accept Stock offline — should say it needs internet
- [ ] B19. Trip Review and the map screen offline
- [ ] B20. Mark Delivered offline — queued state and "waiting for network" in Recent Logs
- [ ] B21. Delivered Stock list

## C. Reconnect and sync (the important part)
Right after each offline action in B, turn airplane mode OFF and wait ~30 seconds.

- [ ] C1. The Pending banner — does it clear?
- [ ] C2. The queued item becomes a normal one (Backpack row, Recent Log, report status)
- [ ] C3. Manager side: each item arrived **once**, not twice (Stock Requests, Reports, Delivered)
- [ ] C4. Anything you retried by hand — check for duplicates

## D. Long offline (hours / overnight)
Do this last. Airplane mode ON, leave the phone for several hours or overnight, keep the app's data.

- [ ] D1. Open the app cold (swipe it away first) — does it open or ask for login?
- [ ] D2. Dashboard and each tab — "Offline · as of …" time is honest, stale data is labelled
- [ ] D3. Make one queued action (a request or a report) after the long wait
- [ ] D4. Network back on — queue result (repeat C1–C3)
- [ ] D5. Session check — still logged in, or asked to log in again?

## E. Errors and edge cases
- [ ] E1. Any red error toast/screen — include the **Component Stack** lines
- [ ] E2. Manager activation with a **fresh key**: Step 1 → Continue → Step 2 → Complete Setup → welcome message (this screen logged a "Text strings must be rendered within a <Text> component" error in Expo Go; check it in the APK)
- [ ] E3. Back button after the Collector flow: Accept → Done → Back (should reach the dashboard in one press)
- [ ] E4. Collector: Accept → Start Trip → map → Back (should reach Accept Deliveries)
- [ ] E5. Admin tool: the key shown on the last step of Generate Key is the same key shown on the result page (restart admin tool + hard refresh first)

## For each problem, send
1. The screenshot
2. What you expected
3. Role, screen and network state (offline / online / just reconnected)
4. Time of the test (to match against logs)

Optional: connect to Metro / a dev build and copy the terminal log from each run.

## Known open items going into this test
- "Text strings must be rendered within a <Text>" warning on Manager Activation (source not found; app still works in Expo Go)
- Not redesigned: Collector map screen (Deliver Stock) beyond the bottom sheet, Login screen, Manager Team Map
- Not done: bottom-nav count badges, dashboard "Reports & Returns" tile icon
- Nothing from today is committed yet (commit to `alther` only after APK testing; do not commit `Alther_TODO_October.md` or `admin-cli/.env`)

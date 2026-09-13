# ChemStock — Next Features TODO

Team: Alther Adrian Liga • Maria Angela U. Mantiza • Clint John Mila • Jay Fahad P. Sultan • Gio Niel P. Yecyec
Prepared: September 12, 2026 — living checklist, check items off as they land and update the notes if scope changes.

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

1. � **PRIORITY** — Print option for every generated QR code (Manager-side print flow implemented; native print sheet/UI polish still being validated)
2. ⬜ Stocks Photo
3. ✅ Fill the FAQ and Laws screen
4. ⬜ UI improvements (general polish, ongoing)

---

## 1. � PRIORITY — Print option every time a QR is generated

**Goal:** wherever the app currently shows a QR code with "Save to Gallery," add a "Print" action next to it.

**Current status:** Manager-side native print flow is in place in the shared QR component; still validating printer behavior and app-style UX polish before calling it fully complete.

**Grounded in current code** — every QR display in the app already goes through one shared component, `src/components/common/SaveableQRCode.js`. It's used in exactly these 4 places, no others:
- `src/screens/manager/ReceiveStockPreviewScreen.js` — Manager, after receiving a shipment
- `src/screens/manager/ReleaseStockConfirmScreen.js` — Manager, after releasing stock
- `src/screens/manager/StockLogsScreen.js` — Manager, viewing a past receiving QR in the log detail sheet
- `src/screens/salesrep/SalesRepLogsScreen.js` — Sales Rep, viewing a past QR in log detail

Collector currently only **scans** QR codes (`QRScannerModal.js`) and never generates/displays one — so no Collector-side work is expected for this item unless that changes later.

**Because it's one shared component, this is a single well-scoped change, not four separate ones.**

### Frontend
- [ ] Add a "Print" button to `SaveableQRCode.js` next to the existing "Save to Gallery" button
- [ ] Use `expo-print` — already a dependency, already used for the exact same kind of job in `src/screens/manager/ManagerReportsScreen.js` (weekly/monthly report PDF export) — build a small printable HTML layout (QR image + code text, maybe batch/shipment context passed in as a prop) and call `Print.printAsync()`
- [ ] Fall back to `expo-sharing` (already imported in this component) if `Print.printAsync()` isn't available on a device — same fallback philosophy the component already uses for gallery-save
- [ ] Manually verify on all 4 screens above once the component change lands — since they all share the component, this is a smoke test, not 4 separate builds

### Backend / Server / Database
- [ ] None needed — this only prints data that's already been fetched to the screen. No new tables, RPCs, or storage.

---

## 2. Stocks Photo

**⚠️ Needs a team decision before building — flagging what's actually ambiguous:**

Right now `src/constants/productCatalog.js` is a static list of 24 product codes with `image: null` on every single entry — there's no product photo anywhere in the app today (the "real photos in lists" work done Aug 27–28 was **profile** photos for people, not product photos). "Stocks Photo" could mean either:

- **(A) Static bundled photos** — team supplies 24 real product photos once, bundled into the app, `productCatalog.js` gets real `image` paths. Simple, no backend work, but any new product needs a rebuild to add.
- **(B) Manager-uploadable photos** — a manager can attach/change a product photo from the app itself (reusing the same camera-capture + Supabase Storage upload pattern already built for shipment photos). More flexible, but needs new storage + a `products` table (doesn't exist yet — the catalog is deliberately static per `productCatalog.js`'s own comment) or a photo-per-product-code table.

**Recommend (A) first** — get real product photos everywhere the catalog is used, then decide if (B) is worth the schema work later. Confirm with the team which one is meant.

### Frontend (all 3 POVs where the catalog/photos surface)
- [ ] Manager — `AddNewBatchesScreen.js` product picker: show the photo per product
- [ ] Manager — `ManagerStockScreen.js` / `StockBatchCard.js`: show the photo per stock card
- [ ] Sales Rep — `SalesRepStockScreen.js` (wherever it lists stock by product): show the photo
- [ ] Collector — wherever delivery line items list products (e.g. `CollectorDeliveryDetailScreen.js`): show the photo
- [ ] Fallback UI for products with no photo yet (placeholder icon), same pattern as `UserAvatar.js`'s initials fallback

### Backend / Database — only if option (B) is chosen
- [ ] New `products` table (code, name, image storage path) or a lighter `product_photos` lookup table
- [ ] New Supabase Storage bucket (e.g. `product-media`), manager-write / branch-read policies — same shape as the existing `shipment-media` bucket
- [ ] New RPC or direct-table write for a manager to upload/replace a product's photo
- [ ] RLS: decide if photos are branch-scoped or global (global makes more sense here — same physical products across branches)

---

## 3. ✅ Fill the FAQ and Laws screen

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

## 4. UI improvements

Deliberately left open-ended — this is a running bucket, not a single task. Add specific items here as they're identified (e.g. from a design pass, from pilot feedback, from a mockup) rather than treating "UI improvements" itself as one ticket.

- [ ] _(add specific items as they come up)_

---

*Living document — update status symbols and add specifics as work starts. Keep this in `capstone_docs/MD Folder/` alongside the sprint roadmap and session handoff notes so any team member (or Claude, in a future session) has full context without re-explaining.*

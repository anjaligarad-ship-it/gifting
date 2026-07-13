# One Earth Gifting — Audit Issues

Single source of truth. Work lowest-score group first, top-to-bottom within each group. One issue at a time.

---

## GROUP 1 — Gifting features (scorecard: 2/10)

- [x] **G1** Structured address capture with postcode validation — 5 structured fields, UK regex normaliser, inline blur validation, server-side validateAddress(), formatAddress() on metadata. (+25 unit) — replace free-text textarea with name/line1/line2/town/postcode fields; validate UK postcode regex then postcodes.io; normalise to uppercase with correct spacing; store structured object on order.
- [x] **G2** Separate recipient vs billing address (gift toggle) — toggle reveals recipient address form; order carries both addresses in metadata; recipient postcode drives delivery. (+7 unit) — "This is a gift" toggle reveals recipient address form; order carries two distinct address objects; recipient postcode drives delivery options.
- [x] **G3** Gift message at checkout — textarea (max 250 chars) with live counter, stored on order metadata. (+6 unit)
- [x] **G4** Gift receipt / hidden prices — hidePrice flag stored on order; packing-slip generator tested with flag on/off; email uses flag. (+4 unit)

## GROUP 2 — Checkout & payments (scorecard: 3/10)

- [x] **C1** Delivery option selection with shipping charged — pre-Stripe delivery step: Standard (3–5 days, £3.95), Express (1–2 days, £6.95); free delivery config (value threshold £50 / item threshold 20); selected shipping added to total server-side before Stripe charge. (+29 unit) — src/lib/delivery.js with arrival dates, special-zone map, bank-holiday skip; delivery option cards in cart.astro with postcode-aware arrival dates; shipping as Stripe line item; isFreeDelivery gating server-side.
- [x] **C2** Basket quantity controls and item removal — already implemented in drawer+cart; verify server-side total recalc and empty-state. Confirmed: subtotal always recalculated from items array server-side; empty cart hides form; qty/remove buttons update localStorage and re-render.
- [!] **C3** Wallet payments (Apple Pay / Google Pay / Link) — BLOCKED: needs live browser with payment hardware + Stripe domain verification. Scaffold Payment Element config; cannot fully test in CI.
- [x] **C4** Discount code support — already implemented (FIRST 20%, GAURAVP 30%); verify expiry/usage-limit fields added to PROMO_CODES schema. Added expiresAt + maxUsesPerCode to schema; apply.js checks expiresAt before any DB call; +6 unit tests for schema validation.

## GROUP 3 — Delivery & logistics (scorecard: 3/10)

- [x] **D1** Estimated delivery dates by postcode — date calculator: 1-day dispatch (bank holidays included for dispatch); carrier leg in working days Mon–Fri; `carrierSkipsBankHolidays` flag (default true); special-zone map (+1–2 days for BT/IV/HS/KW/ZE/GY/JE/IM); Europe/London timezone; display "arrives by Wednesday 15 July". Done via src/lib/delivery.js + cart.astro delivery option cards.
- [x] **D2** Order confirmation email — enhanced: structured billing/recipient address, gift block (message + hide-price note), delivery estimate from computeArrivalDate + GOV.UK bank holiday feed; HTML escaping for all customer-supplied strings; team notification includes all gift/shipping metadata.
- [x] **D3** Basic inventory — stock field per product; decrement on order via webhook; "Only N left" badge at ≤ 3; block add-to-basket at 0 server-side. stock:null added to products.js (unlimited default); product_inventory Supabase table (scripts/migrate-inventory.sql) with atomic decrement_stock RPC; GET /api/inventory for client badge; server-side stock gate in create-checkout.js; atomic decrement in stripe-webhook.js.

## GROUP 4 — Trust & consistency (scorecard: 4/10)

- [x] **T1** Reviews claim — removed "4.9★ from hundreds of verified customers" from trust strip in index.astro; replaced with neutral "Loved by Customers" entry; scaffolded hidden #product-reviews section on product pages (display:none until real reviews wired up).
- [x] **T2** Coming Soon consistency — server-side block in create-checkout.js (comingSoon check before Stripe); client-side guard in window.addToCart via PRODUCT_MAP built from search-data JSON (shows error toast and returns early); ATC button already hidden on product page for comingSoon products.
- [x] **T3** Login-state header glitch — fixed: `_peekLocalSession()` reads `sb-fwjuoozfqzbpfllgudyk-auth-token` from localStorage synchronously so `isLoggedIn` is correct before `getSession()` resolves; dropdown is CSS-hidden by default (no FOUC); `updateAccountLink()` only shows dropdown for logged-in state; no simultaneous render — single `#account-link` element with click guarded by `isLoggedIn`.

## GROUP 5 — SEO & performance (scorecard: 4/10)

- [x] **S1** Canonical domain fix — already correct: `astro.config.mjs` has `site: 'https://oneearthgifting.com'`; `Layout.astro` computes `canonical = new URL(pathname, Astro.site).href` and emits `<link rel="canonical">` + `og:url`; no `.co.uk` references found; `oneearthbeyond.com` references are intentional (parent company links/emails).
- [x] **S2** Image optimisation — renamed 4 files with spaces (`your-carbon-karma-jenga.png`, `ever-bloom-bookmark.jpeg`, `midnight-hummingbird-paperweight.jpeg`, `hero-1.png`); updated `products.js` + `index.astro` references; added explicit `width`/`height` to hero (1920×1080), collection banner (1254×1254), and logo (2000×2000); shop product cards already had 600×450 + lazy/eager; WebP/srcset conversion requires moving images to `src/assets/` (future migration — images currently in `public/` bypass Astro Image processing).
- [x] **S3** SEO structured data — Product JSON-LD already on product pages; Organization schema enhanced in Layout.astro (logo, description, contactPoint, parentOrganization — no aggregateRating); WebSite schema with SearchAction added to index.astro only; all schemas validated structurally.
- [!] **S4** Analytics — BLOCKED: needs Plausible/GA4 account. Scaffold event-firing hooks but cannot verify in sandbox without credentials.

---

## Legend
- `[ ] todo` — not started
- `[x] done — <note> (+N unit, +N component)` — complete
- `[!] blocked — <reason>` — needs external input

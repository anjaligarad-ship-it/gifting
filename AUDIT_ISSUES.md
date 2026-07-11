# One Earth Gifting — Audit Issues

Single source of truth. Work lowest-score group first, top-to-bottom within each group. One issue at a time.

---

## GROUP 1 — Gifting features (scorecard: 2/10)

- [x] **G1** Structured address capture with postcode validation — 5 structured fields, UK regex normaliser, inline blur validation, server-side validateAddress(), formatAddress() on metadata. (+25 unit) — replace free-text textarea with name/line1/line2/town/postcode fields; validate UK postcode regex then postcodes.io; normalise to uppercase with correct spacing; store structured object on order.
- [ ] **G2** Separate recipient vs billing address (gift toggle) — "This is a gift" toggle reveals recipient address form; order carries two distinct address objects; recipient postcode drives delivery options.
- [ ] **G3** Gift message at checkout — optional textarea (max 250 chars) with live counter; stored on order; surfaced in order views.
- [ ] **G4** Gift receipt / hidden prices — "Hide prices on packing slip" flag stored on order; any generated slip/email omits prices when flag is set.

## GROUP 2 — Checkout & payments (scorecard: 3/10)

- [ ] **C1** Delivery option selection with shipping charged — pre-Stripe delivery step: Standard (3–5 days, £3.95), Express (1–2 days, £6.95); free delivery config (value threshold £50 / item threshold 20); selected shipping added to total server-side before Stripe charge.
- [ ] **C2** Basket quantity controls and item removal — already implemented in drawer+cart; verify server-side total recalc and empty-state.
- [!] **C3** Wallet payments (Apple Pay / Google Pay / Link) — BLOCKED: needs live browser with payment hardware + Stripe domain verification. Scaffold Payment Element config; cannot fully test in CI.
- [ ] **C4** Discount code support — already implemented (FIRST 20%, GAURAVP 30%); verify expiry/usage-limit fields added to PROMO_CODES schema.

## GROUP 3 — Delivery & logistics (scorecard: 3/10)

- [ ] **D1** Estimated delivery dates by postcode — date calculator: 1-day dispatch (bank holidays included for dispatch); carrier leg in working days Mon–Fri; `carrierSkipsBankHolidays` flag (default true); special-zone map (+1–2 days for BT/IV/HS/KW/ZE/GY/JE/IM); Europe/London timezone; display "arrives by Wednesday 15 July".
- [ ] **D2** Order confirmation email — already using Resend; enhance payload with structured address, gift flag, delivery estimate; verify trigger on webhook.
- [ ] **D3** Basic inventory — stock field per product; decrement on order via webhook; "Only N left" badge at ≤ 3; block add-to-basket at 0 server-side.

## GROUP 4 — Trust & consistency (scorecard: 4/10)

- [ ] **T1** Reviews claim — remove "4.9★ from hundreds of verified customers" claim; scaffold empty-state-hidden reviews block on product pages.
- [ ] **T2** Coming Soon consistency — single source of truth for product status; Coming Soon products never addable to basket from any surface including direct API POST.
- [ ] **T3** Login-state header glitch — header already uses JS auth state toggle; verify logged-out shows login only, logged-in shows account links + logout only; confirm no simultaneous render bug.

## GROUP 5 — SEO & performance (scorecard: 4/10)

- [ ] **S1** Canonical domain fix — standardise everything on https://oneearthgifting.com; grep for .co.uk references; add canonical helper.
- [ ] **S2** Image optimisation — normalise filenames (no spaces), use Astro `<Image>` with WebP + srcset + lazy-load + explicit dimensions.
- [ ] **S3** SEO structured data — Product JSON-LD already on product pages; add Organization/WebSite schema on homepage; do NOT emit aggregateRating until real reviews exist.
- [!] **S4** Analytics — BLOCKED: needs Plausible/GA4 account. Scaffold event-firing hooks but cannot verify in sandbox without credentials.

---

## Legend
- `[ ] todo` — not started
- `[x] done — <note> (+N unit, +N component)` — complete
- `[!] blocked — <reason>` — needs external input

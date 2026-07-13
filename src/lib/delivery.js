/**
 * Delivery date calculator for One Earth Gifting.
 *
 * Rules:
 * - Dispatch is always 1 working day from order date.
 * - We DO dispatch on UK bank holidays (never skip dispatch for bank holidays).
 * - Carrier transit is in working days Mon–Fri.
 * - `carrierSkipsBankHolidays` (default true): bank holidays are skipped in the
 *   carrier leg, shifting arrival by 1 day per holiday hit.
 * - Special-zone postcodes add extra transit days.
 * - All dates are in Europe/London timezone.
 */

// ── Config ────────────────────────────────────────────────────────────────────

export const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Standard delivery (3–5 working days)', days: 5, price: 395 },
  { id: 'express',  label: 'Express delivery (1–2 working days)',  days: 2, price: 695 },
];

export const FREE_DELIVERY_VALUE_THRESHOLD = 50;  // £
export const FREE_DELIVERY_ITEM_THRESHOLD  = 20;  // item count

// Postcode prefixes that attract extra transit days (editable config)
export const SPECIAL_ZONES = {
  BT: 2, IV: 2, HS: 2, KW: 2, ZE: 2,
  GY: 2, JE: 2, IM: 2,
};

/**
 * Returns true if free delivery applies to the given cart.
 * @param {{ subtotal: number, itemCount: number }} cart
 */
export function isFreeDelivery({ subtotal, itemCount }) {
  return subtotal >= FREE_DELIVERY_VALUE_THRESHOLD ||
         itemCount >= FREE_DELIVERY_ITEM_THRESHOLD;
}

// ── Bank holiday cache ─────────────────────────────────────────────────────────

let _bankHolidaySet = null; // Set of 'YYYY-MM-DD' strings (England & Wales)
let _bankHolidayFetchedAt = 0;
const BANK_HOLIDAY_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

/**
 * Fetch & cache bank holidays from GOV.UK. Returns a Set of 'YYYY-MM-DD' strings.
 * Falls back to an empty set on network failure so checkout is never blocked.
 */
export async function getBankHolidaySet() {
  if (_bankHolidaySet && Date.now() - _bankHolidayFetchedAt < BANK_HOLIDAY_TTL_MS) {
    return _bankHolidaySet;
  }
  try {
    const res = await fetch('https://www.gov.uk/bank-holidays.json', {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`GOV.UK ${res.status}`);
    const data = await res.json();
    const events = data['england-and-wales']?.events || [];
    _bankHolidaySet = new Set(events.map(e => e.date));
    _bankHolidayFetchedAt = Date.now();
  } catch {
    _bankHolidaySet = new Set();
  }
  return _bankHolidaySet;
}

/** Inject a pre-fetched set (for testing without network calls). */
export function _setBankHolidaySet(set) { _bankHolidaySet = set; _bankHolidayFetchedAt = Date.now(); }

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Add `days` calendar days to a Date, returning a new Date.
 */
function addCalendarDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const _dateIntl = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
});
const _weekdayIntl = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', weekday: 'short',
});

/** Format a Date as 'YYYY-MM-DD' in Europe/London. en-CA gives ISO order natively. */
function toLocalDateString(date) {
  return _dateIntl.format(date);
}

/** True if date is a weekend in Europe/London. */
function isWeekend(date) {
  const wd = _weekdayIntl.format(date);
  return wd === 'Sat' || wd === 'Sun';
}

/**
 * Add `workingDays` working days (Mon–Fri, optionally skipping bank holidays)
 * to a starting date.
 */
export function addWorkingDays(startDate, workingDays, bankHolidays = new Set(), skipBankHolidays = false) {
  let d = new Date(startDate);
  let remaining = workingDays;
  while (remaining > 0) {
    d = addCalendarDays(d, 1);
    if (isWeekend(d)) continue;
    const ds = toLocalDateString(d);
    if (skipBankHolidays && bankHolidays.has(ds)) continue;
    remaining--;
  }
  return d;
}

/**
 * Return the extra transit days for a postcode (based on SPECIAL_ZONES config).
 */
export function specialZoneExtraDays(postcode) {
  if (!postcode) return 0;
  const prefix = postcode.trim().toUpperCase().replace(/\d.*$/, '');
  return SPECIAL_ZONES[prefix] ?? 0;
}

/**
 * Compute the estimated arrival date for a given shipping option.
 *
 * @param {object} params
 * @param {Date}   params.orderDate         - The date/time the order is placed.
 * @param {number} params.transitWorkingDays - Carrier working days for this option.
 * @param {string} params.postcode           - Recipient postcode (drives special zone).
 * @param {Set}    params.bankHolidays       - Set of 'YYYY-MM-DD' bank holiday strings.
 * @param {boolean} params.carrierSkipsBankHolidays - If true, bank holidays shift carrier leg.
 * @returns {Date} Estimated arrival date.
 */
export function computeArrivalDate({
  orderDate,
  transitWorkingDays,
  postcode = '',
  bankHolidays = new Set(),
  carrierSkipsBankHolidays = true,
}) {
  // Dispatch: always next working day (we dispatch on bank holidays too)
  // So we just add 1 calendar day then find the next working day.
  const dispatchDate = addWorkingDays(orderDate, 1, new Set(), false); // no bank-holiday skip for dispatch

  // Carrier leg: transit working days + special zone
  const extraDays = specialZoneExtraDays(postcode);
  const totalTransit = transitWorkingDays + extraDays;

  return addWorkingDays(dispatchDate, totalTransit, bankHolidays, carrierSkipsBankHolidays);
}

/**
 * Format an arrival date as "arrives by Wednesday 15 July".
 */
export function formatArrivalDate(date) {
  return `arrives by ${date.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })}`;
}

/**
 * Build the full delivery options array for a cart, enriched with dates and prices.
 * Marks free delivery when applicable.
 *
 * @param {{ subtotal: number, itemCount: number, postcode: string, orderDate: Date, bankHolidays: Set, carrierSkipsBankHolidays: boolean }} params
 */
export function buildDeliveryOptions({ subtotal, itemCount, postcode, orderDate, bankHolidays, carrierSkipsBankHolidays = true }) {
  const free = isFreeDelivery({ subtotal, itemCount });
  return SHIPPING_OPTIONS.map(opt => {
    const arrival = computeArrivalDate({
      orderDate,
      transitWorkingDays: opt.days,
      postcode,
      bankHolidays,
      carrierSkipsBankHolidays,
    });
    return {
      ...opt,
      effectivePrice: free ? 0 : opt.price,
      isFree: free,
      arrivalDate: arrival,
      arrivalLabel: formatArrivalDate(arrival),
    };
  });
}

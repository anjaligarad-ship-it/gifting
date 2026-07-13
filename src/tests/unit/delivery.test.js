import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFreeDelivery,
  addWorkingDays,
  specialZoneExtraDays,
  computeArrivalDate,
  formatArrivalDate,
  buildDeliveryOptions,
  FREE_DELIVERY_VALUE_THRESHOLD,
  FREE_DELIVERY_ITEM_THRESHOLD,
  SHIPPING_OPTIONS,
  _setBankHolidaySet,
} from '../../lib/delivery.js';

// Use a fixed "today" that is a Monday to make test assertions deterministic.
// Monday 2025-01-06
const MONDAY = new Date('2025-01-06T10:00:00Z');
// Tuesday 2025-01-07
const TUESDAY = new Date('2025-01-07T10:00:00Z');
// Friday 2025-01-10
const FRIDAY  = new Date('2025-01-10T10:00:00Z');

const NO_HOLIDAYS = new Set();

beforeEach(() => {
  _setBankHolidaySet(NO_HOLIDAYS);
});

// ── isFreeDelivery ─────────────────────────────────────────────────────────────

describe('isFreeDelivery', () => {
  it('is free when subtotal meets value threshold', () => {
    expect(isFreeDelivery({ subtotal: FREE_DELIVERY_VALUE_THRESHOLD, itemCount: 1 })).toBe(true);
    expect(isFreeDelivery({ subtotal: 99, itemCount: 1 })).toBe(true);
  });

  it('is not free just below value threshold', () => {
    expect(isFreeDelivery({ subtotal: FREE_DELIVERY_VALUE_THRESHOLD - 0.01, itemCount: 1 })).toBe(false);
  });

  it('is free when item count meets item threshold', () => {
    expect(isFreeDelivery({ subtotal: 5, itemCount: FREE_DELIVERY_ITEM_THRESHOLD })).toBe(true);
    expect(isFreeDelivery({ subtotal: 5, itemCount: 99 })).toBe(true);
  });

  it('is not free just below item threshold', () => {
    expect(isFreeDelivery({ subtotal: 5, itemCount: FREE_DELIVERY_ITEM_THRESHOLD - 1 })).toBe(false);
  });

  it('is not free for a typical small order', () => {
    expect(isFreeDelivery({ subtotal: 20, itemCount: 2 })).toBe(false);
  });
});

// ── addWorkingDays ────────────────────────────────────────────────────────────

describe('addWorkingDays', () => {
  it('adds 1 working day from Monday → Tuesday', () => {
    const result = addWorkingDays(MONDAY, 1, NO_HOLIDAYS, false);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-07');
  });

  it('adds 1 working day from Friday → Monday', () => {
    const result = addWorkingDays(FRIDAY, 1, NO_HOLIDAYS, false);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-13');
  });

  it('adds 5 working days from Monday → next Monday', () => {
    const result = addWorkingDays(MONDAY, 5, NO_HOLIDAYS, false);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-13');
  });

  it('skips bank holidays when flag is true', () => {
    // Tuesday 2025-01-07 is a bank holiday
    const holidays = new Set(['2025-01-07']);
    // 1 working day from Monday, skip bank holidays → should land Wednesday
    const result = addWorkingDays(MONDAY, 1, holidays, true);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-08');
  });

  it('does NOT skip bank holidays when flag is false', () => {
    const holidays = new Set(['2025-01-07']);
    const result = addWorkingDays(MONDAY, 1, holidays, false);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-07'); // lands on the holiday
  });
});

// ── specialZoneExtraDays ──────────────────────────────────────────────────────

describe('specialZoneExtraDays', () => {
  it('returns 0 for a standard mainland postcode', () => {
    expect(specialZoneExtraDays('SW1A 2AA')).toBe(0);
    expect(specialZoneExtraDays('EC1A 1BB')).toBe(0);
  });

  it('returns 2 for BT (Northern Ireland)', () => {
    expect(specialZoneExtraDays('BT1 1AA')).toBe(2);
  });

  it('returns 2 for IV (Scottish Highlands)', () => {
    expect(specialZoneExtraDays('IV2 3TJ')).toBe(2);
  });

  it('returns 2 for GY (Guernsey)', () => {
    expect(specialZoneExtraDays('GY1 2LG')).toBe(2);
  });

  it('returns 2 for IM (Isle of Man)', () => {
    expect(specialZoneExtraDays('IM1 2RG')).toBe(2);
  });

  it('returns 0 for null/undefined', () => {
    expect(specialZoneExtraDays(null)).toBe(0);
    expect(specialZoneExtraDays(undefined)).toBe(0);
    expect(specialZoneExtraDays('')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(specialZoneExtraDays('bt1 1aa')).toBe(2);
  });
});

// ── computeArrivalDate ────────────────────────────────────────────────────────

describe('computeArrivalDate', () => {
  it('standard (5 transit days) from Monday → following Monday', () => {
    // dispatch: Tuesday; +5 working days = next Tuesday
    const arrival = computeArrivalDate({
      orderDate: MONDAY,
      transitWorkingDays: 5,
      postcode: 'SW1A 2AA',
      bankHolidays: NO_HOLIDAYS,
    });
    expect(arrival.toISOString().slice(0, 10)).toBe('2025-01-14');
  });

  it('express (2 transit days) from Monday → Thursday', () => {
    // dispatch: Tuesday; +2 working days = Thursday
    const arrival = computeArrivalDate({
      orderDate: MONDAY,
      transitWorkingDays: 2,
      postcode: 'SW1A 2AA',
      bankHolidays: NO_HOLIDAYS,
    });
    expect(arrival.toISOString().slice(0, 10)).toBe('2025-01-09');
  });

  it('adds extra days for a special-zone postcode (BT)', () => {
    // dispatch: Tuesday; +2+2 transit = 4 working days = following Monday
    const arrival = computeArrivalDate({
      orderDate: MONDAY,
      transitWorkingDays: 2,
      postcode: 'BT1 1AA',
      bankHolidays: NO_HOLIDAYS,
    });
    expect(arrival.toISOString().slice(0, 10)).toBe('2025-01-13');
  });

  it('shifts arrival when bank holiday falls in carrier leg', () => {
    // Thursday 2025-01-09 is a bank holiday
    const holidays = new Set(['2025-01-09']);
    // dispatch: Tuesday 07; standard (5 days), skip holiday
    // Tue → Wed(1) → Thu(holiday, skip) → Fri(2) → Mon(3) → Tue(4) → Wed(5)
    const arrival = computeArrivalDate({
      orderDate: MONDAY,
      transitWorkingDays: 5,
      postcode: 'SW1A 2AA',
      bankHolidays: holidays,
      carrierSkipsBankHolidays: true,
    });
    // Without holiday: Tue+5 = next Tuesday (14th). With holiday pushing 1: Wednesday 15th.
    expect(arrival.toISOString().slice(0, 10)).toBe('2025-01-15');
  });
});

// ── formatArrivalDate ─────────────────────────────────────────────────────────

describe('formatArrivalDate', () => {
  it('returns a string starting with "arrives by"', () => {
    const d = new Date('2025-01-14T12:00:00Z');
    expect(formatArrivalDate(d)).toMatch(/^arrives by/);
  });

  it('includes a weekday name and month', () => {
    const d = new Date('2025-01-14T12:00:00Z'); // Tuesday
    const label = formatArrivalDate(d);
    expect(label).toContain('Tuesday');
    expect(label).toContain('January');
  });
});

// ── buildDeliveryOptions ──────────────────────────────────────────────────────

describe('buildDeliveryOptions', () => {
  const baseParams = {
    subtotal: 20,
    itemCount: 2,
    postcode: 'SW1A 2AA',
    orderDate: MONDAY,
    bankHolidays: NO_HOLIDAYS,
  };

  it('returns one option per SHIPPING_OPTIONS entry', () => {
    const opts = buildDeliveryOptions(baseParams);
    expect(opts).toHaveLength(SHIPPING_OPTIONS.length);
  });

  it('charges shipping price when under free threshold', () => {
    const opts = buildDeliveryOptions(baseParams); // subtotal £20 < £50
    expect(opts.find(o => o.id === 'standard').effectivePrice).toBe(395);
    expect(opts.find(o => o.id === 'express').effectivePrice).toBe(695);
    expect(opts.every(o => !o.isFree)).toBe(true);
  });

  it('marks free delivery when subtotal meets threshold', () => {
    const opts = buildDeliveryOptions({ ...baseParams, subtotal: 50 });
    expect(opts.every(o => o.effectivePrice === 0)).toBe(true);
    expect(opts.every(o => o.isFree)).toBe(true);
  });

  it('marks free delivery when item count meets threshold', () => {
    const opts = buildDeliveryOptions({ ...baseParams, itemCount: 20 });
    expect(opts.every(o => o.effectivePrice === 0)).toBe(true);
  });

  it('each option has arrivalLabel string', () => {
    const opts = buildDeliveryOptions(baseParams);
    for (const opt of opts) {
      expect(typeof opt.arrivalLabel).toBe('string');
      expect(opt.arrivalLabel).toMatch(/arrives by/);
    }
  });

  it('express arrives before standard', () => {
    const opts = buildDeliveryOptions(baseParams);
    const std = opts.find(o => o.id === 'standard').arrivalDate;
    const exp = opts.find(o => o.id === 'express').arrivalDate;
    expect(exp < std).toBe(true);
  });
});

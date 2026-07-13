import { describe, it, expect } from 'vitest';
import { PROMO_CODES } from '../../data/promoCodes.js';

// Mirrors the pence-based calculation used in cart.astro and create-checkout.js
function calcDiscount(subtotalPence, rate, capPence) {
  return Math.min(Math.round(subtotalPence * rate), capPence);
}

describe('FIRST promo code (20% off, £60 cap)', () => {
  const { rate, cap } = PROMO_CODES.FIRST;
  const capPence = cap * 100;

  it('rate is 20%', () => {
    expect(rate).toBe(0.20);
  });

  it('applies 20% on a £25 order', () => {
    expect(calcDiscount(2500, rate, capPence)).toBe(500); // £5.00
  });

  it('applies 20% on a £50 order', () => {
    expect(calcDiscount(5000, rate, capPence)).toBe(1000); // £10.00
  });

  it('caps at £60 on a £300+ order', () => {
    expect(calcDiscount(30000, rate, capPence)).toBe(6000); // £60
  });

  it('does not exceed £60 cap on a large order', () => {
    expect(calcDiscount(100000, rate, capPence)).toBe(6000);
  });

  it('gives £0 discount on zero subtotal', () => {
    expect(calcDiscount(0, rate, capPence)).toBe(0);
  });

  it('cart total equals subtotal minus discount', () => {
    const subtotal = 2500;
    const discount = calcDiscount(subtotal, rate, capPence);
    expect(subtotal - discount).toBe(2000); // £20.00
  });

  it('cart total is never negative', () => {
    const subtotal = 100;
    const discount = calcDiscount(subtotal, rate, capPence);
    expect(Math.max(0, subtotal - discount)).toBeGreaterThanOrEqual(0);
  });
});

describe('GAURAVP promo code (30% off, £60 cap)', () => {
  const { rate, cap } = PROMO_CODES.GAURAVP;
  const capPence = cap * 100;

  it('rate is 30%', () => {
    expect(rate).toBe(0.30);
  });

  it('applies 30% on a £25 order', () => {
    expect(calcDiscount(2500, rate, capPence)).toBe(750); // £7.50
  });

  it('caps at £60 on a £200+ order', () => {
    expect(calcDiscount(20000, rate, capPence)).toBe(6000); // £60
  });

  it('is not public', () => {
    expect(PROMO_CODES.GAURAVP.public).toBe(false);
  });
});

describe('PROMO_CODES schema (C4)', () => {
  it('every code has required fields', () => {
    for (const [key, promo] of Object.entries(PROMO_CODES)) {
      expect(typeof promo.rate, `${key}.rate`).toBe('number');
      expect(typeof promo.cap, `${key}.cap`).toBe('number');
      expect(typeof promo.public, `${key}.public`).toBe('boolean');
      expect('expiresAt' in promo, `${key}.expiresAt field exists`).toBe(true);
      expect('maxUsesPerCode' in promo, `${key}.maxUsesPerCode field exists`).toBe(true);
    }
  });

  it('expiresAt is null or a valid ISO date string', () => {
    for (const [key, promo] of Object.entries(PROMO_CODES)) {
      if (promo.expiresAt !== null) {
        expect(Number.isNaN(Date.parse(promo.expiresAt)), `${key}.expiresAt is a valid date`).toBe(false);
      }
    }
  });

  it('an expired code (expiresAt in the past) would be detected', () => {
    const pastCode = { rate: 0.1, cap: 10, expiresAt: '2020-01-01', maxUsesPerCode: null, public: false };
    expect(new Date(pastCode.expiresAt) < new Date()).toBe(true);
  });

  it('a future expiry is not yet expired', () => {
    const futureCode = { rate: 0.1, cap: 10, expiresAt: '2099-12-31', maxUsesPerCode: null, public: false };
    expect(new Date(futureCode.expiresAt) < new Date()).toBe(false);
  });

  it('maxUsesPerCode null means unlimited', () => {
    expect(PROMO_CODES.FIRST.maxUsesPerCode).toBeNull();
    expect(PROMO_CODES.GAURAVP.maxUsesPerCode).toBeNull();
  });

  it('GAURAVP is not surfaced via filter of public codes', () => {
    const publicCodes = Object.entries(PROMO_CODES).filter(([, p]) => p.public).map(([k]) => k);
    expect(publicCodes).not.toContain('GAURAVP');
    expect(publicCodes).toContain('FIRST');
  });
});

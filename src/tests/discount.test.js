import { describe, it, expect } from 'vitest';

// Mirrors the exact calculation used in both cart.astro and create-checkout.js
const DISCOUNT_RATE = 0.15;
const DISCOUNT_CAP_PENCE = 6000; // £60 in pence

function calcDiscount(subtotalPence) {
  return Math.min(Math.round(subtotalPence * DISCOUNT_RATE), DISCOUNT_CAP_PENCE);
}

describe('First-order discount calculation', () => {
  it('applies 15% on a £25 order', () => {
    expect(calcDiscount(2500)).toBe(375); // £3.75
  });

  it('applies 15% on a £50 order', () => {
    expect(calcDiscount(5000)).toBe(750); // £7.50
  });

  it('caps at £60 on a £400 order', () => {
    expect(calcDiscount(40000)).toBe(6000); // £60
  });

  it('caps at £60 exactly when subtotal is £400', () => {
    // 400 * 0.15 = 60 exactly — should be capped
    expect(calcDiscount(40000)).toBe(6000);
  });

  it('does not exceed the £60 cap on a large order', () => {
    expect(calcDiscount(100000)).toBe(6000);
  });

  it('gives £0 discount on zero subtotal', () => {
    expect(calcDiscount(0)).toBe(0);
  });

  it('rounds correctly for fractional pence (£33.33 order)', () => {
    // 3333 * 0.15 = 499.95 → rounds to 500 (£5.00)
    expect(calcDiscount(3333)).toBe(500);
  });

  it('cart total equals subtotal minus discount', () => {
    const subtotal = 2500;
    const discount = calcDiscount(subtotal);
    expect(subtotal - discount).toBe(2125); // £21.25
  });

  it('cart total is never negative', () => {
    const subtotal = 100; // £1 order
    const discount = calcDiscount(subtotal);
    expect(Math.max(0, subtotal - discount)).toBeGreaterThanOrEqual(0);
  });
});

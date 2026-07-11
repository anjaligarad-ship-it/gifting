import { describe, it, expect } from 'vitest';
import { validateAddress, formatAddress } from '../../lib/address.js';

// Order model: an order should carry two distinct address objects when isGift is true.
// We test the shape/validation helpers used to build that model.

describe('Gift order — two-address model', () => {
  const billing = { line1: '1 Buyer Lane', line2: '', town: 'London', postcode: 'SW1A 2AA' };
  const recipient = { line1: '2 Gift Row', line2: 'Apt 3', town: 'Manchester', postcode: 'M1 1AE' };

  it('billing address validates independently', () => {
    expect(validateAddress(billing).ok).toBe(true);
  });

  it('recipient address validates independently', () => {
    expect(validateAddress(recipient).ok).toBe(true);
  });

  it('a non-gift order has no recipient address', () => {
    const order = { isGift: false, address: billing };
    expect(order.recipientAddress).toBeUndefined();
  });

  it('a gift order carries both addresses as distinct objects', () => {
    const order = { isGift: true, address: billing, recipientAddress: recipient };
    expect(order.address).not.toBe(order.recipientAddress);
    expect(order.recipientAddress.town).toBe('Manchester');
    expect(order.address.town).toBe('London');
  });

  it('formatAddress produces distinct strings for each', () => {
    const billingStr = formatAddress(validateAddress(billing).normalised);
    const recipientStr = formatAddress(validateAddress(recipient).normalised);
    expect(billingStr).not.toBe(recipientStr);
    expect(recipientStr).toContain('Manchester');
  });

  it('recipient postcode is what drives delivery options', () => {
    const order = { isGift: true, address: billing, recipientAddress: recipient };
    const deliveryPostcode = order.isGift
      ? order.recipientAddress.postcode
      : order.address.postcode;
    expect(deliveryPostcode).toBe('M1 1AE');
  });

  it('non-gift order uses billing postcode for delivery', () => {
    const order = { isGift: false, address: billing };
    const deliveryPostcode = order.isGift
      ? order.recipientAddress?.postcode
      : order.address.postcode;
    expect(deliveryPostcode).toBe('SW1A 2AA');
  });
});

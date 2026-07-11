import { describe, it, expect } from 'vitest';

// Gift message validation — max 250 chars, stored on order.
const MAX_GIFT_MSG = 250;

function validateGiftMessage(msg) {
  if (!msg) return { ok: true, value: '' };
  const trimmed = msg.trim();
  if (trimmed.length > MAX_GIFT_MSG) {
    return { ok: false, error: `Gift message must be ${MAX_GIFT_MSG} characters or fewer (${trimmed.length} entered)` };
  }
  return { ok: true, value: trimmed };
}

// Packing slip generator — respects hidePrice flag.
function buildPackingSlip({ items, hidePrice, giftMessage }) {
  const lines = items.map(i =>
    hidePrice ? `• ${i.name} × ${i.qty}` : `• ${i.name} × ${i.qty} — £${(i.price * i.qty).toFixed(2)}`
  );
  return {
    lines,
    total: hidePrice ? null : items.reduce((s, i) => s + i.price * i.qty, 0),
    giftMessage: giftMessage || null,
  };
}

describe('validateGiftMessage', () => {
  it('accepts empty message', () => {
    expect(validateGiftMessage('').ok).toBe(true);
    expect(validateGiftMessage('').value).toBe('');
  });
  it('accepts null/undefined', () => {
    expect(validateGiftMessage(null).ok).toBe(true);
    expect(validateGiftMessage(undefined).ok).toBe(true);
  });
  it('accepts a message within 250 chars', () => {
    expect(validateGiftMessage('Happy birthday!').ok).toBe(true);
  });
  it('trims whitespace', () => {
    expect(validateGiftMessage('  Hello!  ').value).toBe('Hello!');
  });
  it('rejects messages over 250 chars', () => {
    const long = 'A'.repeat(251);
    const r = validateGiftMessage(long);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/250/);
  });
  it('accepts exactly 250 chars', () => {
    expect(validateGiftMessage('B'.repeat(250)).ok).toBe(true);
  });
});

describe('buildPackingSlip — hidePrice flag', () => {
  const items = [
    { name: 'Jenga Set', qty: 1, price: 25 },
    { name: 'Bookmark', qty: 2, price: 5 },
  ];

  it('includes prices when hidePrice is false', () => {
    const slip = buildPackingSlip({ items, hidePrice: false, giftMessage: '' });
    expect(slip.total).toBe(35);
    expect(slip.lines[0]).toContain('£25.00');
  });

  it('omits prices when hidePrice is true', () => {
    const slip = buildPackingSlip({ items, hidePrice: true, giftMessage: '' });
    expect(slip.total).toBeNull();
    expect(slip.lines[0]).not.toContain('£');
    expect(slip.lines[0]).toContain('Jenga Set × 1');
  });

  it('includes gift message on slip when provided', () => {
    const slip = buildPackingSlip({ items, hidePrice: false, giftMessage: 'Happy birthday!' });
    expect(slip.giftMessage).toBe('Happy birthday!');
  });

  it('slip giftMessage is null when not provided', () => {
    const slip = buildPackingSlip({ items, hidePrice: false });
    expect(slip.giftMessage).toBeNull();
  });
});

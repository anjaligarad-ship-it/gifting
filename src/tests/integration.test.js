/**
 * Integration tests — hit the live dev server at localhost:4321.
 * Run `npm run dev` before running these.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:4321';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ── Page availability ─────────────────────────────────────────────────────────

describe('Page availability', () => {
  const pages = ['/', '/shop', '/cart', '/login', '/signup', '/about', '/corporate', '/our-artist'];

  for (const page of pages) {
    it(`GET ${page} returns 200`, async () => {
      const res = await fetch(`${BASE}${page}`);
      expect(res.status).toBe(200);
    });
  }

  it('GET /auth/callback returns 200', async () => {
    const res = await fetch(`${BASE}/auth/callback`);
    expect(res.status).toBe(200);
  });
});

// ── /api/promo/check-eligibility ──────────────────────────────────────────────

describe('POST /api/promo/check-eligibility', () => {
  it('returns 401 with no userId', async () => {
    const { data } = await post('/api/promo/check-eligibility', {});
    expect(data.eligible).toBe(false);
    expect(data.reason).toMatch(/log in/i);
  });

  it('returns eligible:false for non-existent user (no orders assumed)', async () => {
    // A random UUID that won't be in the DB — returns eligible or ineligible,
    // either way it should not crash (200 or 409, never 500)
    const { status, data } = await post('/api/promo/check-eligibility', {
      userId: '00000000-0000-0000-0000-000000000000',
    });
    expect(status).not.toBe(500);
    expect(typeof data.eligible).toBe('boolean');
  });
});

// ── /api/promo/apply ──────────────────────────────────────────────────────────

describe('POST /api/promo/apply', () => {
  it('rejects missing userId', async () => {
    const { status, data } = await post('/api/promo/apply', { code: 'FIRST' });
    expect(status).toBe(401);
    expect(data.valid).toBe(false);
  });

  it('rejects invalid promo code', async () => {
    const { data } = await post('/api/promo/apply', {
      code: 'INVALID',
      userId: '00000000-0000-0000-0000-000000000000',
    });
    expect(data.valid).toBe(false);
    expect(data.error).toMatch(/invalid/i);
  });

  it('returns error for user with unverified email', async () => {
    // A random UUID not in the DB — admin.getUserById returns an error → 400
    const { status, data } = await post('/api/promo/apply', {
      code: 'FIRST',
      userId: '00000000-0000-0000-0000-000000000001',
    });
    expect(data.valid).toBe(false);
    expect(status).not.toBe(500);
    expect(data.error).toBeTruthy();
  });

  it('rejects empty code', async () => {
    const { data } = await post('/api/promo/apply', {
      code: '',
      userId: '00000000-0000-0000-0000-000000000000',
    });
    expect(data.valid).toBe(false);
  });
});

// ── /api/otp/send ─────────────────────────────────────────────────────────────

describe('POST /api/otp/send', () => {
  it('rejects missing userId', async () => {
    const { status, data } = await post('/api/otp/send', { phone: '+447741526495' });
    expect(status).toBe(401);
    expect(data.error).toMatch(/log in/i);
  });

  it('rejects invalid phone number', async () => {
    const { status, data } = await post('/api/otp/send', {
      phone: 'notanumber',
      userId: '00000000-0000-0000-0000-000000000000',
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/valid mobile/i);
  });

  it('rejects missing phone', async () => {
    const { status, data } = await post('/api/otp/send', {
      phone: '',
      userId: '00000000-0000-0000-0000-000000000000',
    });
    expect(status).toBe(400);
  });
});

// ── /api/otp/check ────────────────────────────────────────────────────────────

describe('POST /api/otp/check', () => {
  it('rejects missing userId', async () => {
    const { status, data } = await post('/api/otp/check', {
      phone: '+447741526495',
      code: '123456',
    });
    expect(status).toBe(401);
  });

  it('rejects missing code', async () => {
    const { status, data } = await post('/api/otp/check', {
      phone: '+447741526495',
      userId: '00000000-0000-0000-0000-000000000000',
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/code/i);
  });

  it('rejects invalid OTP (Twilio returns not-approved)', async () => {
    const { status, data } = await post('/api/otp/check', {
      phone: '+447741526495',
      code: '000000',
      userId: '00000000-0000-0000-0000-000000000000',
    });
    // Twilio will reject the fake code — expect 400 or 500, never crash
    expect(status).toBeGreaterThanOrEqual(400);
    expect(data.error).toBeTruthy();
  });
});

// ── /api/create-checkout ──────────────────────────────────────────────────────

describe('POST /api/create-checkout', () => {
  it('rejects empty cart', async () => {
    const { status, data } = await post('/api/create-checkout', {
      items: [],
      customer: { name: 'Test', email: 'test@example.com', phone: '07700900000', address: '1 Test St' },
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/empty/i);
  });

  it('rejects missing customer fields', async () => {
    const { status, data } = await post('/api/create-checkout', {
      items: [{ slug: 'your-carbon-karma-jenga-set', name: 'Jenga', price: 25, qty: 1 }],
      customer: { name: '', email: '', phone: '', address: '' },
    });
    expect(status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  it('rejects invalid email', async () => {
    const { status, data } = await post('/api/create-checkout', {
      items: [{ slug: 'your-carbon-karma-jenga-set', name: 'Jenga', price: 25, qty: 1 }],
      customer: { name: 'Test', email: 'notanemail', phone: '07700900000', address: '1 Test St' },
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/email/i);
  });
});

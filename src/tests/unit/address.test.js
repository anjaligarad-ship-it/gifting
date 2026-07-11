import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalisePostcode,
  isValidPostcodeFormat,
  validateAddress,
  formatAddress,
  verifyPostcode,
} from '../../lib/address.js';

// --- normalisePostcode ---
describe('normalisePostcode', () => {
  it('normalises lowercase to uppercase with space', () => {
    expect(normalisePostcode('cv11gu')).toBe('CV1 1GU');
  });
  it('handles already-spaced input', () => {
    expect(normalisePostcode('CV1 1GU')).toBe('CV1 1GU');
  });
  it('handles extra whitespace', () => {
    expect(normalisePostcode('  sw1a  2aa  ')).toBe('SW1A 2AA');
  });
  it('handles alpha-numeric outward code (EC1A)', () => {
    expect(normalisePostcode('EC1A1BB')).toBe('EC1A 1BB');
  });
  it('handles two-letter area (BT1 1AA)', () => {
    expect(normalisePostcode('BT11AA')).toBe('BT1 1AA');
  });
  it('returns null for too-short input', () => {
    expect(normalisePostcode('CV1')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(normalisePostcode('')).toBeNull();
  });
  it('returns null for null', () => {
    expect(normalisePostcode(null)).toBeNull();
  });
  it('returns null for letters-only', () => {
    expect(normalisePostcode('ABCDEF')).toBeNull();
  });
  it('returns null for digits-only', () => {
    expect(normalisePostcode('123456')).toBeNull();
  });
});

// --- isValidPostcodeFormat ---
describe('isValidPostcodeFormat', () => {
  it('accepts valid postcodes', () => {
    expect(isValidPostcodeFormat('CV1 1GU')).toBe(true);
    expect(isValidPostcodeFormat('SW1A 2AA')).toBe(true);
    expect(isValidPostcodeFormat('EC1A1BB')).toBe(true);
  });
  it('rejects invalid postcodes', () => {
    expect(isValidPostcodeFormat('NOTAPC')).toBe(false);
    expect(isValidPostcodeFormat('')).toBe(false);
  });
});

// --- validateAddress ---
describe('validateAddress', () => {
  const good = { line1: '10 Downing St', line2: '', town: 'London', postcode: 'SW1A 2AA' };

  it('returns ok:true for a valid address', () => {
    const r = validateAddress(good);
    expect(r.ok).toBe(true);
    expect(r.normalised.postcode).toBe('SW1A 2AA');
  });

  it('normalises postcode in the returned object', () => {
    const r = validateAddress({ ...good, postcode: 'sw1a2aa' });
    expect(r.ok).toBe(true);
    expect(r.normalised.postcode).toBe('SW1A 2AA');
  });

  it('errors when line1 is missing', () => {
    const r = validateAddress({ ...good, line1: '' });
    expect(r.ok).toBe(false);
    expect(r.errors.line1).toBeTruthy();
  });

  it('errors when town is missing', () => {
    const r = validateAddress({ ...good, town: '  ' });
    expect(r.ok).toBe(false);
    expect(r.errors.town).toBeTruthy();
  });

  it('errors when postcode format is invalid', () => {
    const r = validateAddress({ ...good, postcode: 'BADPC' });
    expect(r.ok).toBe(false);
    expect(r.errors.postcode).toBeTruthy();
  });

  it('returns multiple errors at once', () => {
    const r = validateAddress({ line1: '', town: '', postcode: '' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).length).toBeGreaterThanOrEqual(3);
  });

  it('handles null input gracefully', () => {
    const r = validateAddress(null);
    expect(r.ok).toBe(false);
  });
});

// --- formatAddress ---
describe('formatAddress', () => {
  it('joins fields with newlines, omitting blank ones', () => {
    const addr = { line1: '10 Downing St', line2: '', town: 'London', postcode: 'SW1A 2AA' };
    expect(formatAddress(addr)).toBe('10 Downing St\nLondon\nSW1A 2AA');
  });
  it('includes line2 when present', () => {
    const addr = { line1: '1 Test St', line2: 'Flat 2', town: 'Coventry', postcode: 'CV1 1GU' };
    expect(formatAddress(addr)).toBe('1 Test St\nFlat 2\nCoventry\nCV1 1GU');
  });
});

// --- verifyPostcode (mocked fetch) ---
describe('verifyPostcode', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns valid:false for invalid format', async () => {
    const r = await verifyPostcode('BADPC');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/format/i);
  });

  it('returns valid:false when postcodes.io returns 404', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }));
    const r = await verifyPostcode('ZZ9 9ZZ');
    expect(r.valid).toBe(false);
  });

  it('returns valid:true with result on success', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ result: { admin_district: 'Westminster' } }),
    }));
    const r = await verifyPostcode('SW1A 2AA');
    expect(r.valid).toBe(true);
    expect(r.postcode).toBe('SW1A 2AA');
  });

  it('falls back to format-valid when fetch throws', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('network'); });
    const r = await verifyPostcode('CV1 1GU');
    expect(r.valid).toBe(true);
    expect(r.fallback).toBe(true);
  });
});

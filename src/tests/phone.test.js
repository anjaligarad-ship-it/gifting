import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../lib/phone.js';

describe('normalizePhone', () => {
  // Valid UK mobile — local format
  it('converts 07xxx to E.164', () => {
    expect(normalizePhone('07741526495')).toBe('+447741526495');
  });
  it('strips spaces in local format', () => {
    expect(normalizePhone('07741 526 495')).toBe('+447741526495');
  });
  it('strips dashes in local format', () => {
    expect(normalizePhone('07741-526-495')).toBe('+447741526495');
  });

  // Already E.164
  it('passes through valid E.164 unchanged', () => {
    expect(normalizePhone('+447741526495')).toBe('+447741526495');
  });
  it('passes through international non-UK E.164', () => {
    expect(normalizePhone('+12125551234')).toBe('+12125551234');
  });

  // Invalid inputs
  it('returns null for empty string', () => {
    expect(normalizePhone('')).toBeNull();
  });
  it('returns null for null', () => {
    expect(normalizePhone(null)).toBeNull();
  });
  it('returns null for undefined', () => {
    expect(normalizePhone(undefined)).toBeNull();
  });
  it('returns null for a landline (01xxx)', () => {
    expect(normalizePhone('01234567890')).toBeNull();
  });
  it('returns null for too-short number', () => {
    expect(normalizePhone('0774152')).toBeNull();
  });
  it('returns null for letters', () => {
    expect(normalizePhone('abcdefg')).toBeNull();
  });
});

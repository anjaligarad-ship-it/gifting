// UK address utilities — postcode normalisation and validation.

// UK postcode regex (covers all known formats, case-insensitive)
const UK_POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;

/**
 * Normalise a raw postcode string to uppercase with single space.
 * Returns null if the format is invalid.
 */
export function normalisePostcode(raw) {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  const m = trimmed.match(UK_POSTCODE_RE);
  if (!m) return null;
  return `${m[1].toUpperCase()} ${m[2].toUpperCase()}`;
}

/**
 * Validate a postcode string: format check only (no network call).
 * Use verifyPostcode for existence check.
 */
export function isValidPostcodeFormat(raw) {
  return normalisePostcode(raw) !== null;
}

// Simple in-process cache: postcode → { valid, adminDistrict } | null
const postcodeCache = new Map();

/**
 * Check postcode existence via postcodes.io (server-side only).
 * Returns { valid: true, result } or { valid: false }.
 * Caches responses for the process lifetime.
 */
export async function verifyPostcode(postcode) {
  const normalised = normalisePostcode(postcode);
  if (!normalised) return { valid: false, error: 'Invalid postcode format' };

  if (postcodeCache.has(normalised)) return postcodeCache.get(normalised);

  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(normalised)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.status === 404) {
      const r = { valid: false, error: 'Postcode not found' };
      postcodeCache.set(normalised, r);
      return r;
    }
    if (!res.ok) throw new Error(`postcodes.io ${res.status}`);
    const { result } = await res.json();
    const r = { valid: true, postcode: normalised, result };
    postcodeCache.set(normalised, r);
    return r;
  } catch (err) {
    // Network failure — fall back to format-only validation so checkout isn't blocked
    return { valid: true, postcode: normalised, fallback: true };
  }
}

/**
 * Validate a structured address object.
 * Returns { ok: true } or { ok: false, errors: { field: message } }.
 */
export function validateAddress(addr) {
  const errors = {};
  if (!addr?.line1?.trim()) errors.line1 = 'Address line 1 is required';
  if (!addr?.town?.trim()) errors.town = 'Town / city is required';
  const norm = normalisePostcode(addr?.postcode);
  if (!norm) errors.postcode = 'Enter a valid UK postcode (e.g. CV1 1GU)';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, normalised: { ...addr, postcode: norm } };
}

/**
 * Format a structured address for display / email.
 */
export function formatAddress(addr) {
  return [addr.line1, addr.line2, addr.town, addr.postcode]
    .filter(Boolean)
    .join('\n');
}

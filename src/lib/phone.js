// UK-focused normalization: accepts +<countrycode>... as-is, converts a
// leading-0 UK mobile number (07xxx, 11 digits) to +44, rejects landlines and everything else.
export function normalizePhone(raw) {
  const trimmed = (raw || '').replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^07\d{9}$/.test(trimmed)) return `+44${trimmed.slice(1)}`;
  return null;
}

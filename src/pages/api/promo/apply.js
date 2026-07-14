// POST /api/promo/apply
// Validates a promo code against the static registry and returns discount info.
// Full eligibility (first-order, email verified) is enforced at checkout time.
// Returns { valid, code, discountRate, discountCap, label, error }

import { PROMO_CODES } from '../../../data/promoCodes.js';

export const prerender = false;

export async function POST({ request }) {
  let code;
  try {
    ({ code } = await request.json());
  } catch {
    return json({ valid: false, error: 'Invalid request.' }, 400);
  }

  const normalised = (code || '').trim().toUpperCase();
  const promo = PROMO_CODES[normalised];

  if (!promo) {
    return json({ valid: false, error: 'Invalid promo code.' });
  }

  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return json({ valid: false, error: 'This promo code has expired.' });
  }

  return json({
    valid: true,
    code: normalised,
    discountRate: promo.rate,
    discountCap: promo.cap,
    label: promo.label,
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

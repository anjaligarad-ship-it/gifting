// POST /api/promo/apply
// Validates a promo code for the logged-in user and returns the discount rate.
// Eligibility: email verified + zero prior orders.
// Returns { valid, code, discountRate, discountCap, error }

import { supabaseAdmin } from '../../../lib/supabaseAdmin.js';
import { PROMO_CODES } from '../../../data/promoCodes.js';

export const prerender = false;

export async function POST({ request }) {
  let code, userId;
  try {
    ({ code, userId } = await request.json());
  } catch {
    return json({ valid: false, error: 'Invalid request.' }, 400);
  }

  if (!userId) return json({ valid: false, error: 'Please log in to apply a promo code.' }, 401);

  const normalised = (code || '').trim().toUpperCase();
  const promo = PROMO_CODES[normalised];
  if (!promo) {
    return json({ valid: false, error: 'Invalid promo code.' });
  }

  // Check expiry
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return json({ valid: false, error: 'This promo code has expired.' });
  }

  // Check email is verified
  const userRes = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = userRes?.data?.user ?? null;
  const userError = userRes?.error ?? null;
  if (userError || !user) return json({ valid: false, error: 'Could not verify your account.' }, 400);
  if (!user.email_confirmed_at) {
    return json({ valid: false, error: 'Please verify your email address first. Check your inbox for a verification link.' });
  }

  // Must have zero prior orders
  const { count: orderCount } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (orderCount && orderCount > 0) {
    return json({ valid: false, error: 'This discount is for first-time customers only.' });
  }

  return json({ valid: true, code: normalised, discountRate: promo.rate, discountCap: promo.cap });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

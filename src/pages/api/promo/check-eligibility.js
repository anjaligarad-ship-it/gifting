// POST /api/promo/check-eligibility
// Gates the FIRST discount on real account history: only customers with
// zero prior orders, who haven't already redeemed it, are eligible.

import { supabaseAdmin } from '../../../lib/supabaseAdmin.js';

export const prerender = false;

export async function POST({ request }) {
  let userId;
  try {
    ({ userId } = await request.json());
  } catch {
    return json({ eligible: false, reason: 'Invalid request' }, 400);
  }

  if (!userId) {
    return json({ eligible: false, reason: 'Please log in first.' }, 401);
  }

  const { count: orderCount } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (orderCount && orderCount > 0) {
    return json({ eligible: false, reason: "You've already placed an order with us — this discount is for first-time customers only." });
  }

  const { data: claim } = await supabaseAdmin
    .from('first_discount_claims')
    .select('redeemed')
    .eq('user_id', userId)
    .maybeSingle();

  if (claim?.redeemed) {
    return json({ eligible: false, reason: 'You have already claimed your first-order discount.' });
  }

  return json({ eligible: true });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

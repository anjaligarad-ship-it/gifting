// POST /api/otp/send
// Starts a Twilio Verify SMS verification for the first-order discount flow.
// The user must be logged in (userId required) and not already redeemed.

import { getTwilioVerify } from '../../../lib/twilioVerify.js';
import { normalizePhone } from '../../../lib/phone.js';
import { supabaseAdmin } from '../../../lib/supabaseAdmin.js';

export const prerender = false;

export async function POST({ request }) {
  let phone, userId;
  try {
    ({ phone, userId } = await request.json());
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!userId) return json({ error: 'Please log in to claim your discount.' }, 401);

  const normalized = normalizePhone(phone);
  if (!normalized) return json({ error: 'Please enter a valid mobile number (e.g. 07700 900000).' }, 400);

  // Block if already redeemed — no point burning an SMS send
  const { data: existingClaim } = await supabaseAdmin
    .from('first_discount_claims')
    .select('redeemed')
    .or(`user_id.eq.${userId},phone.eq.${normalized}`)
    .maybeSingle();

  if (existingClaim?.redeemed) {
    return json({ error: 'You have already claimed your first-order discount.' }, 409);
  }

  try {
    await getTwilioVerify().verifications.create({ to: normalized, channel: 'sms' });
    return json({ success: true, phone: normalized });
  } catch (err) {
    console.error('Twilio send error:', err);
    const code = err?.code;
    if (code === 60200 || code === 60212) return json({ error: 'Please enter a valid mobile number.' }, 400);
    if (code === 60203) return json({ error: 'Too many codes sent — please wait 10 minutes and try again.' }, 429);
    return json({ error: 'Could not send code — please try again.' }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

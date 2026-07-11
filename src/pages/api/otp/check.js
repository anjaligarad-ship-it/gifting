// POST /api/otp/check
// Verifies the OTP via Twilio Verify, then records the FIRST-discount claim.
// Defence-in-depth: eligibility is re-checked here even though the frontend
// already called /api/promo/check-eligibility before showing the phone step.

import { getTwilioVerify } from '../../../lib/twilioVerify.js';
import { normalizePhone } from '../../../lib/phone.js';
import { supabaseAdmin } from '../../../lib/supabaseAdmin.js';

export const prerender = false;

export async function POST({ request }) {
  let phone, code, userId;
  try {
    ({ phone, code, userId } = await request.json());
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!userId) return json({ error: 'Please log in to claim your discount.' }, 401);
  if (!code) return json({ error: 'Please enter the verification code.' }, 400);

  const normalized = normalizePhone(phone);
  if (!normalized) return json({ error: 'Invalid phone number.' }, 400);

  // Verify the code with Twilio
  let verification;
  try {
    verification = await getTwilioVerify().verificationChecks.create({
      to: normalized,
      code: String(code).trim(),
    });
  } catch (err) {
    console.error('Twilio check error:', err);
    const errCode = err?.code;
    if (errCode === 60202) return json({ error: 'Too many incorrect attempts — please request a new code.' }, 429);
    return json({ error: 'Verification failed — please try again.' }, 500);
  }

  if (verification.status !== 'approved') {
    return json({ error: 'Incorrect code — please try again.' }, 400);
  }

  // Re-check eligibility server-side
  const { count: orderCount } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (orderCount && orderCount > 0) {
    return json({ error: "You've already placed an order — this discount is for first-time customers only." }, 409);
  }

  const { data: existingUserClaim } = await supabaseAdmin
    .from('first_discount_claims')
    .select('redeemed')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingUserClaim?.redeemed) {
    return json({ error: 'You have already claimed your first-order discount.' }, 409);
  }

  const { data: existingPhoneClaim } = await supabaseAdmin
    .from('first_discount_claims')
    .select('user_id')
    .eq('phone', normalized)
    .maybeSingle();

  if (existingPhoneClaim?.user_id && existingPhoneClaim.user_id !== userId) {
    return json({ error: 'This phone number has already been used to claim the discount.' }, 409);
  }

  // Record the claim
  const now = new Date().toISOString();
  const { error: dbError } = await supabaseAdmin.from('first_discount_claims').upsert(
    {
      phone: normalized,
      user_id: userId,
      verified: true,
      verified_at: now,
      redeemed: true,
      redeemed_at: now,
      updated_at: now,
    },
    { onConflict: 'phone' },
  );

  if (dbError) {
    console.error('Failed to save claim:', dbError.message);
    return json({ error: 'Something went wrong — please try again.' }, 500);
  }

  return json({ success: true, code: 'FIRST' });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

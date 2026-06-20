// POST /api/stripe-webhook
// Stripe calls this when a checkout session completes. Verifies the signature,
// then emails the customer a confirmation and emails the team the full order details.

import Stripe from 'stripe';
import { sendOrderEmails } from '../../lib/email.js';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';

export const prerender = false;

export async function POST({ request }) {
  const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      const customer = {
        name: session.metadata?.customer_name || session.customer_details?.name || '',
        email: session.metadata?.customer_email || session.customer_details?.email || '',
        phone: session.metadata?.customer_phone || session.customer_details?.phone || '',
        address: session.metadata?.customer_address || '',
        note: session.metadata?.gift_note || '',
      };

      await sendOrderEmails({ session, lineItems: lineItems.data, customer });

      const userId = session.metadata?.user_id || null;
      const { error: orderError } = await supabaseAdmin.from('orders').insert({
        user_id: userId || null,
        stripe_session_id: session.id,
        items: lineItems.data.map((li) => ({
          name: li.description,
          qty: li.quantity,
          amount_total: li.amount_total,
        })),
        total: session.amount_total / 100,
        currency: session.currency,
        status: session.payment_status,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.address,
      });
      if (orderError) console.error('Failed to insert order:', orderError.message);

      if (userId) {
        const { error: cartClearError } = await supabaseAdmin
          .from('carts')
          .upsert({ user_id: userId, items: [], note: '', updated_at: new Date().toISOString() });
        if (cartClearError) console.error('Failed to clear cart after order:', cartClearError.message);
      }
    } catch (err) {
      console.error('Failed to process checkout.session.completed:', err.message);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// POST /api/create-checkout
// Creates a Stripe Checkout session from the cart and returns the redirect URL.
// This runs as a Vercel serverless function.

import Stripe from 'stripe';

export const prerender = false;

export async function POST({ request }) {
  const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://oneearthgifting.co.uk';

  let items, note;
  try {
    ({ items, note } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ error: 'Cart is empty' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Build Stripe line items
  // If you have Stripe Price IDs set, use them. Otherwise use price_data (simpler, no product setup needed).
  const lineItems = items.map(item => ({
    price_data: {
      currency: 'gbp',
      product_data: {
        name: item.name,
        images: item.image ? [`${siteUrl}${item.image}`] : [],
        metadata: { slug: item.slug },
      },
      unit_amount: Math.round(item.price * 100), // pence
    },
    quantity: item.qty,
  }));

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
      shipping_address_collection: { allowed_countries: ['GB'] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'gbp' },
            display_name: 'Free UK delivery (orders of 20 or more items)',
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 395, currency: 'gbp' },
            display_name: 'Standard delivery (3 to 5 working days)',
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 695, currency: 'gbp' },
            display_name: 'Express delivery (1 to 2 working days)',
          },
        },
      ],
      metadata: {
        gift_note: note || '',
        source: 'one-earth-gifting',
      },
      custom_text: {
        submit: { message: 'Packaged plastic free and dispatched within 1 to 2 business days.' },
      },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return new Response(JSON.stringify({ error: 'Could not create checkout session. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

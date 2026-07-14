// POST /api/create-checkout
// Creates a Stripe Checkout session from the cart and returns the redirect URL.
// This runs as a Vercel serverless function.

import Stripe from 'stripe';
import { products } from '../../data/products.js';
import { PROMO_CODES } from '../../data/promoCodes.js';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';

export const prerender = false;

const FREE_DELIVERY_THRESHOLD = 50;

export async function POST({ request }) {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Payment service is not configured. Please contact support.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  const stripe = new Stripe(stripeKey);
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://oneearthgifting.com';

  let items, note, customer, userId, userEmail, promoCode;
  try {
    ({ items, note, customer, userId, userEmail, promoCode } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ error: 'Cart is empty' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  for (const item of items) {
    const product = products.find(p => p.slug === item.slug);
    if (product?.restrictedTo && product.restrictedTo !== userEmail) {
      return new Response(JSON.stringify({ error: 'This item is not available.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (!customer || !customer.name?.trim() || !customer.email?.trim() || !customer.phone?.trim()) {
    return new Response(JSON.stringify({ error: 'Name, email and contact number are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!/^\S+@\S+\.\S+$/.test(customer.email.trim())) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email address' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Normalise address to a flat string for metadata — supports both old (string) and new (object) cart formats
  const addr = customer.address;
  const addrLine = typeof addr === 'string'
    ? addr.trim()
    : [addr?.line1, addr?.line2, addr?.town, addr?.postcode].filter(Boolean).join(', ');

  if (!addrLine) {
    return new Response(JSON.stringify({ error: 'Delivery address is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const subtotal = items.reduce((s, item) => s + item.price * item.qty, 0);

  // Promo validation — wrapped in try/catch so any failure silently skips the discount
  let discounts;
  let promoApplied = false;
  if (promoCode && userId) {
    try {
      const normalisedCode = promoCode.trim().toUpperCase();
      const promo = PROMO_CODES[normalisedCode];
      if (promo) {
        const userRes = await supabaseAdmin.auth.admin.getUserById(userId);
        const promoUser = userRes?.data?.user ?? null;
        const { count: orderCount } = await supabaseAdmin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (promoUser?.email_confirmed_at && (!orderCount || orderCount === 0)) {
          const discountAmount = Math.min(subtotal * promo.rate, promo.cap);
          const coupon = await stripe.coupons.create({
            amount_off: Math.round(discountAmount * 100),
            currency: 'gbp',
            duration: 'once',
            name: promo.stripeLabel,
          });
          discounts = [{ coupon: coupon.id }];
          promoApplied = true;
        }
      }
    } catch (promoErr) {
      console.error('Promo validation error:', promoErr?.message);
    }
  }

  // Build Stripe line items
  const lineItems = items.map(item => ({
    price_data: {
      currency: 'gbp',
      product_data: {
        name: item.name,
        images: item.image ? [encodeURI(`${siteUrl}${item.image}`)] : [],
        metadata: { slug: item.slug },
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.qty,
  }));

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customer.email,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
      shipping_address_collection: { allowed_countries: ['GB'] },
      shipping_options: [
        ...(subtotal >= FREE_DELIVERY_THRESHOLD
          ? [{
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: { amount: 0, currency: 'gbp' },
                display_name: 'Free delivery over £50',
              },
            }]
          : []),
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
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: addrLine,
        user_id: userId || '',
        first_order_promo_user_id: promoApplied ? userId : '',
      },
      custom_text: {
        submit: { message: 'Packaged plastic free and dispatched within 1 to 2 business days.' },
      },
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
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

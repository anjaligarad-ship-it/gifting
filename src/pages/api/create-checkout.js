// POST /api/create-checkout
// Creates a Stripe Checkout session from the cart and returns the redirect URL.
// This runs as a Vercel serverless function.

import Stripe from 'stripe';
import { products } from '../../data/products.js';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';

export const prerender = false;

const FREE_DELIVERY_THRESHOLD = 50;
const FIRST_ORDER_DISCOUNT_RATE = 0.15;
const FIRST_ORDER_DISCOUNT_CAP = 60;

export async function POST({ request }) {
  const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
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

  if (!customer || !customer.name?.trim() || !customer.email?.trim() || !customer.phone?.trim() || !customer.address?.trim()) {
    return new Response(JSON.stringify({ error: 'Name, email, contact number and address are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!/^\S+@\S+\.\S+$/.test(customer.email.trim())) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email address' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const subtotal = items.reduce((s, item) => s + item.price * item.qty, 0);

  let discounts;
  let promoApplied = false;
  if (promoCode && promoCode.trim().toUpperCase() === 'FIRST' && userId) {
    const { data: { user: promoUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    const { count: orderCount } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (promoUser?.email_confirmed_at && (!orderCount || orderCount === 0)) {
      const discountAmount = Math.min(subtotal * FIRST_ORDER_DISCOUNT_RATE, FIRST_ORDER_DISCOUNT_CAP);
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(discountAmount * 100),
        currency: 'gbp',
        duration: 'once',
        name: 'First order — 15% off (capped at £60)',
      });
      discounts = [{ coupon: coupon.id }];
      promoApplied = true;
    }
  }

  // Build Stripe line items
  // If you have Stripe Price IDs set, use them. Otherwise use price_data (simpler, no product setup needed).
  const lineItems = items.map(item => ({
    price_data: {
      currency: 'gbp',
      product_data: {
        name: item.name,
        images: item.image ? [encodeURI(`${siteUrl}${item.image}`)] : [],
        metadata: { slug: item.slug },
      },
      unit_amount: Math.round(item.price * 100), // pence
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
        customer_address: customer.address,
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

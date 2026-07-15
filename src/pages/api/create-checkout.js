// POST /api/create-checkout
// Creates a Stripe Checkout session from the cart and returns the redirect URL.

import Stripe from 'stripe';
import { products } from '../../data/products.js';
import { PROMO_CODES } from '../../data/promoCodes.js';

export const prerender = false;

const FREE_DELIVERY_THRESHOLD = 50;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }) {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Payment service is not configured. Please contact support.' }, 503);

  const stripe = new Stripe(stripeKey);
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://oneearthgifting.com';

  let items, note, customer, userId, userEmail, promoCode;
  try {
    ({ items, note, customer, userId, userEmail, promoCode } = await request.json());
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!items || items.length === 0) return json({ error: 'Your cart is empty.' }, 400);

  for (const item of items) {
    const product = products.find(p => p.slug === item.slug);
    if (product?.restrictedTo && product.restrictedTo !== userEmail) {
      return json({ error: 'One or more items in your cart are not available.' }, 403);
    }
  }

  if (!customer?.name?.trim() || !customer?.email?.trim() || !customer?.phone?.trim()) {
    return json({ error: 'Please fill in your name, email and phone number.' }, 400);
  }

  if (!/^\S+@\S+\.\S+$/.test(customer.email.trim())) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  // Address — accept flat string (old format) or object with line1/line2/postcode
  const addr = customer.address;
  const addrLine = typeof addr === 'string'
    ? addr.trim()
    : [addr?.line1, addr?.line2, addr?.postcode].filter(Boolean).join(', ');

  if (!addrLine) return json({ error: 'Please enter your delivery address.' }, 400);

  const subtotal = items.reduce((s, item) => s + item.price * item.qty, 0);

  // Apply promo discount — code already validated client-side via /api/promo/apply
  let discounts;
  let promoApplied = false;
  if (promoCode && userId) {
    try {
      const normalisedCode = promoCode.trim().toUpperCase();
      const promo = PROMO_CODES[normalisedCode];
      if (promo) {
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
    } catch (promoErr) {
      console.error('Promo coupon error:', promoErr?.message);
    }
  }

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
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customer.email,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
      shipping_address_collection: { allowed_countries: ['GB'] },
      shipping_options: [
        ...(subtotal >= FREE_DELIVERY_THRESHOLD ? [{
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'gbp' },
            display_name: 'Free delivery (over £50)',
          },
        }] : []),
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 395, currency: 'gbp' },
            display_name: 'Standard delivery (3–5 working days)',
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 695, currency: 'gbp' },
            display_name: 'Express delivery (1–2 working days)',
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
        promo_code: promoApplied ? promoCode : '',
      },
      custom_text: {
        submit: { message: 'Packaged plastic free and dispatched within 1–2 business days.' },
      },
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return json({ error: 'We could not create your checkout session. Please try again or contact us if this continues.' }, 500);
  }
}

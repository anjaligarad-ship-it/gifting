// POST /api/create-checkout
// Creates a Stripe Checkout session from the cart and returns the redirect URL.
// This runs as a Vercel serverless function.

import Stripe from 'stripe';
import { products } from '../../data/products.js';
import { PROMO_CODES } from '../../data/promoCodes.js';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { validateAddress, formatAddress } from '../../lib/address.js';
import { SHIPPING_OPTIONS, isFreeDelivery } from '../../lib/delivery.js';

export const prerender = false;

export async function POST({ request }) {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Payment service is not configured. Please contact support.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  const stripe = new Stripe(stripeKey);
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://oneearthgifting.com';

  let items, note, customer, userId, userEmail, promoCode, isGift, recipientAddress, giftMessage, hidePrice, selectedShippingId;
  try {
    ({ items, note, customer, userId, userEmail, promoCode, isGift, recipientAddress, giftMessage, hidePrice, selectedShippingId } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ error: 'Cart is empty' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  for (const item of items) {
    const product = products.find(p => p.slug === item.slug);
    if (!product) {
      return new Response(JSON.stringify({ error: 'One or more items could not be found.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (product.comingSoon) {
      return new Response(JSON.stringify({ error: `"${product.name}" is not yet available for purchase.` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (product.restrictedTo && product.restrictedTo !== userEmail) {
      return new Response(JSON.stringify({ error: 'This item is not available.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (!customer || !customer.name?.trim() || !customer.email?.trim() || !customer.phone?.trim()) {
    return new Response(JSON.stringify({ error: 'Name, email, contact number and address are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!/^\S+@\S+\.\S+$/.test(customer.email.trim())) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email address' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Validate structured address (G1)
  const addrValidation = validateAddress(customer.address);
  if (!addrValidation.ok) {
    const firstError = Object.values(addrValidation.errors)[0];
    return new Response(JSON.stringify({ error: firstError || 'Invalid delivery address' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const structuredAddress = addrValidation.normalised;

  const subtotal  = items.reduce((s, item) => s + item.price * item.qty, 0);
  const itemCount = items.reduce((s, item) => s + item.qty, 0);

  // Stock check (D3) — query product_inventory; null = unlimited
  const slugs = items.map(i => i.slug);
  const { data: stockRows } = await supabaseAdmin
    .from('product_inventory')
    .select('slug, available_stock')
    .in('slug', slugs);
  const stockMap = Object.fromEntries((stockRows || []).map(r => [r.slug, r.available_stock]));
  for (const item of items) {
    const avail = stockMap[item.slug] ?? null; // null = unlimited
    if (avail !== null && item.qty > avail) {
      const name = item.name || item.slug;
      const msg = avail === 0 ? `${name} is out of stock.` : `Only ${avail} of ${name} left in stock.`;
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // Resolve shipping server-side — never trust the client price
  const shippingOpt = SHIPPING_OPTIONS.find(o => o.id === selectedShippingId) || SHIPPING_OPTIONS[0];
  const shippingPence = isFreeDelivery({ subtotal, itemCount }) ? 0 : shippingOpt.price;

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
      // Promo validation failed — proceed to checkout without discount
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

  // Add shipping as a line item so Stripe total matches what the customer saw
  if (shippingPence > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: { name: shippingOpt.label },
        unit_amount: shippingPence,
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customer.email,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
      shipping_address_collection: { allowed_countries: ['GB'] },
      metadata: {
        selected_shipping_id: shippingOpt.id,
        shipping_pence: String(shippingPence),
        gift_note: note || '',
        gift_message: giftMessage || '',
        is_gift: isGift ? 'true' : 'false',
        hide_price: hidePrice ? 'true' : 'false',
        source: 'one-earth-gifting',
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: formatAddress(structuredAddress),
        customer_address_json: JSON.stringify(structuredAddress),
        recipient_address_json: isGift && recipientAddress ? JSON.stringify(recipientAddress) : '',
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

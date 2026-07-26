// GET /api/inventory?slugs=slug1,slug2
// Returns available stock for the requested product slugs.
// null = unlimited, 0 = out of stock, N = available qty.
// Source of truth: products table in Supabase (stock column).
// Falls back to products.js static definition if no DB row exists.

import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { products } from '../../data/products.js';

export const prerender = false;

export async function GET({ url }) {
  const rawSlugs = url.searchParams.get('slugs') || '';
  const slugs = rawSlugs.split(',').map(s => s.trim()).filter(Boolean);
  if (slugs.length === 0) return json({});

  const { data: rows, error } = await supabaseAdmin
    .from('products')
    .select('slug, stock')
    .in('slug', slugs);

  if (error) {
    console.error('inventory fetch error:', error.message);
    // Fail open — treat as unlimited so checkout is never hard-blocked by a DB error
    return json(Object.fromEntries(slugs.map(s => [s, null])));
  }

  // 999 is the DB sentinel for "unlimited" (column is NOT NULL)
  const dbMap = Object.fromEntries((rows || []).map(r => [r.slug, r.stock >= 999 ? null : r.stock]));
  const result = {};
  for (const slug of slugs) {
    if (slug in dbMap) {
      result[slug] = dbMap[slug];
    } else {
      const product = products.find(p => p.slug === slug);
      result[slug] = product?.stock ?? null;
    }
  }

  return json(result);
}

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

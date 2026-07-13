// GET /api/inventory?slugs=slug1,slug2
// Returns available stock for the requested product slugs.
// null = unlimited, 0 = out of stock, N = available qty.

import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { products } from '../../data/products.js';

export const prerender = false;

export async function GET({ url }) {
  const rawSlugs = url.searchParams.get('slugs') || '';
  const slugs = rawSlugs.split(',').map(s => s.trim()).filter(Boolean);
  if (slugs.length === 0) {
    return json({});
  }

  // Fetch rows from product_inventory; fall back to products.js stock if no row.
  const { data: rows, error } = await supabaseAdmin
    .from('product_inventory')
    .select('slug, available_stock')
    .in('slug', slugs);

  if (error) {
    console.error('inventory fetch error:', error.message);
    // Fail open — treat as unlimited so checkout is never hard-blocked by a DB error
    return json(Object.fromEntries(slugs.map(s => [s, null])));
  }

  const result = {};
  const dbMap = Object.fromEntries((rows || []).map(r => [r.slug, r.available_stock]));

  for (const slug of slugs) {
    if (slug in dbMap) {
      result[slug] = dbMap[slug]; // DB row wins (may be 0, N, or null)
    } else {
      // No DB row: fall back to products.js stock field
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

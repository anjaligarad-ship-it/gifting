// One-off script: creates the products table (if missing) and upserts every
// product from src/data/products.js into Supabase Postgres with default stock.
// Usage: node scripts/seed-products.mjs

import pg from 'pg';
import { products } from '../src/data/products.js';

const DEFAULT_STOCK = 5;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    category_slug text NOT NULL,
    price numeric(10,2) NOT NULL,
    coming_soon boolean NOT NULL DEFAULT false,
    description text NOT NULL,
    details jsonb NOT NULL DEFAULT '[]',
    sustainability text,
    corporate text,
    images jsonb NOT NULL DEFAULT '[]',
    tags jsonb NOT NULL DEFAULT '[]',
    stock integer NOT NULL DEFAULT ${DEFAULT_STOCK},
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`);

await client.query(`ALTER TABLE products ENABLE ROW LEVEL SECURITY;`);

await client.query(`
  DROP POLICY IF EXISTS "Public read access" ON products;
  CREATE POLICY "Public read access" ON products FOR SELECT USING (true);
`);

for (const p of products) {
  await client.query(
    `INSERT INTO products (slug, name, category, category_slug, price, coming_soon, description, details, sustainability, corporate, images, tags, stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       category_slug = EXCLUDED.category_slug,
       price = EXCLUDED.price,
       coming_soon = EXCLUDED.coming_soon,
       description = EXCLUDED.description,
       details = EXCLUDED.details,
       sustainability = EXCLUDED.sustainability,
       corporate = EXCLUDED.corporate,
       images = EXCLUDED.images,
       tags = EXCLUDED.tags,
       updated_at = now()`,
    [
      p.slug,
      p.name,
      p.category,
      p.categorySlug,
      p.price,
      !!p.comingSoon,
      p.description,
      JSON.stringify(p.details || []),
      p.sustainability || null,
      p.corporate || null,
      JSON.stringify(p.images || []),
      JSON.stringify(p.tags || []),
      DEFAULT_STOCK,
    ]
  );
  console.log(`Upserted: ${p.slug}`);
}

const { rows } = await client.query('SELECT slug, name, price, stock FROM products ORDER BY name');
console.log('\nFinal product inventory:');
for (const r of rows) console.log(`  ${r.name} — £${r.price} — stock: ${r.stock}`);

await client.end();

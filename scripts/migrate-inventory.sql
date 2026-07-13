-- D3: Product inventory table
-- Run once in Supabase SQL Editor or via psql.

CREATE TABLE IF NOT EXISTS product_inventory (
  slug            TEXT PRIMARY KEY,
  available_stock INTEGER,         -- NULL = unlimited
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic stock decrement used by the Stripe webhook.
-- Clamps to 0 so available_stock never goes negative.
CREATE OR REPLACE FUNCTION decrement_stock(p_slug TEXT, p_qty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE product_inventory
  SET
    available_stock = GREATEST(0, available_stock - p_qty),
    updated_at = NOW()
  WHERE slug = p_slug
    AND available_stock IS NOT NULL;
END;
$$;

-- Seed initial stock from products.js values.
-- All products start unlimited (NULL). Update these rows to set finite stock.
INSERT INTO product_inventory (slug, available_stock) VALUES
  ('your-carbon-karma-jenga-set',              NULL),
  ('blooming-placemat-set-of-4',               NULL),
  ('earth-tones-placemat-set-of-2',            NULL),
  ('earth-tones-collection',                   NULL),
  ('little-guardian-hamper',                   NULL),
  ('coaster-set-of-5',                         NULL),
  ('ever-bloom-bookmark',                      NULL),
  ('hand-embroidered-colours-of-life-tote-bag',NULL),
  ('midnight-hummingbird-paperweight',         NULL),
  ('internal-payment-test',                    NULL)
ON CONFLICT (slug) DO NOTHING;

-- Row Level Security: service role only (API routes use supabaseAdmin = service key)
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON product_inventory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

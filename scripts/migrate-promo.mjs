// One-off script: creates the first_discount_claims table used by the
// "FIRST" first-order-discount OTP verification flow.
// Usage: node scripts/migrate-promo.mjs

import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS first_discount_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text UNIQUE NOT NULL,
    otp_code text,
    otp_expires_at timestamptz,
    otp_attempts int NOT NULL DEFAULT 0,
    send_count int NOT NULL DEFAULT 0,
    last_sent_at timestamptz,
    verified boolean NOT NULL DEFAULT false,
    verified_at timestamptz,
    redeemed boolean NOT NULL DEFAULT false,
    redeemed_at timestamptz,
    order_used boolean NOT NULL DEFAULT false,
    order_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_first_discount_claims_phone ON first_discount_claims(phone);
  ALTER TABLE first_discount_claims ENABLE ROW LEVEL SECURITY;
`);
console.log('first_discount_claims table ready (RLS enabled, no policies — service_role only)');

await client.end();
console.log('\nMigration complete.');

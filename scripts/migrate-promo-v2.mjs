// One-off script: links first_discount_claims to the logged-in account,
// since FIRST eligibility is now gated by account order history, not just
// phone/email. Usage: node scripts/migrate-promo-v2.mjs

import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  ALTER TABLE first_discount_claims ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_first_discount_claims_user_id ON first_discount_claims(user_id) WHERE user_id IS NOT NULL;
`);
console.log('first_discount_claims.user_id ready');

await client.end();
console.log('\nMigration complete.');

// One-off script: creates profiles, carts, and orders tables + RLS policies
// + an auto-profile-creation trigger on new auth.users signups.
// Usage: node scripts/migrate-accounts.mjs

import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    address text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
  CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
`);
console.log('profiles table ready');

await client.query(`
  CREATE TABLE IF NOT EXISTS carts (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    items jsonb NOT NULL DEFAULT '[]',
    note text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users manage own cart" ON carts;
  CREATE POLICY "Users manage own cart" ON carts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`);
console.log('carts table ready');

await client.query(`
  CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    stripe_session_id text UNIQUE NOT NULL,
    items jsonb NOT NULL DEFAULT '[]',
    total numeric(10,2) NOT NULL,
    currency text NOT NULL DEFAULT 'gbp',
    status text NOT NULL DEFAULT 'paid',
    customer_name text,
    customer_email text,
    customer_phone text,
    customer_address text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users view own orders" ON orders;
  CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
`);
console.log('orders table ready');

await client.query(`
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger AS $$
  BEGIN
    INSERT INTO public.profiles (id, name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
`);

await client.query(`
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`);
console.log('auto-profile trigger ready');

// Backfill profiles for any existing users created before this migration
await client.query(`
  INSERT INTO public.profiles (id, name, email)
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', ''), COALESCE(email, '')
  FROM auth.users
  ON CONFLICT (id) DO NOTHING;
`);
console.log('backfilled profiles for existing users');

await client.end();
console.log('\nMigration complete.');

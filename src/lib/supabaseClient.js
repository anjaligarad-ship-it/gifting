// Browser Supabase client — safe to import in client-side scripts.
// Uses the PUBLIC_ prefixed env vars, which Astro/Vite inline into the client bundle.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

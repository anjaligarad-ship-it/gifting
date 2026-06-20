// Server-only Supabase client using the service_role key — bypasses RLS.
// Never import this in client-side/browser code.
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

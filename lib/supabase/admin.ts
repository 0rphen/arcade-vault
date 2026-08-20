import { createClient } from "@supabase/supabase-js";

// Cliente con service role: bypassa RLS. Uso exclusivo server-side
// para tablas sin políticas públicas (ej. auth_rate_limits).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

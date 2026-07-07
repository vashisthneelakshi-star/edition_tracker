import { createClient } from "@supabase/supabase-js";

// SERVICE ROLE KEY — this bypasses Row Level Security entirely.
// NEVER import this file in a Client Component. NEVER prefix the env var
// with NEXT_PUBLIC_. Only use inside app/api/**/route.ts server code, and
// only after checking the calling user is an Admin (see get-profile.ts).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

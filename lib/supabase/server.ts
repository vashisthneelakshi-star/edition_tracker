import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Use this in Server Components, Server Actions, and Route Handlers.
// Matches the same connection your Director's Command Center scaffold uses —
// point NEXT_PUBLIC_SUPABASE_URL / SUPABASE keys at the same project so both
// dashboards share one database.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore if you
            // have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

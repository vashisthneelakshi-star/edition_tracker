import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/permissions";

export type { Role };
// Re-exported for convenience in Server Components — these are still pure
// functions, but keep imports in "use client" files pointed at
// "@/lib/auth/permissions" directly so next/headers never gets pulled into
// the client bundle.
export { canWrite, canDelete, canAdminister } from "@/lib/auth/permissions";

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: "VIEWER" as Role };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  return {
    user,
    role: (profile?.role as Role) ?? "VIEWER",
    fullName: profile?.full_name as string | undefined,
  };
}

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import ContentPlanningClient from "./content-planning-client";

export const dynamic = "force-dynamic";
const DEFAULT_PAGE_SIZE = 10;

export default async function ContentPlanningPage() {
  const supabase = await createClient();
  const { role } = await getProfile();

  // Only the first page loads on the server — everything else (filters,
  // sort, further pages) is fetched on demand by the client component.
  const { data: plans, count } = await supabase
    .from("content_plans")
    .select("*", { count: "exact" })
    .eq("timeframe", "DAILY")
    .order("due_at", { ascending: true })
    .range(0, DEFAULT_PAGE_SIZE - 1);

  const { data: labelRows } = await supabase.from("ui_labels").select("key, value");
  const labels: Record<string, string> = {};
  labelRows?.forEach((l) => (labels[l.key] = l.value));

  return (
    <ContentPlanningClient
      initialPlans={plans ?? []}
      initialTotal={count ?? 0}
      role={role}
      labels={labels}
    />
  );
}

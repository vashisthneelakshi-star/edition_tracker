import { redirect } from "next/navigation";
import { getProfile, canAdminister } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import LabelsClient from "./labels-client";

export const dynamic = "force-dynamic";

export default async function AdminLabelsPage() {
  const { role } = await getProfile();
  if (!canAdminister(role)) {
    redirect("/content-planning");
  }

  const supabase = await createClient();
  const { data: labels } = await supabase.from("ui_labels").select("*").order("key");

  return <LabelsClient initialLabels={labels ?? []} />;
}

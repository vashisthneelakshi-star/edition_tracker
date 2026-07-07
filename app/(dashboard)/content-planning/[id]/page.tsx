import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import DetailClient from "./detail-client";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { role } = await getProfile();

  const { data: plan } = await supabase.from("content_plans").select("*").eq("id", id).single();
  if (!plan) notFound();

  return <DetailClient plan={plan} role={role} />;
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/content-plans/meta — distinct owners for the filter dropdown.
// Capped at 5000 rows scanned; fine for filter-dropdown purposes even at
// large data volumes since the number of distinct owners stays small.
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_plans")
    .select("owner")
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const owners = Array.from(new Set((data ?? []).map((r) => r.owner))).sort();
  return NextResponse.json({ owners });
}

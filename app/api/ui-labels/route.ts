import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ui_labels").select("*").order("key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST upserts a label (key, value). RLS policies restrict writes to Admin.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { key, value } = await request.json();

  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ui_labels")
    .upsert({ key, value }, { onConflict: "key" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

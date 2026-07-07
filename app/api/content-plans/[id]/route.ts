import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/content-plans/:id
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const updatable: Record<string, unknown> = {};
  if (body.title) updatable.title = body.title;
  if (body.owner) updatable.owner = body.owner;
  if (body.status) updatable.status = body.status;
  if (body.dueAt) updatable.due_at = body.dueAt;
  if (body.level) updatable.level = body.level;
  if (body.timeframe) updatable.timeframe = body.timeframe;

  const { data, error } = await supabase
    .from("content_plans")
    .update(updatable)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// DELETE /api/content-plans/:id
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("content_plans").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

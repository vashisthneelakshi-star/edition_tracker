import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/content-plans?timeframe=DAILY&levels=STATE,EDITION&owners=A,B
//     &search=foo&dateFrom=...&dateTo=...&sortKey=due_at&sortDir=asc
//     &page=1&pageSize=10
// Everything happens IN the database — nothing loads into the browser
// beyond the current page, so this stays fast at any data volume.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const timeframe = searchParams.get("timeframe");
  const levels = searchParams.get("levels")?.split(",").filter(Boolean) ?? [];
  const owners = searchParams.get("owners")?.split(",").filter(Boolean) ?? [];
  const search = searchParams.get("search")?.trim();
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const ids = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  const sortKey = searchParams.get("sortKey") ?? "due_at";
  const sortDir = searchParams.get("sortDir") === "desc" ? false : true;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(5000, Math.max(1, Number(searchParams.get("pageSize") ?? 10)));

  const allowedSortKeys = ["title", "owner", "due_at", "status", "level"];
  const safeSortKey = allowedSortKeys.includes(sortKey) ? sortKey : "due_at";

  let query = supabase.from("content_plans").select("*", { count: "exact" });

  if (ids.length) {
    // Exact-ids mode: used to export precisely the rows the user selected,
    // regardless of which page they're currently viewing.
    query = query.in("id", ids);
  } else {
    if (timeframe) query = query.eq("timeframe", timeframe);
    if (levels.length) query = query.in("level", levels);
    if (owners.length) query = query.in("owner", owners);
    if (search) query = query.or(`title.ilike.%${search}%,owner.ilike.%${search}%`);
    if (dateFrom) query = query.gte("due_at", dateFrom);
    if (dateTo) query = query.lte("due_at", dateTo);
  }

  query = query
    .order(safeSortKey, { ascending: sortDir })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0, page, pageSize });
}

// POST /api/content-plans  { timeframe, level, title, owner, dueAt, status }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const required = ["timeframe", "level", "title", "owner", "dueAt", "status"];
  const missing = required.filter((f) => !body[f]);
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing fields: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("content_plans")
    .insert({
      timeframe: body.timeframe,
      level: body.level,
      title: body.title,
      owner: body.owner,
      due_at: body.dueAt,
      status: body.status,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

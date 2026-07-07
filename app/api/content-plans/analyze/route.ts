import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/content-plans/analyze  { ids: string[] }
// Analyzes ONLY the plans the user selected — never the whole table.
export async function POST(request: NextRequest) {
  const { ids } = await request.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "Select at least one plan to analyze." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("content_plans")
    .select("*")
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!plans || plans.length === 0) {
    return NextResponse.json({ error: "No matching plans found." }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set on the server. Add it to .env.local / Vercel env vars." },
      { status: 500 }
    );
  }

  const now = new Date();
  const summaryInput = plans.map((p) => ({
    title: p.title,
    level: p.level,
    owner: p.owner,
    status: p.status,
    due_at: p.due_at,
    overdue: new Date(p.due_at) < now && !["APPROVED", "SUBMITTED"].includes(p.status),
  }));

  const prompt = `You are analyzing a newspaper's content planning data for Rajasthan Patrika.
Below is a JSON array of ${plans.length} selected content plan(s). Produce a concise analysis with these exact sections:
1. Summary (2-3 sentences)
2. Delays & Risks (which plans are overdue or at risk, and why)
3. Recommendations (specific, actionable, max 5 bullets)

Data:
${JSON.stringify(summaryInput, null, 2)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `OpenAI error: ${errText}` }, { status: 502 });
    }

    const json = await res.json();
    const analysis = json.choices?.[0]?.message?.content ?? "No analysis returned.";

    return NextResponse.json({ analysis, analyzedCount: plans.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error calling OpenAI" },
      { status: 500 }
    );
  }
}

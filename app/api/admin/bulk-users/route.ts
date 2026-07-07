import { NextRequest, NextResponse } from "next/server";
import { getProfile, canAdminister } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = ["ADMIN", "STATE_HEAD", "EDITOR", "VIEWER"];
const MAX_BATCH = 50; // keep each request small so it finishes well within any serverless timeout

type Row = { email: string; fullName?: string; role?: string };
type Result = {
  email: string;
  status: "created" | "failed" | "already_exists";
  tempPassword?: string;
  error?: string;
};

function generateTempPassword() {
  // 12-char password: readable, meets typical complexity rules
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// POST /api/admin/bulk-users  { rows: [{ email, fullName, role }] }
// Send at most 50 rows per call — the Admin Panel UI loops in batches.
export async function POST(request: NextRequest) {
  const { role: callerRole } = await getProfile();
  if (!canAdminister(callerRole)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const rows: Row[] = Array.isArray(body.rows) ? body.rows : [];

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows provided." }, { status: 400 });
  }
  if (rows.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Max ${MAX_BATCH} rows per request — send in batches.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const results: Result[] = [];

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) {
      results.push({ email: row.email ?? "(blank)", status: "failed", error: "Missing email" });
      continue;
    }
    const role = VALID_ROLES.includes(row.role ?? "") ? row.role! : "VIEWER";
    const tempPassword = generateTempPassword();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: row.fullName ?? "" },
    });

    if (error) {
      const alreadyExists = /already registered|already exists/i.test(error.message);
      results.push({
        email,
        status: alreadyExists ? "already_exists" : "failed",
        error: error.message,
      });
      continue;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: data.user.id, full_name: row.fullName ?? null, role }, { onConflict: "id" });

    if (profileError) {
      results.push({ email, status: "failed", error: `User created but profile failed: ${profileError.message}` });
      continue;
    }

    results.push({ email, status: "created", tempPassword });
  }

  return NextResponse.json({ results });
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { target_user_id, requester_id } = await req.json();

    const { data: requesterProfile, error: reqErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requester_id)
      .single();

    if (reqErr || requesterProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only an Admin can delete users.' }, { status: 403 });
    }

    // Deleting the auth user cascades to the profiles row (on delete cascade in schema)
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

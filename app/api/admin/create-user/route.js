import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// This route runs on the server only, so it's safe to use the service role key here.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { email, password, full_name, role, state_id, scopes, requester_id } = await req.json();

    // Verify the requester is an admin before allowing user creation
    const { data: requesterProfile, error: reqErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requester_id)
      .single();

    if (reqErr || requesterProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only an Admin can create new users.' }, { status: 403 });
    }

    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: userData.user.id,
      full_name,
      role,
      state_id: role === 'state_head' ? state_id : null,
    });
    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 });

    if (role === 'edition_incharge' && Array.isArray(scopes) && scopes.length > 0) {
      const { error: scopeErr } = await supabaseAdmin.from('incharge_scopes').insert(
        scopes.map(s => ({ profile_id: userData.user.id, state_id: s.state_id, branch: s.branch }))
      );
      if (scopeErr) return NextResponse.json({ error: scopeErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user_id: userData.user.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

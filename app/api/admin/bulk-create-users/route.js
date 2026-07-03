import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { users, requester_id } = await req.json();

    const { data: requesterProfile, error: reqErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requester_id)
      .single();

    if (reqErr || requesterProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only an Admin can create users.' }, { status: 403 });
    }

    const results = [];

    for (const u of users) {
      try {
        const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
        });
        if (createErr) throw new Error(createErr.message);

        const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
          id: userData.user.id,
          full_name: u.full_name,
          role: u.role,
          state_id: (u.role === 'state_head' || u.role === 'edition_incharge') ? u.state_id : null,
          branch: u.role === 'edition_incharge' ? u.branch : null,
        });
        if (profileErr) throw new Error(profileErr.message);

        results.push({ email: u.email, success: true });
      } catch (e) {
        results.push({ email: u.email, success: false, error: e.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

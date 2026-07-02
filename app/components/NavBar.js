'use client';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function NavBar({ profile }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <nav>
      {profile?.role === 'edition_incharge' && <a href="/entry">Daily Entry</a>}
      {(profile?.role === 'admin' || profile?.role === 'state_head') && (
        <>
          <a href="/dashboard">Dashboard</a>
          <a href="/reports">Reports</a>
        </>
      )}
      {profile?.role === 'admin' && (
        <>
          <a href="/admin/states">States</a>
          <a href="/admin/editions">Editions</a>
          <a href="/admin/users">Users</a>
          <a href="/admin/telegram">Telegram</a>
        </>
      )}
      <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} style={{ marginLeft: 'auto' }}>
        Logout
      </a>
    </nav>
  );
}

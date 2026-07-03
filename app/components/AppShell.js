'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

function NavLink({ href, children, onClick }) {
  return (
    <a href={href} className="sidebar-link" onClick={onClick}>
      {children}
    </a>
  );
}

export default function AppShell({ profile, children }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const close = () => setOpen(false);

  return (
    <div className="shell">
      <button className="hamburger" onClick={() => setOpen(!open)} aria-label="Menu">
        ☰
      </button>

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">Patrika Group</div>
          <div className="sidebar-subtitle">Page Timing System</div>
        </div>

        <nav className="sidebar-nav">
          {profile?.role === 'edition_incharge' && (
            <NavLink href="/entry" onClick={close}>Daily Entry</NavLink>
          )}
          {(profile?.role === 'admin' || profile?.role === 'state_head') && (
            <NavLink href="/dashboard" onClick={close}>Dashboard</NavLink>
          )}
          <NavLink href="/reports" onClick={close}>
            {profile?.role === 'edition_incharge' ? 'My Reports' : 'Reports'}
          </NavLink>
          {profile?.role === 'admin' && (
            <>
              <div className="sidebar-section">Admin</div>
              <NavLink href="/admin/states" onClick={close}>States</NavLink>
              <NavLink href="/admin/editions" onClick={close}>Editions</NavLink>
              <NavLink href="/admin/users" onClick={close}>Users</NavLink>
              <NavLink href="/admin/telegram" onClick={close}>Telegram</NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {profile?.full_name && <div className="sidebar-user">{profile.full_name}</div>}
          <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} className="sidebar-logout">
            Logout
          </a>
        </div>
      </aside>

      {open && <div className="sidebar-backdrop" onClick={close} />}

      <main className="main-content">{children}</main>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import NavBar from '../../components/NavBar';

export default function UsersAdminPage() {
  const { profile, user } = useProfile();
  const [states, setStates] = useState([]);
  const [editions, setEditions] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', role: 'edition_incharge', state_id: '', edition_id: '',
  });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: st } = await supabase.from('states').select('*').order('name');
    setStates(st || []);
    const { data: ed } = await supabase.from('editions').select('*, states(name)').order('name');
    setEditions(ed || []);
    const { data: pr } = await supabase.from('profiles').select('*, states(name), editions(name)').order('created_at', { ascending: false });
    setUsers(pr || []);
  }
  useEffect(() => { load(); }, []);

  async function addUser(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setSaving(true);
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, requester_id: user.id }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(json.error); return; }
    setMsg(`User ban gaya: ${form.email}`);
    setForm({ email: '', password: '', full_name: '', role: 'edition_incharge', state_id: '', edition_id: '' });
    load();
  }

  return (
    <>
      <NavBar profile={profile} />
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="card">
          <h2>Naya User Banayein</h2>
          <form onSubmit={addUser}>
            <label>Full Name</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />

            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />

            <label>Password (Temporary - user baad me badal sakta hai)</label>
            <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />

            <label>Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin (Full Power)</option>
              <option value="state_head">State Head</option>
              <option value="edition_incharge">Edition Incharge</option>
            </select>

            {form.role === 'state_head' && (
              <>
                <label>State</label>
                <select value={form.state_id} onChange={e => setForm({ ...form, state_id: e.target.value })} required>
                  <option value="">-- Select State --</option>
                  {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </>
            )}

            {form.role === 'edition_incharge' && (
              <>
                <label>Edition</label>
                <select value={form.edition_id} onChange={e => setForm({ ...form, edition_id: e.target.value })} required>
                  <option value="">-- Select Edition --</option>
                  {editions.map(ed => <option key={ed.id} value={ed.id}>{ed.name} - {ed.pullout || 'MAIN'} ({ed.states?.name})</option>)}
                </select>
              </>
            )}

            {err && <div className="error">{err}</div>}
            {msg && <div className="success">{msg}</div>}
            <button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
          </form>
        </div>

        <div className="card">
          <h3>Existing Users</h3>
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Scope</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.role}</td>
                  <td>{u.role === 'state_head' ? u.states?.name : u.role === 'edition_incharge' ? u.editions?.name : 'All'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

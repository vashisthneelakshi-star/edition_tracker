'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import NavBar from '../../components/NavBar';

export default function UsersAdminPage() {
  const { profile, user } = useProfile();
  const [states, setStates] = useState([]);
  const [branchesByState, setBranchesByState] = useState({});
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', role: 'edition_incharge', state_id: '', branch: '',
  });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: st } = await supabase.from('states').select('*').order('name');
    setStates(st || []);

    const { data: ed } = await supabase.from('editions').select('state_id, branch');
    const grouped = {};
    (ed || []).forEach(e => {
      if (!e.branch) return;
      if (!grouped[e.state_id]) grouped[e.state_id] = new Set();
      grouped[e.state_id].add(e.branch);
    });
    const asArrays = {};
    Object.keys(grouped).forEach(k => { asArrays[k] = [...grouped[k]].sort(); });
    setBranchesByState(asArrays);

    const { data: pr } = await supabase.from('profiles').select('*, states(name)').order('created_at', { ascending: false });
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
    setMsg(`User created: ${form.email}`);
    setForm({ email: '', password: '', full_name: '', role: 'edition_incharge', state_id: '', branch: '' });
    load();
  }

  async function deleteUser(u) {
    if (!confirm(`Delete user "${u.full_name}" (${u.role})? This cannot be undone.`)) return;
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: u.id, requester_id: user.id }),
    });
    const json = await res.json();
    if (!res.ok) { alert('Delete failed: ' + json.error); return; }
    load();
  }

  const availableBranches = branchesByState[form.state_id] || [];

  return (
    <>
      <NavBar profile={profile} />
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="card">
          <h2>Create New User</h2>
          <form onSubmit={addUser}>
            <label>Full Name</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />

            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />

            <label>Password (Temporary - user can change it later)</label>
            <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />

            <label>Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, branch: '' })}>
              <option value="admin">Admin (Full Access)</option>
              <option value="state_head">State Head</option>
              <option value="edition_incharge">Edition Incharge</option>
            </select>

            {(form.role === 'state_head' || form.role === 'edition_incharge') && (
              <>
                <label>State</label>
                <select value={form.state_id} onChange={e => setForm({ ...form, state_id: e.target.value, branch: '' })} required>
                  <option value="">-- Select State --</option>
                  {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </>
            )}

            {form.role === 'edition_incharge' && (
              <>
                <label>Branch (locks all editions/pullouts under this branch)</label>
                <select value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} required>
                  <option value="">-- Select Branch --</option>
                  {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {form.state_id && availableBranches.length === 0 && (
                  <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                    No branches found for this state yet — add editions first (Admin → Editions).
                  </div>
                )}
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
            <thead><tr><th>Name</th><th>Role</th><th>Scope</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.role}</td>
                  <td>
                    {u.role === 'state_head' && u.states?.name}
                    {u.role === 'edition_incharge' && `${u.states?.name || ''} - ${u.branch || ''}`}
                    {u.role === 'admin' && 'All'}
                  </td>
                  <td>
                    <a href="#" onClick={(e) => { e.preventDefault(); deleteUser(u); }} style={{ color: '#c8102e' }}>
                      Delete
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

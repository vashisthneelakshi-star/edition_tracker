'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import AppShell from '../../components/AppShell';

export default function StatesAdminPage() {
  const { profile } = useProfile();
  const [states, setStates] = useState([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase.from('states').select('*').order('name');
    setStates(data || []);
  }
  useEffect(() => { load(); }, []);

  async function addState(e) {
    e.preventDefault();
    setErr('');
    const { error } = await supabase.from('states').insert({ name: name.trim() });
    if (error) { setErr(error.message); return; }
    setName('');
    load();
  }

  async function removeState(id) {
    if (!confirm('Delete this state? All editions linked to it will also be deleted.')) return;
    await supabase.from('states').delete().eq('id', id);
    load();
  }

  return (
    <AppShell profile={profile}>
      <div className="container">
        <div className="card">
          <h2>Manage States</h2>
          <form onSubmit={addState} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label>New State Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rajasthan" required />
            </div>
            <button type="submit">Add</button>
          </form>
          {err && <div className="error">{err}</div>}
        </div>

        <div className="card">
          <table>
            <thead><tr><th>State</th><th></th></tr></thead>
            <tbody>
              {states.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); removeState(s.id); }}>Delete</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

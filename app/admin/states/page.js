'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import NavBar from '../../components/NavBar';

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
    if (!confirm('State delete karna hai? Isse jude editions bhi delete ho jayenge.')) return;
    await supabase.from('states').delete().eq('id', id);
    load();
  }

  return (
    <>
      <NavBar profile={profile} />
      <div className="container">
        <div className="card">
          <h2>States Manage Karein</h2>
          <form onSubmit={addState} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label>Naya State Naam</label>
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
    </>
  );
}

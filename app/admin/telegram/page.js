'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import NavBar from '../../components/NavBar';

export default function TelegramAdminPage() {
  const { profile } = useProfile();
  const [states, setStates] = useState([]);
  const [editions, setEditions] = useState([]);
  const [links, setLinks] = useState([]);
  const [form, setForm] = useState({
    scope_type: 'edition', state_id: '', edition_id: '', chat_id: '', label: '', frequency: 'daily',
  });
  const [err, setErr] = useState('');

  async function load() {
    const { data: st } = await supabase.from('states').select('*').order('name');
    setStates(st || []);
    const { data: ed } = await supabase.from('editions').select('*, states(name)').order('name');
    setEditions(ed || []);
    const { data: lk } = await supabase
      .from('telegram_links')
      .select('*, editions(name, branch, pullout, states(name)), states(name)')
      .order('created_at', { ascending: false });
    setLinks(lk || []);
  }
  useEffect(() => { load(); }, []);

  async function addLink(e) {
    e.preventDefault();
    setErr('');
    const payload = {
      scope_type: form.scope_type,
      chat_id: form.chat_id,
      label: form.label,
      frequency: form.frequency,
      state_id: form.scope_type === 'state' ? form.state_id : null,
      edition_id: form.scope_type === 'edition' ? form.edition_id : null,
    };
    const { error } = await supabase.from('telegram_links').insert(payload);
    if (error) { setErr(error.message); return; }
    setForm({ scope_type: 'edition', state_id: '', edition_id: '', chat_id: '', label: '', frequency: 'daily' });
    load();
  }

  async function removeLink(id) {
    await supabase.from('telegram_links').delete().eq('id', id);
    load();
  }

  function describeScope(link) {
    if (link.scope_type === 'state') {
      return `All editions — ${link.states?.name || '—'} (State-wide)`;
    }
    const e = link.editions;
    if (!e) return '—';
    return `${e.name} - ${e.pullout || 'MAIN'} (${e.branch || '—'}, ${e.states?.name || '—'})`;
  }

  return (
    <>
      <NavBar profile={profile} />
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="card">
          <h2>Telegram Report Recipients</h2>
          <p style={{ fontSize: 13, color: '#666' }}>
            Each recipient needs their Telegram Chat ID. They must send <b>/start</b> to the bot first,
            then follow the "Get chat_id" step described in the README.
          </p>
          <form onSubmit={addLink}>
            <label>Recipient Type</label>
            <select value={form.scope_type} onChange={e => setForm({ ...form, scope_type: e.target.value, state_id: '', edition_id: '' })}>
              <option value="edition">Specific Edition (e.g. Edition Incharge)</option>
              <option value="state">Entire State (e.g. State Head — gets all editions in that state)</option>
            </select>

            {form.scope_type === 'state' ? (
              <>
                <label>State</label>
                <select value={form.state_id} onChange={e => setForm({ ...form, state_id: e.target.value })} required>
                  <option value="">-- Select State --</option>
                  {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </>
            ) : (
              <>
                <label>Edition</label>
                <select value={form.edition_id} onChange={e => setForm({ ...form, edition_id: e.target.value })} required>
                  <option value="">-- Select Edition --</option>
                  {editions.map(ed => (
                    <option key={ed.id} value={ed.id}>
                      {ed.name} - {ed.pullout || 'MAIN'} ({ed.branch || '—'}, {ed.states?.name})
                    </option>
                  ))}
                </select>
              </>
            )}

            <label>Recipient Label (name/designation)</label>
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. State Head - Rajasthan" required />

            <label>Telegram Chat ID</label>
            <input value={form.chat_id} onChange={e => setForm({ ...form, chat_id: e.target.value })} placeholder="e.g. 123456789" required />

            <label>Frequency</label>
            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="half_yearly">Half Yearly</option>
              <option value="yearly">Yearly</option>
            </select>

            {err && <div className="error">{err}</div>}
            <button type="submit">Add Recipient</button>
          </form>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Recipient</th><th>Scope</th><th>Chat ID</th><th>Frequency</th><th></th></tr></thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id}>
                  <td>{l.label}</td>
                  <td>{describeScope(l)}</td>
                  <td>{l.chat_id}</td>
                  <td>{l.frequency}</td>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); removeLink(l.id); }} style={{ color: '#c8102e' }}>Remove</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

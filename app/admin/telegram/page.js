'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import NavBar from '../../components/NavBar';

export default function TelegramAdminPage() {
  const { profile } = useProfile();
  const [editions, setEditions] = useState([]);
  const [links, setLinks] = useState([]);
  const [form, setForm] = useState({ edition_id: '', chat_id: '', label: '', frequency: 'daily' });
  const [err, setErr] = useState('');

  async function load() {
    const { data: ed } = await supabase.from('editions').select('*, states(name)').order('name');
    setEditions(ed || []);
    const { data: lk } = await supabase.from('telegram_links').select('*, editions(name)').order('created_at', { ascending: false });
    setLinks(lk || []);
  }
  useEffect(() => { load(); }, []);

  async function addLink(e) {
    e.preventDefault();
    setErr('');
    const { error } = await supabase.from('telegram_links').insert(form);
    if (error) { setErr(error.message); return; }
    setForm({ edition_id: '', chat_id: '', label: '', frequency: 'daily' });
    load();
  }

  async function removeLink(id) {
    await supabase.from('telegram_links').delete().eq('id', id);
    load();
  }

  return (
    <>
      <NavBar profile={profile} />
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="card">
          <h2>Telegram Report Recipients</h2>
          <p style={{ fontSize: 13, color: '#666' }}>
            Each recipient needs their Telegram Chat ID. They must send <b>/start</b> to the bot first,
            then follow the "Get chat_id" step described in the README.
          </p>
          <form onSubmit={addLink}>
            <label>Edition</label>
            <select value={form.edition_id} onChange={e => setForm({ ...form, edition_id: e.target.value })} required>
              <option value="">-- Select Edition --</option>
              {editions.map(ed => <option key={ed.id} value={ed.id}>{ed.name} ({ed.states?.name})</option>)}
            </select>

            <label>Recipient Label (naam/designation)</label>
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

        <div className="card">
          <table>
            <thead><tr><th>Edition</th><th>Recipient</th><th>Chat ID</th><th>Frequency</th><th></th></tr></thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id}>
                  <td>{l.editions?.name}</td>
                  <td>{l.label}</td>
                  <td>{l.chat_id}</td>
                  <td>{l.frequency}</td>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); removeLink(l.id); }}>Remove</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

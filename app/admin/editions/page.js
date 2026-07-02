'use client';
import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import AppShell from '../../components/AppShell';

// Handles both "HH:MM" and full datetime strings like "2026-06-30 23:00:00"
function extractTime(raw) {
  if (!raw) return '';
  const match = raw.match(/(\d{1,2}):(\d{2})(:\d{2})?/);
  if (!match) return '';
  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  return `${hh}:${mm}`;
}

export default function EditionsAdminPage() {
  const { profile } = useProfile();
  const [states, setStates] = useState([]);
  const [editions, setEditions] = useState([]);
  const [form, setForm] = useState({ name: '', state_id: '', branch: '', pullout: 'MAIN', schedule_page_time: '' });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // Bulk import state
  const [csvRows, setCsvRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState('');
  const fileInputRef = useRef(null);

  async function load() {
    const { data: st } = await supabase.from('states').select('*').order('name');
    setStates(st || []);
    const { data: ed } = await supabase.from('editions').select('*, states(name)').order('name');
    setEditions(ed || []);
  }
  useEffect(() => { load(); }, []);

  // ---------- Single add (always available for future new editions) ----------
  async function addEdition(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!form.state_id) { setErr('Please select a state'); return; }
    const { error } = await supabase.from('editions').insert({
      name: form.name.trim(),
      state_id: form.state_id,
      branch: form.branch.trim(),
      pullout: form.pullout.trim() || 'MAIN',
      schedule_page_time: form.schedule_page_time,
    });
    if (error) { setErr(error.message); return; }
    setForm({ name: '', state_id: '', branch: '', pullout: 'MAIN', schedule_page_time: '' });
    setMsg('Edition add ho gaya.');
    load();
  }

  // ---------- Inline editing of existing rows ----------
  async function updateField(ed, field, value) {
    const { error } = await supabase.from('editions').update({ [field]: value }).eq('id', ed.id);
    if (error) { alert('Update fail hua: ' + error.message); return; }
    load();
  }

  async function toggleActive(ed) {
    await supabase.from('editions').update({ active: !ed.active }).eq('id', ed.id);
    load();
  }

  async function deleteEdition(ed) {
    if (!confirm(`Delete "${ed.name}" (${ed.pullout})? All entry data for it will also be deleted.`)) return;
    await supabase.from('editions').delete().eq('id', ed.id);
    load();
  }

  // ---------- Bulk CSV import ----------
  // Expected CSV columns (header row required): State, Branch, Edition, Pullout, Schedule time
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportErr('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data
          .map(r => ({
            state: (r.State || r.state || '').trim(),
            branch: (r.Branch || r.branch || '').trim(),
            name: (r.Edition || r.edition || r.name || '').trim(),
            pullout: (r.Pullout || r.pullout || 'MAIN').trim() || 'MAIN',
            schedule_page_time: extractTime(r['Schedule time'] || r.Schedule_time || r.schedule_page_time || ''),
          }))
          .filter(r => r.name && r.state && r.schedule_page_time);
        if (rows.length === 0) {
          setImportErr('No valid rows found in CSV. Header line must be "State,Branch,Edition,Pullout,Schedule time".');
          return;
        }
        setCsvRows(rows);
      },
      error: (error) => setImportErr('Could not parse CSV: ' + error.message),
    });
  }

  async function confirmImport() {
    setImporting(true);
    setImportErr('');
    try {
      // 1. Ensure all states exist
      const uniqueStateNames = [...new Set(csvRows.map(r => r.state))];
      const { data: existingStates } = await supabase.from('states').select('*');
      const stateMap = {};
      existingStates.forEach(s => { stateMap[s.name.toLowerCase()] = s.id; });

      const statesToCreate = uniqueStateNames.filter(n => !stateMap[n.toLowerCase()]);
      if (statesToCreate.length > 0) {
        const { data: newStates, error: stErr } = await supabase
          .from('states')
          .insert(statesToCreate.map(name => ({ name })))
          .select();
        if (stErr) throw stErr;
        newStates.forEach(s => { stateMap[s.name.toLowerCase()] = s.id; });
      }

      // 2. Insert editions (skip duplicates by name+state+branch+pullout)
      const { data: existingEditions } = await supabase.from('editions').select('name, state_id, branch, pullout');
      const existingKey = new Set(
        existingEditions.map(e => `${e.name.toLowerCase()}|${e.state_id}|${(e.branch||'').toLowerCase()}|${(e.pullout||'').toLowerCase()}`)
      );

      const toInsert = csvRows
        .map(r => ({
          name: r.name,
          state_id: stateMap[r.state.toLowerCase()],
          branch: r.branch,
          pullout: r.pullout,
          schedule_page_time: r.schedule_page_time,
        }))
        .filter(r => !existingKey.has(`${r.name.toLowerCase()}|${r.state_id}|${(r.branch||'').toLowerCase()}|${(r.pullout||'').toLowerCase()}`));

      if (toInsert.length === 0) {
        setImportErr('All editions already exist — no new ones found.');
        setImporting(false);
        return;
      }

      const { error: edErr } = await supabase.from('editions').insert(toInsert);
      if (edErr) throw edErr;

      setMsg(`${toInsert.length} new editions added (${csvRows.length - toInsert.length} already existed and were skipped).`);
      setCsvRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e) {
      setImportErr('Import fail hua: ' + e.message);
    }
    setImporting(false);
  }

  function downloadSampleCsv() {
    const sample = 'State,Branch,Edition,Pullout,Schedule time\nRaj,Kota Regional,RP-KOT-BUNDI,BUNDI PULLOUT,2026-06-30 23:00:00\nRaj,Bikaner,RP-BIK-BIKANER CITY,MAIN,2026-07-01 01:15:00\n';
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'editions_sample.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell profile={profile}>
      <div className="container" style={{ maxWidth: 1000 }}>

        {/* ---------- Bulk Import ---------- */}
        <div className="card">
          <h2>Bulk Editions Import (CSV)</h2>
          <p style={{ fontSize: 13, color: '#666' }}>
            Upload a CSV file to add several editions at once.
            Columns: <b>State, Branch, Edition, Pullout, Schedule time</b>.
            "Schedule time" can be a full date-time (2026-06-30 23:00:00) or just a time (23:00) —
            the system will automatically extract the time only (this becomes the daily fixed schedule).
            If a state doesn't exist yet, it will be created automatically.
          </p>
          <a href="#" onClick={(e) => { e.preventDefault(); downloadSampleCsv(); }} style={{ fontSize: 13 }}>
            Download sample CSV
          </a>
          <div style={{ marginTop: 10 }}>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileSelect} />
          </div>

          {importErr && <div className="error">{importErr}</div>}

          {csvRows.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3>Preview ({csvRows.length} rows)</h3>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>State</th><th>Branch</th><th>Edition</th><th>Pullout</th><th>Time</th></tr></thead>
                  <tbody>
                    {csvRows.map((r, i) => (
                      <tr key={i}><td>{r.state}</td><td>{r.branch}</td><td>{r.name}</td><td>{r.pullout}</td><td>{r.schedule_page_time}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={confirmImport} disabled={importing}>
                {importing ? 'Importing...' : `Confirm & Import ${csvRows.length} Editions`}
              </button>
            </div>
          )}
        </div>

        {/* ---------- Single Add (hamesha available - future editions ke liye) ---------- */}
        <div className="card">
          <h2>Add a New Edition</h2>
          <form onSubmit={addEdition}>
            <label>State</label>
            <select value={form.state_id} onChange={e => setForm({ ...form, state_id: e.target.value })} required>
              <option value="">-- Select State --</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <label>Branch</label>
            <input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} placeholder="e.g. Kota Regional" />

            <label>Edition Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. RP-KOT-BUNDI" required />

            <label>Pullout</label>
            <input value={form.pullout} onChange={e => setForm({ ...form, pullout: e.target.value })} placeholder="e.g. MAIN / BUNDI PULLOUT" />

            <label>Schedule Page Time (Fixed - the incharge cannot change this)</label>
            <input type="time" value={form.schedule_page_time} onChange={e => setForm({ ...form, schedule_page_time: e.target.value })} required />

            {err && <div className="error">{err}</div>}
            {msg && <div className="success">{msg}</div>}
            <button type="submit">Add Edition</button>
          </form>
        </div>

        {/* ---------- Editable list of all editions ---------- */}
        <div className="card">
          <h3>All Editions ({editions.length}) — Editable Directly Below</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>State</th><th>Branch</th><th>Edition</th><th>Pullout</th><th>Schedule Time</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {editions.map(ed => (
                  <tr key={ed.id}>
                    <td>
                      <select
                        defaultValue={ed.state_id}
                        onChange={(e) => updateField(ed, 'state_id', e.target.value)}
                      >
                        {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        defaultValue={ed.branch || ''}
                        style={{ minWidth: 110 }}
                        onBlur={(e) => e.target.value.trim() !== (ed.branch||'') && updateField(ed, 'branch', e.target.value.trim())}
                      />
                    </td>
                    <td>
                      <input
                        defaultValue={ed.name}
                        style={{ minWidth: 140 }}
                        onBlur={(e) => e.target.value.trim() !== ed.name && e.target.value.trim() && updateField(ed, 'name', e.target.value.trim())}
                      />
                    </td>
                    <td>
                      <input
                        defaultValue={ed.pullout || 'MAIN'}
                        style={{ minWidth: 110 }}
                        onBlur={(e) => e.target.value.trim() !== (ed.pullout||'') && updateField(ed, 'pullout', e.target.value.trim() || 'MAIN')}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        defaultValue={ed.schedule_page_time?.slice(0,5)}
                        style={{ width: 110 }}
                        onBlur={(e) => e.target.value !== ed.schedule_page_time?.slice(0,5) && updateField(ed, 'schedule_page_time', e.target.value)}
                      />
                    </td>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); toggleActive(ed); }}>
                        {ed.active ? 'Active' : 'Inactive'}
                      </a>
                    </td>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); deleteEdition(ed); }} style={{ color: '#c8102e' }}>
                        Delete
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

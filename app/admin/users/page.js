'use client';
import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import AppShell from '../../components/AppShell';
import Modal from '../../components/Modal';

export default function UsersAdminPage() {
  const { profile, user } = useProfile();
  const [states, setStates] = useState([]);
  const [branchesByState, setBranchesByState] = useState({});
  const [users, setUsers] = useState([]);
  const [scopesByUser, setScopesByUser] = useState({});

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', role: 'edition_incharge', state_id: '',
  });
  const [pendingScopes, setPendingScopes] = useState([]); // [{state_id, state_name, branch}]
  const [scopeBranch, setScopeBranch] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Manage-branches modal for an existing user
  const [manageUser, setManageUser] = useState(null);
  const [manageStateId, setManageStateId] = useState('');
  const [manageBranch, setManageBranch] = useState('');
  const [manageErr, setManageErr] = useState('');

  // Bulk CSV import state
  const [csvRows, setCsvRows] = useState([]);
  const [csvErr, setCsvErr] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

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

    const { data: sc } = await supabase.from('incharge_scopes').select('*, states(name)');
    const byUser = {};
    (sc || []).forEach(s => {
      if (!byUser[s.profile_id]) byUser[s.profile_id] = [];
      byUser[s.profile_id].push(s);
    });
    setScopesByUser(byUser);
  }
  useEffect(() => { load(); }, []);

  // ---------- Create form: add/remove scopes before submitting ----------
  function addPendingScope() {
    if (!form.state_id || !scopeBranch) return;
    const stateName = states.find(s => s.id === form.state_id)?.name || '';
    if (pendingScopes.some(s => s.state_id === form.state_id && s.branch === scopeBranch)) return;
    setPendingScopes([...pendingScopes, { state_id: form.state_id, state_name: stateName, branch: scopeBranch }]);
    setScopeBranch('');
  }
  function removePendingScope(idx) {
    setPendingScopes(pendingScopes.filter((_, i) => i !== idx));
  }

  async function addUser(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (form.role === 'edition_incharge' && pendingScopes.length === 0) {
      setErr('Add at least one Branch for this Edition Incharge.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email, password: form.password, full_name: form.full_name, role: form.role,
        state_id: form.role === 'state_head' ? form.state_id : null,
        scopes: form.role === 'edition_incharge' ? pendingScopes.map(s => ({ state_id: s.state_id, branch: s.branch })) : [],
        requester_id: user.id,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(json.error); return; }
    setMsg(`User created: ${form.email}`);
    setForm({ email: '', password: '', full_name: '', role: 'edition_incharge', state_id: '' });
    setPendingScopes([]);
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

  // ---------- Manage branches for an existing user ----------
  function openManage(u) {
    setManageUser(u);
    setManageStateId('');
    setManageBranch('');
    setManageErr('');
  }

  async function addScopeToUser() {
    setManageErr('');
    if (!manageStateId || !manageBranch) { setManageErr('Select a State and Branch'); return; }
    const { error } = await supabase.from('incharge_scopes').insert({
      profile_id: manageUser.id, state_id: manageStateId, branch: manageBranch,
    });
    if (error) { setManageErr(error.message); return; }
    setManageBranch('');
    load();
  }

  async function removeScopeFromUser(scopeId) {
    await supabase.from('incharge_scopes').delete().eq('id', scopeId);
    load();
  }

  // ---------- Bulk CSV import of users ----------
  // branch column supports multiple branches separated by ; (semicolon), all within the same state
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCsvErr('');
    setImportResults(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data
          .map(r => ({
            full_name: (r.full_name || r.Full_Name || r.Name || '').trim(),
            email: (r.email || r.Email || '').trim(),
            password: (r.password || r.Password || '').trim(),
            role: (r.role || r.Role || 'edition_incharge').trim(),
            state: (r.state || r.State || '').trim(),
            branches: (r.branch || r.Branch || r.branches || r.Branches || '').trim(),
          }))
          .filter(r => r.full_name && r.email && r.password);
        if (rows.length === 0) {
          setCsvErr('No valid rows found. Header line must include full_name,email,password,role,state,branch.');
          return;
        }
        setCsvRows(rows);
      },
      error: (error) => setCsvErr('Could not parse CSV: ' + error.message),
    });
  }

  async function confirmBulkImport() {
    setImporting(true);
    setCsvErr('');
    try {
      const stateByName = {};
      states.forEach(s => { stateByName[s.name.toLowerCase()] = s.id; });

      const payload = csvRows.map(r => ({
        full_name: r.full_name,
        email: r.email,
        password: r.password,
        role: r.role,
        state_id: r.state ? stateByName[r.state.toLowerCase()] : null,
        scopes: r.branches
          ? r.branches.split(';').map(b => b.trim()).filter(Boolean).map(b => ({ state_id: stateByName[r.state.toLowerCase()], branch: b }))
          : [],
      }));

      const res = await fetch('/api/admin/bulk-create-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: payload, requester_id: user.id }),
      });
      const json = await res.json();
      if (!res.ok) { setCsvErr(json.error); setImporting(false); return; }
      setImportResults(json.results);
      setCsvRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e) {
      setCsvErr('Import failed: ' + e.message);
    }
    setImporting(false);
  }

  function downloadSampleUsersCsv() {
    const sample = 'full_name,email,password,role,state,branch\nRajesh Kumar,rajesh@example.com,Pass1234,edition_incharge,Raj,Bikaner;Bhilwara\nSunita Sharma,sunita@example.com,Pass1234,state_head,Raj,\n';
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users_sample.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const availableBranches = branchesByState[form.state_id] || [];
  const manageAvailableBranches = branchesByState[manageStateId] || [];

  return (
    <AppShell profile={profile}>
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="card">
          <h2>Bulk Users Import (CSV)</h2>
          <p style={{ fontSize: 13, color: '#666' }}>
            Upload a CSV to create several users at once. Columns:{' '}
            <b>full_name, email, password, role, state, branch</b>.
            For multiple branches (same state), separate them with a semicolon, e.g. <code>Bikaner;Bhilwara</code>.
            Role must be one of: admin, state_head, edition_incharge.
          </p>
          <a href="#" onClick={(e) => { e.preventDefault(); downloadSampleUsersCsv(); }} style={{ fontSize: 13 }}>
            Download sample CSV
          </a>
          <div style={{ marginTop: 10 }}>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileSelect} />
          </div>

          {csvErr && <div className="error">{csvErr}</div>}

          {csvRows.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3>Preview ({csvRows.length} users)</h3>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>State</th><th>Branch(es)</th></tr></thead>
                  <tbody>
                    {csvRows.map((r, i) => (
                      <tr key={i}><td>{r.full_name}</td><td>{r.email}</td><td>{r.role}</td><td>{r.state}</td><td>{r.branches}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={confirmBulkImport} disabled={importing}>
                {importing ? 'Importing...' : `Confirm & Create ${csvRows.length} Users`}
              </button>
            </div>
          )}

          {importResults && (
            <div style={{ marginTop: 16 }}>
              <h3>Import Results</h3>
              <table>
                <thead><tr><th>Email</th><th>Status</th></tr></thead>
                <tbody>
                  {importResults.map((r, i) => (
                    <tr key={i}>
                      <td>{r.email}</td>
                      <td>{r.success ? <span className="badge badge-early">Created</span> : <span className="badge badge-late">{r.error}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, state_id: '' })}>
              <option value="admin">Admin (Full Access)</option>
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
                <label>Add Branches (one or more)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={form.state_id} onChange={e => setForm({ ...form, state_id: e.target.value })} style={{ flex: 1 }}>
                    <option value="">-- State --</option>
                    {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={scopeBranch} onChange={e => setScopeBranch(e.target.value)} style={{ flex: 1 }}>
                    <option value="">-- Branch --</option>
                    {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <button type="button" className="secondary" onClick={addPendingScope} style={{ marginTop: 0, whiteSpace: 'nowrap' }}>
                    + Add
                  </button>
                </div>
                {form.state_id && availableBranches.length === 0 && (
                  <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                    No branches found for this state yet — add editions first (Admin → Editions).
                  </div>
                )}

                {pendingScopes.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {pendingScopes.map((s, i) => (
                      <span key={i} className="badge badge-ontime" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {s.state_name} — {s.branch}
                        <a href="#" onClick={(e) => { e.preventDefault(); removePendingScope(i); }} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>×</a>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            {err && <div className="error">{err}</div>}
            {msg && <div className="success">{msg}</div>}
            <button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
          </form>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
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
                    {u.role === 'edition_incharge' && (
                      (scopesByUser[u.id] || []).length === 0
                        ? <span style={{ color: 'var(--text-muted)' }}>No branches assigned</span>
                        : (scopesByUser[u.id] || []).map(s => `${s.states?.name} - ${s.branch}`).join(', ')
                    )}
                    {u.role === 'admin' && 'All'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {u.role === 'edition_incharge' && (
                      <a href="#" onClick={(e) => { e.preventDefault(); openManage(u); }} style={{ marginRight: 12 }}>
                        Manage Branches
                      </a>
                    )}
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

      {manageUser && (
        <Modal title={`Manage Branches — ${manageUser.full_name}`} onClose={() => setManageUser(null)}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {(scopesByUser[manageUser.id] || []).length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>No branches assigned yet.</span>
            )}
            {(scopesByUser[manageUser.id] || []).map(s => (
              <span key={s.id} className="badge badge-ontime" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.states?.name} — {s.branch}
                <a href="#" onClick={(e) => { e.preventDefault(); removeScopeFromUser(s.id); }} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>×</a>
              </span>
            ))}
          </div>

          <label>Add a Branch</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={manageStateId} onChange={e => { setManageStateId(e.target.value); setManageBranch(''); }} style={{ flex: 1 }}>
              <option value="">-- State --</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={manageBranch} onChange={e => setManageBranch(e.target.value)} style={{ flex: 1 }}>
              <option value="">-- Branch --</option>
              {manageAvailableBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {manageErr && <div className="error">{manageErr}</div>}
          <button type="button" onClick={addScopeToUser} style={{ width: '100%' }}>+ Add Branch</button>
        </Modal>
      )}
    </AppShell>
  );
}

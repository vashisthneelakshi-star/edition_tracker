'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import AppShell from '../components/AppShell';
import TimeSelect from '../components/TimeSelect';

const WORD_LIMIT = 100;

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function calcDelay(scheduleTime, releaseTime) {
  if (!scheduleTime || !releaseTime) return null;
  const [sh, sm] = scheduleTime.split(':').map(Number);
  const [rh, rm] = releaseTime.split(':').map(Number);
  return (rh * 60 + rm) - (sh * 60 + sm);
}

// Shared logic for one edition's entry (used by both table row and mobile card)
function useEntryRow(edition, entryDate, existingEntry, onSaved) {
  const [releaseTime, setReleaseTime] = useState(existingEntry?.release_page_time?.slice(0, 5) || '');
  const [reason, setReason] = useState(existingEntry?.delay_reason || '');
  const [lastPageNo, setLastPageNo] = useState(existingEntry?.last_page_no || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(!!existingEntry);

  const scheduleTime = edition.schedule_page_time?.slice(0, 5);
  const delay = calcDelay(scheduleTime, releaseTime);

  let delayText = '—';
  let delayCls = '';
  if (delay !== null) {
    if (delay === 0) { delayText = 'On Time'; delayCls = 'badge-ontime'; }
    else if (delay > 0) { delayText = `${delay} min Late`; delayCls = 'badge-late'; }
    else { delayText = `${Math.abs(delay)} min Early`; delayCls = 'badge-early'; }
  }

  function markDirty() { setSaved(false); }

  async function handleSave() {
    setErr('');
    if (!releaseTime) { setErr('Enter Release Time'); return; }
    if (delay > 0 && wordCount(reason) === 0) { setErr('Reason required'); return; }
    if (wordCount(reason) > WORD_LIMIT) { setErr(`Max ${WORD_LIMIT} words`); return; }

    setSaving(true);
    const payload = {
      edition_id: edition.id,
      entry_date: entryDate,
      schedule_page_time: edition.schedule_page_time,
      release_page_time: releaseTime,
      last_page_no: lastPageNo,
      delay_reason: reason,
    };

    let error;
    if (existingEntry) {
      ({ error } = await supabase.from('entries').update(payload).eq('id', existingEntry.id));
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      ({ error } = await supabase.from('entries').insert({ ...payload, created_by: session.user.id }));
    }
    setSaving(false);
    if (error) { setErr('Failed: ' + error.message); return; }
    setSaved(true);
    onSaved();
  }

  return {
    releaseTime, setReleaseTime: (v) => { setReleaseTime(v); markDirty(); },
    reason, setReason: (v) => { setReason(v); markDirty(); },
    lastPageNo, setLastPageNo: (v) => { setLastPageNo(v); markDirty(); },
    saving, err, saved, scheduleTime, delay, delayText, delayCls, handleSave,
  };
}

function EditionTableRow({ edition, stateName, branch, entryDate, existingEntry, onSaved }) {
  const r = useEntryRow(edition, entryDate, existingEntry, onSaved);
  return (
    <tr>
      <td>{stateName}</td>
      <td>{branch}</td>
      <td><strong>{edition.name}</strong></td>
      <td>{edition.pullout || 'MAIN'}</td>
      <td className="locked-field" style={{ textAlign: 'center' }}>{r.scheduleTime}</td>
      <td><TimeSelect value={r.releaseTime} onChange={r.setReleaseTime} /></td>
      <td>{r.delayText !== '—' ? <span className={`badge ${r.delayCls}`}>{r.delayText}</span> : '—'}</td>
      <td>
        <input type="text" value={r.reason} onChange={e => r.setReason(e.target.value)}
          placeholder={r.delay > 0 ? 'Required' : 'Optional'} style={{ minWidth: 160 }} />
      </td>
      <td>
        <input type="text" value={r.lastPageNo} onChange={e => r.setLastPageNo(e.target.value)}
          placeholder="Last page" style={{ minWidth: 90 }} />
      </td>
      <td>
        <button type="button" onClick={r.handleSave} disabled={r.saving} style={{ marginTop: 0, padding: '6px 14px', fontSize: 13 }}>
          {r.saving ? '...' : r.saved ? 'Saved' : 'Save'}
        </button>
        {r.err && <div className="error" style={{ fontSize: 11 }}>{r.err}</div>}
      </td>
    </tr>
  );
}

function EditionCard({ edition, entryDate, existingEntry, onSaved }) {
  const r = useEntryRow(edition, entryDate, existingEntry, onSaved);
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <strong style={{ fontSize: 15 }}>{edition.name}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>{edition.pullout || 'MAIN'}</span>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Schedule Time: <strong style={{ color: 'var(--navy)' }}>{r.scheduleTime}</strong>
          </div>
        </div>
        {r.saved && <span className="badge badge-ontime">Saved</span>}
      </div>

      <label>Release Page Time</label>
      <TimeSelect value={r.releaseTime} onChange={r.setReleaseTime} />

      {r.delayText !== '—' && (
        <div style={{ marginTop: 8 }}>
          <span className={`badge ${r.delayCls}`}>{r.delayText}</span>
        </div>
      )}

      <label>Last Page Name/No</label>
      <input value={r.lastPageNo} onChange={e => r.setLastPageNo(e.target.value)} placeholder="e.g. Page 12" />

      <label>Reason for Delay {r.delay > 0 ? '(Required)' : '(Optional)'}</label>
      <textarea rows={2} value={r.reason} onChange={e => r.setReason(e.target.value)} placeholder="Max 100 words" />
      <div style={{ fontSize: 12, color: wordCount(r.reason) > WORD_LIMIT ? 'var(--late)' : 'var(--text-muted)' }}>
        {wordCount(r.reason)}/{WORD_LIMIT} words
      </div>

      {r.err && <div className="error">{r.err}</div>}
      <button type="button" onClick={r.handleSave} disabled={r.saving}>
        {r.saving ? 'Saving...' : existingEntry ? 'Update Entry' : 'Save Entry'}
      </button>
    </div>
  );
}

export default function EntryPage() {
  const { loading, user, profile } = useProfile();
  const router = useRouter();

  const [editions, setEditions] = useState([]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [existingEntries, setExistingEntries] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (profile && profile.role !== 'edition_incharge') { router.push('/dashboard'); return; }
  }, [loading, user, profile, router]);

  useEffect(() => {
    async function load() {
      if (!profile?.state_id || !profile?.branch) return;
      setDataLoading(true);

      const { data: eds } = await supabase
        .from('editions')
        .select('*')
        .eq('state_id', profile.state_id)
        .eq('branch', profile.branch)
        .eq('active', true)
        .order('name');
      setEditions(eds || []);

      const { data: entries } = await supabase
        .from('entries')
        .select('*')
        .eq('entry_date', entryDate)
        .in('edition_id', (eds || []).map(e => e.id));

      const map = {};
      (entries || []).forEach(e => { map[e.edition_id] = e; });
      setExistingEntries(map);
      setDataLoading(false);
    }
    load();
  }, [profile, entryDate, refreshTick]);

  if (loading || dataLoading) return <div className="container">Loading...</div>;

  if (profile && (!profile.state_id || !profile.branch)) {
    return (
      <AppShell profile={profile}>
        <div className="container">
          <div className="card">
            Your account is not yet assigned to a State/Branch. Please contact your Admin.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell profile={profile}>
      <div className="container" style={{ maxWidth: '100%', padding: '24px 16px' }}>
        <div className="card">
          <h2>Daily Page Entry</h2>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14, color: '#555' }}>
            <div><strong>State:</strong> {profile?.states?.name || '—'}</div>
            <div><strong>Branch:</strong> {profile?.branch}</div>
          </div>
          <label>Date</label>
          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={{ maxWidth: 200 }} />
        </div>

        {editions.length === 0 ? (
          <div className="card"><p>No editions found for your Branch. Please contact your Admin.</p></div>
        ) : (
          <>
            {/* Desktop: table layout */}
            <div className="card desktop-only" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>State</th><th>Branch</th><th>Edition</th><th>Pullout</th>
                    <th>Schedule Time</th><th>Release Time</th><th>Delay/Early</th>
                    <th>Reason</th><th>Last Page</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {editions.map(ed => (
                    <EditionTableRow
                      key={ed.id}
                      edition={ed}
                      stateName={profile?.states?.name}
                      branch={profile?.branch}
                      entryDate={entryDate}
                      existingEntry={existingEntries[ed.id]}
                      onSaved={() => setRefreshTick(t => t + 1)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: vertical cards, one edition at a time */}
            <div className="mobile-only">
              {editions.map(ed => (
                <EditionCard
                  key={ed.id}
                  edition={ed}
                  entryDate={entryDate}
                  existingEntry={existingEntries[ed.id]}
                  onSaved={() => setRefreshTick(t => t + 1)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

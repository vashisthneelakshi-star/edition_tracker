'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import NavBar from '../components/NavBar';

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

function EditionRow({ edition, entryDate, existingEntry, onSaved }) {
  const [releaseTime, setReleaseTime] = useState(existingEntry?.release_page_time?.slice(0, 5) || '');
  const [lastPageNo, setLastPageNo] = useState(existingEntry?.last_page_no || '');
  const [reason, setReason] = useState(existingEntry?.delay_reason || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(!!existingEntry);

  const scheduleTime = edition.schedule_page_time?.slice(0, 5);
  const delay = calcDelay(scheduleTime, releaseTime);

  let statusLabel = null;
  if (delay !== null) {
    if (delay === 0) statusLabel = { text: 'On Time', cls: 'badge-ontime' };
    else if (delay > 0) statusLabel = { text: `${delay} min Late`, cls: 'badge-late' };
    else statusLabel = { text: `${Math.abs(delay)} min Early`, cls: 'badge-early' };
  }

  async function handleSave() {
    setErr('');
    if (!releaseTime) { setErr('Please enter Release Time.'); return; }
    if (delay !== 0 && wordCount(reason) === 0) { setErr('Reason is required when there is a delay or early release.'); return; }
    if (wordCount(reason) > WORD_LIMIT) { setErr(`Reason must be under ${WORD_LIMIT} words (currently ${wordCount(reason)}).`); return; }

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
    if (error) { setErr('Save failed: ' + error.message); return; }
    setSaved(true);
    onSaved();
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{edition.name}</strong>
          <span style={{ color: '#888', marginLeft: 8, fontSize: 13 }}>{edition.pullout || 'MAIN'}</span>
        </div>
        {saved && <span className="badge badge-ontime">Saved</span>}
      </div>

      <label>Schedule Page Time (Fixed)</label>
      <input value={scheduleTime} readOnly className="locked-field" />

      <label>Release Page Time</label>
      <input type="time" value={releaseTime} onChange={e => { setReleaseTime(e.target.value); setSaved(false); }} />

      {statusLabel && (
        <div style={{ marginTop: 8 }}>
          <span className={`badge ${statusLabel.cls}`}>{statusLabel.text}</span>
        </div>
      )}

      <label>Last Page Name/No</label>
      <input value={lastPageNo} onChange={e => { setLastPageNo(e.target.value); setSaved(false); }} placeholder="e.g. Page 12" />

      <label>Reason for Delay {delay !== 0 && delay !== null ? '(Required)' : '(Optional)'}</label>
      <textarea rows={2} value={reason} onChange={e => { setReason(e.target.value); setSaved(false); }} placeholder="Max 100 words" />
      <div style={{ fontSize: 12, color: wordCount(reason) > WORD_LIMIT ? '#c8102e' : '#888' }}>
        {wordCount(reason)}/{WORD_LIMIT} words
      </div>

      {err && <div className="error">{err}</div>}
      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : existingEntry ? 'Update Entry' : 'Save Entry'}
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
      <>
        <NavBar profile={profile} />
        <div className="container">
          <div className="card">
            Your account is not yet assigned to a State/Branch. Please contact your Admin.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar profile={profile} />
      <div className="container">
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
          <div className="card">No editions found for your Branch. Please contact your Admin.</div>
        ) : (
          editions.map(ed => (
            <EditionRow
              key={ed.id}
              edition={ed}
              entryDate={entryDate}
              existingEntry={existingEntries[ed.id]}
              onSaved={() => setRefreshTick(t => t + 1)}
            />
          ))
        )}
      </div>
    </>
  );
}

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

function EditionRow({ edition, stateName, branch, entryDate, existingEntry, onSaved }) {
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

  async function handleSave() {
    setErr('');
    if (!releaseTime) { setErr('Enter Release Time'); return; }
    if (delay !== 0 && wordCount(reason) === 0) { setErr('Reason required'); return; }
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

  return (
    <tr>
      <td>{stateName}</td>
      <td>{branch}</td>
      <td><strong>{edition.name}</strong></td>
      <td>{edition.pullout || 'MAIN'}</td>
      <td className="locked-field" style={{ textAlign: 'center' }}>{scheduleTime}</td>
      <td>
        <input
          type="time"
          value={releaseTime}
          onChange={e => { setReleaseTime(e.target.value); setSaved(false); }}
          style={{ minWidth: 110 }}
        />
      </td>
      <td>
        {delayText !== '—' ? <span className={`badge ${delayCls}`}>{delayText}</span> : '—'}
      </td>
      <td>
        <input
          type="text"
          value={reason}
          onChange={e => { setReason(e.target.value); setSaved(false); }}
          placeholder={delay !== 0 && delay !== null ? 'Required' : 'Optional'}
          style={{ minWidth: 160 }}
        />
      </td>
      <td>
        <input
          type="text"
          value={lastPageNo}
          onChange={e => { setLastPageNo(e.target.value); setSaved(false); }}
          placeholder="Last page"
          style={{ minWidth: 90 }}
        />
      </td>
      <td>
        <button type="button" onClick={handleSave} disabled={saving} style={{ marginTop: 0, padding: '6px 14px', fontSize: 13 }}>
          {saving ? '...' : saved ? 'Saved' : 'Save'}
        </button>
        {err && <div className="error" style={{ fontSize: 11 }}>{err}</div>}
      </td>
    </tr>
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

        <div className="card" style={{ overflowX: 'auto' }}>
          {editions.length === 0 ? (
            <p>No editions found for your Branch. Please contact your Admin.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Branch</th>
                  <th>Edition</th>
                  <th>Pullout</th>
                  <th>Schedule Time</th>
                  <th>Release Time</th>
                  <th>Delay/Early</th>
                  <th>Reason</th>
                  <th>Last Page</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {editions.map(ed => (
                  <EditionRow
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
          )}
        </div>
      </div>
    </>
  );
}

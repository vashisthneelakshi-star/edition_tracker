'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import AppShell from '../components/AppShell';
import TimeSelect from '../components/TimeSelect';
import ReasonField from '../components/ReasonField';

const WORD_LIMIT = 100;
const CUTOFF_HOUR = 4; // after 4:00 AM, the previous cycle's date is no longer editable

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function calcDelay(scheduleTime, releaseTime) {
  if (!scheduleTime || !releaseTime) return null;

  const [sh, sm] = scheduleTime.split(":").map(Number);
  const [rh, rm] = releaseTime.split(":").map(Number);

  let schedule = sh * 60 + sm;
  let release = rh * 60 + rm;

  // Midnight crossover
  if (schedule < 360 && release >= 1080) {
    schedule += 1440;
  }

  return release - schedule;
}

// A "cycle" covers one newspaper date. Since most page-release times fall
// between late night and ~4 AM the next calendar day, entries made before
// 4 AM still belong to the PREVIOUS calendar day's cycle.
function getCurrentCycleDate() {
  const now = new Date();
  if (now.getHours() < CUTOFF_HOUR) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Calendar-based (not cycle-shifted) Yesterday / Today / Tomorrow options —
// the Incharge is allowed to pick any of these three for the entry.
function getDateOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function buildDateOptions() {
  const opts = [
    { value: getDateOffset(0), label: 'Today' },
    { value: getDateOffset(1), label: 'Tomorrow' },
  ];
  // "Yesterday" is only a valid option before the 4 AM cutoff — the night
  // work (midnight to 4 AM) still belongs to yesterday's edition date. Once
  // 4 AM passes, yesterday's window is closed and must not be enterable.
  if (new Date().getHours() < CUTOFF_HOUR) {
    opts.unshift({ value: getDateOffset(-1), label: 'Yesterday' });
  }
  return opts;
}

// Shared logic for one edition's entry (used by both table row and mobile card)
function useEntryRow(edition, entryDate, existingEntry, onSaved) {
  const [releaseTime, setReleaseTime] = useState(existingEntry?.release_page_time?.slice(0, 5) || '');
  const [reason, setReason] = useState(existingEntry?.delay_reason || '');
  const [lastPageNo, setLastPageNo] = useState(existingEntry?.last_page_no || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [locked, setLocked] = useState(!!existingEntry); // once saved, incharge can no longer edit

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
    if (delay > 0 && wordCount(reason) === 0) { setErr('Reason required'); return; }
    if (wordCount(reason) > WORD_LIMIT) { setErr(`Max ${WORD_LIMIT} words`); return; }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('entries').insert({
      edition_id: edition.id,
      entry_date: entryDate,
      schedule_page_time: edition.schedule_page_time,
      release_page_time: releaseTime,
      last_page_no: lastPageNo,
      delay_reason: reason,
      created_by: session.user.id,
    });
    setSaving(false);
    if (error) { setErr('Failed: ' + error.message); return; }
    setLocked(true);
    onSaved();
  }

  return {
    releaseTime, setReleaseTime,
    reason, setReason,
    lastPageNo, setLastPageNo,
    saving, err, locked, scheduleTime, delay, delayText, delayCls, handleSave,
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
      <td><TimeSelect value={r.releaseTime} onChange={r.setReleaseTime} disabled={r.locked} /></td>
      <td>{r.delayText !== '—' ? <span className={`badge ${r.delayCls}`}>{r.delayText}</span> : '—'}</td>
      <td style={{ minWidth: 180 }}>
        <ReasonField
          value={r.reason}
          onChange={r.setReason}
          disabled={r.locked}
          required={r.delay > 0}
          editionLabel={`${edition.name} - ${edition.pullout || 'MAIN'}`}
        />
      </td>
      <td>
        <input type="text" value={r.lastPageNo} onChange={e => r.setLastPageNo(e.target.value)} disabled={r.locked}
          placeholder="Last page" style={{ minWidth: 90 }} />
      </td>
      <td>
        {r.locked ? (
          <span className="badge badge-ontime">Submitted</span>
        ) : (
          <button type="button" onClick={r.handleSave} disabled={r.saving} style={{ marginTop: 0, padding: '6px 14px', fontSize: 13 }}>
            {r.saving ? '...' : 'Save'}
          </button>
        )}
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
          <strong>{edition.name}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 14 }}>{edition.pullout || 'MAIN'}</span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{edition.states?.name} — {edition.branch}</div>
        </div>
        {r.locked && <span className="badge badge-ontime">Submitted</span>}
      </div>

      <div className="field-pair">
        <div>
          <label>Schedule Time</label>
          <div className="locked-field" style={{ padding: '11px 12px', borderRadius: 8, fontWeight: 700 }}>
            {r.scheduleTime}
          </div>
        </div>
        <div>
          <label>Release Time</label>
          <TimeSelect value={r.releaseTime} onChange={r.setReleaseTime} disabled={r.locked} />
        </div>
      </div>

      {r.delayText !== '—' && (
        <div style={{ marginTop: 10 }}>
          <span className={`badge ${r.delayCls}`}>{r.delayText}</span>
        </div>
      )}

      <div className="field-pair">
        <div>
          <label>Last Page No</label>
          <input value={r.lastPageNo} onChange={e => r.setLastPageNo(e.target.value)} disabled={r.locked} placeholder="e.g. Page 12" />
        </div>
        <div>
          <label>Reason {r.delay > 0 ? '(Required)' : '(Optional)'}</label>
          <ReasonField
            value={r.reason}
            onChange={r.setReason}
            disabled={r.locked}
            required={r.delay > 0}
            editionLabel={`${edition.name} - ${edition.pullout || 'MAIN'}`}
          />
        </div>
      </div>

      {r.err && <div className="error">{r.err}</div>}

      {r.locked ? (
        <div className="locked-note">Submitted — contact your Admin if this needs to be corrected.</div>
      ) : (
        <button type="button" onClick={r.handleSave} disabled={r.saving} style={{ width: '100%' }}>
          {r.saving ? 'Saving...' : 'Submit'}
        </button>
      )}
    </div>
  );
}

export default function EntryPage() {
  const { loading, user, profile } = useProfile();
  const router = useRouter();

  const [editions, setEditions] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [dateOptions, setDateOptions] = useState(buildDateOptions);
  const [entryDate, setEntryDate] = useState(() => {
    const cycleDate = getCurrentCycleDate();
    const opts = buildDateOptions();
    // Default to the auto-computed cycle date if it falls within the allowed
    // window, otherwise fall back to Today.
    return opts.some(o => o.value === cycleDate)
      ? cycleDate
      : opts.find(o => o.label === 'Today').value;
  });
  const [existingEntries, setExistingEntries] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  // Re-check the allowed date window periodically (every 60s) so that if the
  // page stays open across the 4 AM cutoff, "Yesterday" disappears and any
  // currently-selected-but-now-invalid date is bumped forward to Today.
  useEffect(() => {
    const id = setInterval(() => {
      const opts = buildDateOptions();
      setDateOptions(opts);
      setEntryDate(current => {
        if (opts.some(o => o.value === current)) return current;
        return opts.find(o => o.label === 'Today').value;
      });
    }, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (profile && profile.role !== 'edition_incharge') { router.push('/dashboard'); return; }
  }, [loading, user, profile, router]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setDataLoading(true);

      const { data: myScopes } = await supabase
        .from('incharge_scopes')
        .select('*, states(name)')
        .eq('profile_id', user.id);
      setScopes(myScopes || []);

      if (!myScopes || myScopes.length === 0) {
        setEditions([]);
        setDataLoading(false);
        return;
      }

      // Fetch editions for every assigned (state, branch) scope and merge
      const results = await Promise.all(
        myScopes.map(s =>
          supabase
            .from('editions')
            .select('*, states(name)')
            .eq('state_id', s.state_id)
            .eq('branch', s.branch)
            .eq('active', true)
            .order('name')
        )
      );
      const eds = results.flatMap(r => r.data || []);
      setEditions(eds);

      const { data: entries } = await supabase
        .from('entries')
        .select('*')
        .eq('entry_date', entryDate)
        .in('edition_id', eds.map(e => e.id));

      const map = {};
      (entries || []).forEach(e => { map[e.edition_id] = e; });
      setExistingEntries(map);
      setDataLoading(false);
    }
    load();
  }, [user, entryDate, refreshTick]);

  if (loading || dataLoading) return <div className="container">Loading...</div>;

  if (profile && scopes.length === 0) {
    return (
      <AppShell profile={profile}>
        <div className="container">
          <div className="card">
            Your account is not yet assigned to any Branch. Please contact your Admin.
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
          <label>Your Branches</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {scopes.map(s => (
              <span key={s.id} className="badge badge-ontime">{s.states?.name} — {s.branch}</span>
            ))}
          </div>
          <label>Date</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dateOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={opt.value === entryDate ? '' : 'secondary'}
                onClick={() => setEntryDate(opt.value)}
                style={{ marginTop: 0 }}
              >
                {opt.label} <span style={{ opacity: 0.75, fontWeight: 400 }}>({formatDisplayDate(opt.value)})</span>
              </button>
            ))}
          </div>
          <div className="locked-note" style={{ marginTop: 12, background: 'var(--ontime-bg)', color: 'var(--ontime)', fontWeight: 600 }}>
            ⓘ "Yesterday" is only available before 4:00 AM (late-night work still belongs to yesterday's edition). After 4:00 AM it disappears — please use Today or Tomorrow. Once submitted for a date, it locks — contact your Admin for corrections.
          </div>
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
                      stateName={ed.states?.name}
                      branch={ed.branch}
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

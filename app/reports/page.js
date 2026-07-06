'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import { exportStyledExcel } from '../../lib/exportExcel';
import { toLocalISODate } from '../../lib/dateUtils';
import AppShell from '../components/AppShell';
import TimeSelect from '../components/TimeSelect';
import ReasonField from '../components/ReasonField';

function rangeStart(period) {
  const now = new Date();
  const d = new Date(now);
  if (period === 'daily') return toLocalISODate(now);
  if (period === 'weekly') d.setDate(now.getDate() - 7);
  if (period === 'monthly') d.setMonth(now.getMonth() - 1);
  if (period === 'half_yearly') d.setMonth(now.getMonth() - 6);
  if (period === 'yearly') d.setFullYear(now.getFullYear() - 1);
  return toLocalISODate(d);
}

function todayStr() {
  return toLocalISODate(new Date());
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

const PERIODS = ['daily', 'weekly', 'monthly', 'half_yearly', 'yearly', 'custom'];

function delayBadge(minutes) {
  if (minutes === 0) return { text: 'On Time', cls: 'badge-ontime' };
  if (minutes > 0) return { text: `${minutes} min Late`, cls: 'badge-late' };
  return { text: `${Math.abs(minutes)} min Early`, cls: 'badge-early' };
}

function calcDelayMinutes(scheduleTime, releaseTime) {
  if (!scheduleTime || !releaseTime) return null;

  const [sh, sm] = scheduleTime.split(":").map(Number);
  const [rh, rm] = releaseTime.split(":").map(Number);

  let scheduleMinutes = sh * 60 + sm;
  let releaseMinutes = rh * 60 + rm;

  // Midnight crossover
  if (scheduleMinutes < 360 && releaseMinutes >= 1080) {
    scheduleMinutes += 1440;
  }

  return releaseMinutes - scheduleMinutes;
}

function AdminEditableRow({ row, onSaved }) {
  const [releaseTime, setReleaseTime] = useState(row.release_page_time?.slice(0, 5) || '');
  const [reason, setReason] = useState(row.delay_reason || '');
  const [lastPage, setLastPage] = useState(row.last_page_no || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const scheduleTime = row.schedule_page_time?.slice(0, 5);
  const liveDelay = calcDelayMinutes(scheduleTime, releaseTime);
  const badge = liveDelay !== null ? delayBadge(liveDelay) : delayBadge(row.delay_minutes);

  async function handleSave() {
    setErr('');
    setSaving(true);
    const { error } = await supabase.from('entries').update({
      release_page_time: releaseTime,
      last_page_no: lastPage,
      delay_reason: reason,
    }).eq('id', row.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  async function handleDelete() {
    const label = `${row.editions?.name || ''} - ${row.editions?.pullout || 'MAIN'} (${row.entry_date})`;
    if (!window.confirm(`Delete this entry?\n\n${label}\n\nThe Edition Incharge will be able to submit this date again. This cannot be undone.`)) {
      return;
    }
    setErr('');
    setDeleting(true);
    const { error } = await supabase.from('entries').delete().eq('id', row.id);
    if (error) { setDeleting(false); setErr(error.message); return; }

    // Reopen this (state, branch, date) so the Edition Incharge sees it as
    // selectable again on their Entry page, even though its normal 4 AM
    // window has already closed.
    if (row.editions?.state_id && row.editions?.branch) {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('date_overrides').upsert({
        state_id: row.editions.state_id,
        branch: row.editions.branch,
        entry_date: row.entry_date,
        opened_by: session?.user?.id,
      }, { onConflict: 'state_id,branch,entry_date' });
    }

    setDeleting(false);
    onSaved();
  }

  return (
    <tr>
      <td>{row.entry_date}</td>
      <td>{row.editions?.states?.name}</td>
      <td>{row.editions?.branch}</td>
      <td><strong>{row.editions?.name}</strong></td>
      <td>{row.editions?.pullout}</td>
      <td>{scheduleTime}</td>
      <td><TimeSelect value={releaseTime} onChange={setReleaseTime} /></td>
      <td><span className={`badge ${badge.cls}`}>{badge.text}</span></td>
      <td style={{ minWidth: 180 }}>
        <ReasonField
          value={reason}
          onChange={setReason}
          editionLabel={`${row.editions?.name} - ${row.editions?.pullout || 'MAIN'}`}
        />
      </td>
      <td><input type="text" value={lastPage} onChange={e => setLastPage(e.target.value)} style={{ minWidth: 90 }} /></td>
      <td>{row.filled_by_name}</td>
      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={handleSave} disabled={saving || deleting} style={{ marginTop: 0, padding: '6px 14px', fontSize: 13 }}>
            {saving ? '...' : 'Update'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleDelete}
            disabled={saving || deleting}
            style={{ marginTop: 0, padding: '6px 14px', fontSize: 13, color: 'var(--late)', borderColor: 'var(--late)' }}
          >
            {deleting ? '...' : 'Delete'}
          </button>
        </div>
        {err && <div className="error" style={{ fontSize: 11 }}>{err}</div>}
      </td>
    </tr>
  );
}

function AdminReopenPanel() {
  const [states, setStates] = useState([]);
  const [branches, setBranches] = useState([]);
  const [stateId, setStateId] = useState('');
  const [branch, setBranch] = useState('');
  const [date, setDate] = useState(todayStr());
  const [overrides, setOverrides] = useState([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingOverrides, setLoadingOverrides] = useState(true);

  async function loadOverrides() {
    setLoadingOverrides(true);
    const { data } = await supabase
      .from('date_overrides')
      .select('id, branch, entry_date, created_at, states(name)')
      .order('created_at', { ascending: false });
    setOverrides(data || []);
    setLoadingOverrides(false);
  }

  useEffect(() => {
    supabase.from('states').select('*').order('name').then(({ data }) => setStates(data || []));
    loadOverrides();
  }, []);

  useEffect(() => {
    if (!stateId) { setBranches([]); setBranch(''); return; }
    supabase.from('editions').select('branch').eq('state_id', stateId).then(({ data }) => {
      const uniq = [...new Set((data || []).map(e => e.branch).filter(Boolean))];
      setBranches(uniq);
      setBranch(uniq[0] || '');
    });
  }, [stateId]);

  async function handleOpen(e) {
    e.preventDefault();
    setErr('');
    if (!stateId || !branch || !date) { setErr('Select State, Branch and Date'); return; }
    setSaving(true);
    const { error } = await supabase.from('date_overrides').upsert({
      state_id: stateId,
      branch,
      entry_date: date,
    }, { onConflict: 'state_id,branch,entry_date' });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    loadOverrides();
  }

  async function handleClose(id) {
    if (!window.confirm('Close this reopened date? The Incharge will no longer be able to select it.')) return;
    await supabase.from('date_overrides').delete().eq('id', id);
    loadOverrides();
  }

  return (
    <div className="card">
      <h2>Reopen a Past Date</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6 }}>
        Lets an Edition Incharge submit an entry for a date whose 4 AM window has already closed.
      </p>
      <form onSubmit={handleOpen} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label>State</label>
          <select value={stateId} onChange={e => setStateId(e.target.value)} required>
            <option value="">Select State</option>
            {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label>Branch</label>
          <select value={branch} onChange={e => setBranch(e.target.value)} required disabled={!stateId}>
            <option value="">Select Branch</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <button type="submit" disabled={saving}>{saving ? 'Opening...' : 'Open Date'}</button>
      </form>
      {err && <div className="error">{err}</div>}

      {!loadingOverrides && overrides.length > 0 && (
        <table style={{ marginTop: 16 }}>
          <thead><tr><th>State</th><th>Branch</th><th>Date</th><th>Opened</th><th></th></tr></thead>
          <tbody>
            {overrides.map(o => (
              <tr key={o.id}>
                <td>{o.states?.name}</td>
                <td>{o.branch}</td>
                <td>{o.entry_date}</td>
                <td>{new Date(o.created_at).toLocaleString('en-GB')}</td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleClose(o.id); }}>Close</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { profile } = useProfile();
  const [period, setPeriod] = useState('daily');
  const [customFrom, setCustomFrom] = useState(rangeStart('weekly'));
  const [customTo, setCustomTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [translateWarning, setTranslateWarning] = useState('');

  const isCustom = period === 'custom';
  const customRangeInvalid = isCustom && (!customFrom || !customTo || customFrom > customTo);

  useEffect(() => {
    if (customRangeInvalid) {
      setRows([]);
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      const from = isCustom ? customFrom : rangeStart(period);
      let query = supabase
        .from('entries')
        .select('id, entry_date, schedule_page_time, release_page_time, delay_minutes, last_page_no, delay_reason, created_by, created_at, editions(name, branch, pullout, state_id, states(name))')
        .gte('entry_date', from)
        .order('entry_date', { ascending: false });
      if (isCustom) query = query.lte('entry_date', customTo);
      const { data } = await query;
      const entriesData = data || [];

      // Attach "who filled it" name by looking up profiles for the
      // distinct created_by user ids on these entries.
      const userIds = [...new Set(entriesData.map(r => r.created_by).filter(Boolean))];
      let namesById = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        namesById = Object.fromEntries((profilesData || []).map(p => [p.id, p.full_name]));
      }
      setRows(entriesData.map(r => ({ ...r, filled_by_name: namesById[r.created_by] || '—' })));
      setLoading(false);
    }
    load();
  }, [period, customFrom, customTo, refreshTick]);

  // "daily" and "custom" both show the full row-by-row detail table (with admin
  // corrections); the fixed periods (weekly/monthly/etc.) show averaged summaries.
  const isDaily = period === 'daily';
  const isDetail = isDaily || isCustom;

  const grouped = {};
  rows.forEach(r => {
    const key = `${r.editions?.states?.name}|${r.editions?.branch}|${r.editions?.name}|${r.editions?.pullout}`;
    if (!grouped[key]) grouped[key] = {
      state: r.editions?.states?.name, branch: r.editions?.branch,
      name: r.editions?.name, pullout: r.editions?.pullout,
      count: 0, total: 0,
    };
    grouped[key].count += 1;
    grouped[key].total += r.delay_minutes;
  });
  const avgRows = Object.values(grouped).map(v => ({
    ...v, avg: Math.round(v.total / v.count),
  })).sort((a, b) => b.avg - a.avg);

  async function translateReason(text) {
    if (!text || !text.trim()) return { translated: text || '', failed: false };
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('translate failed');
      const data = await res.json();
      const translated = (data[0] || []).map(chunk => chunk[0]).join('');
      return { translated: translated || text, failed: !translated };
    } catch {
      return { translated: text, failed: true };
    }
  }

  async function handleDownload() {
    setExporting(true);
    setTranslateWarning('');
    try {
      if (isDetail) {
        let failCount = 0;
        const rowsWithTranslatedReasons = await Promise.all(
          rows.map(async (r) => {
            const { translated, failed } = await translateReason(r.delay_reason);
            if (failed) failCount++;
            return {
              date: r.entry_date,
              state: r.editions?.states?.name,
              delay_minutes: r.delay_minutes,
              branch: r.editions?.branch,
              edition_pullout: `${r.editions?.name || ''} - ${r.editions?.pullout || 'MAIN'}`,
              last_page: r.last_page_no,
              schedule: r.schedule_page_time?.slice(0,5),
              release: r.release_page_time?.slice(0,5),
              reason: translated,
              filled_by: r.filled_by_name,
              filled_on: formatDateTime(r.created_at),
            };
          })
        );
        if (failCount > 0) {
          setTranslateWarning(`Note: ${failCount} reason(s) could not be translated and were kept in the original language.`);
        }
        const filenameSuffix = isCustom
          ? `custom-${customFrom}_to_${customTo}`
          : `daily-${todayStr()}`;
        await exportStyledExcel({
          filename: `edition-report-${filenameSuffix}.xlsx`,
          sheetName: isCustom ? 'Custom Report' : 'Daily Report',
          delayKey: 'delay_minutes',
          columns: [
            { header: 'Date', key: 'date', width: 14, align: 'center' },
            { header: 'State', key: 'state', width: 14 },
            { header: 'Delay', key: 'delay_minutes', width: 12, align: 'center' },
            { header: 'Branch', key: 'branch', width: 16 },
            { header: 'Edition-Pullout', key: 'edition_pullout', width: 28 },
            { header: 'Last Page', key: 'last_page', width: 12, align: 'center' },
            { header: 'Schedule Time', key: 'schedule', width: 14, align: 'center' },
            { header: 'Release Time', key: 'release', width: 14, align: 'center' },
            { header: 'Reason', key: 'reason', width: 40, wrap: true },
            { header: 'Filled By', key: 'filled_by', width: 18 },
            { header: 'Filled On', key: 'filled_on', width: 22 },
          ],
          rows: rowsWithTranslatedReasons,
        });
      } else {
        await exportStyledExcel({
          filename: `edition-report-${period}-${todayStr()}.xlsx`,
          sheetName: `${period} Report`,
          delayKey: 'avg',
          columns: [
            { header: 'State', key: 'state', width: 14 },
            { header: 'Branch', key: 'branch', width: 16 },
            { header: 'Edition', key: 'name', width: 22 },
            { header: 'Pullout', key: 'pullout', width: 16 },
            { header: 'Avg Delay (min)', key: 'avg', width: 16, align: 'center' },
            { header: 'Entries', key: 'count', width: 10, align: 'center' },
          ],
          rows: avgRows,
        });
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell profile={profile}>
      <div className="container" style={{ maxWidth: '100%', padding: '24px 16px' }}>
        {profile?.role === 'admin' && <AdminReopenPanel />}
        <div className="card">
          <h2>{profile?.role === 'edition_incharge' ? 'My Reports' : 'Reports (Director-Ready)'}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {PERIODS.map(p => (
              <button
                key={p}
                type="button"
                className={p === period ? '' : 'secondary'}
                onClick={() => setPeriod(p)}
              >
                {p === 'custom' ? 'custom date' : p.replace('_', ' ')}
              </button>
            ))}
            <button
              type="button"
              className="gold"
              onClick={handleDownload}
              disabled={exporting || customRangeInvalid || (isDetail ? rows.length === 0 : avgRows.length === 0)}
              style={{ marginLeft: 'auto' }}
            >
              {exporting ? 'Preparing...' : '⬇ Download Excel'}
            </button>
          </div>

          {isCustom && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                From
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={e => setCustomFrom(e.target.value)}
                />
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                To
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={todayStr()}
                  onChange={e => setCustomTo(e.target.value)}
                />
              </label>
              {customRangeInvalid && (
                <span style={{ color: 'var(--late)', fontSize: 13 }}>
                  Please select a valid "from" and "to" date (from must not be after to).
                </span>
              )}
            </div>
          )}

          {translateWarning && (
            <div style={{ fontSize: 13, color: 'var(--late)', marginTop: 10 }}>{translateWarning}</div>
          )}
        </div>

        {loading ? <div className="card">Loading...</div> : customRangeInvalid ? (
          <div className="card">Please pick a valid custom date range above.</div>
        ) : isDetail ? (
          <div className="card" style={{ overflowX: 'auto' }}>
            <h3>
              {isDaily
                ? "Today's Detail (Which Edition Was Late/Early, and Why)"
                : `Detail from ${customFrom} to ${customTo} (Which Edition Was Late/Early, and Why)`}
            </h3>
            {rows.length === 0 ? <p>No entries yet for this period.</p> : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>State</th><th>Branch</th><th>Edition</th><th>Pullout</th>
                    <th>Schedule Time</th><th>Release Time</th><th>Delay/Early</th>
                    <th>Reason</th><th>Last Page</th><th>Filled By</th><th>Filled On</th>
                    {profile?.role === 'admin' && <th>Correction</th>}
                  </tr>
                </thead>
                <tbody>
                  {profile?.role === 'admin' ? (
                    rows.map((r) => (
                      <AdminEditableRow key={r.id} row={r} onSaved={() => setRefreshTick(t => t + 1)} />
                    ))
                  ) : (
                    rows.map((r, i) => {
                      const badge = delayBadge(r.delay_minutes);
                      return (
                        <tr key={i}>
                          <td>{r.entry_date}</td>
                          <td>{r.editions?.states?.name}</td>
                          <td>{r.editions?.branch}</td>
                          <td><strong>{r.editions?.name}</strong></td>
                          <td>{r.editions?.pullout}</td>
                          <td>{r.schedule_page_time?.slice(0,5)}</td>
                          <td>{r.release_page_time?.slice(0,5)}</td>
                          <td><span className={`badge ${badge.cls}`}>{badge.text}</span></td>
                          <td>{r.delay_reason}</td>
                          <td>{r.last_page_no}</td>
                          <td>{r.filled_by_name}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <h3>Average Delay/Early Per Edition ({period.replace('_',' ')})</h3>
            {avgRows.length === 0 ? <p>No entries yet for this period.</p> : (
              <table>
                <thead>
                  <tr>
                    <th>State</th><th>Branch</th><th>Edition</th><th>Pullout</th>
                    <th>Avg Delay (min)</th><th>Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {avgRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.state}</td>
                      <td>{r.branch}</td>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.pullout}</td>
                      <td>
                        <span className={`badge ${r.avg > 0 ? 'badge-late' : r.avg < 0 ? 'badge-early' : 'badge-ontime'}`}>
                          {r.avg} min
                        </span>
                      </td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

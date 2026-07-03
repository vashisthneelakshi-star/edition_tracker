'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import { exportStyledExcel } from '../../lib/exportExcel';
import AppShell from '../components/AppShell';
import TimeSelect from '../components/TimeSelect';
import ReasonField from '../components/ReasonField';

function rangeStart(period) {
  const now = new Date();
  const d = new Date(now);
  if (period === 'daily') return now.toISOString().slice(0, 10);
  if (period === 'weekly') d.setDate(now.getDate() - 7);
  if (period === 'monthly') d.setMonth(now.getMonth() - 1);
  if (period === 'half_yearly') d.setMonth(now.getMonth() - 6);
  if (period === 'yearly') d.setFullYear(now.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function delayBadge(minutes) {
  if (minutes === 0) return { text: 'On Time', cls: 'badge-ontime' };
  if (minutes > 0) return { text: `${minutes} min Late`, cls: 'badge-late' };
  return { text: `${Math.abs(minutes)} min Early`, cls: 'badge-early' };
}

function calcDelayMinutes(scheduleTime, releaseTime) {
  if (!scheduleTime || !releaseTime) return null;
  const [sh, sm] = scheduleTime.split(':').map(Number);
  const [rh, rm] = releaseTime.split(':').map(Number);
  return (rh * 60 + rm) - (sh * 60 + sm);
}

function AdminEditableRow({ row, onSaved }) {
  const [releaseTime, setReleaseTime] = useState(row.release_page_time?.slice(0, 5) || '');
  const [reason, setReason] = useState(row.delay_reason || '');
  const [lastPage, setLastPage] = useState(row.last_page_no || '');
  const [saving, setSaving] = useState(false);
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

  return (
    <tr>
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
      <td>
        <button type="button" onClick={handleSave} disabled={saving} style={{ marginTop: 0, padding: '6px 14px', fontSize: 13 }}>
          {saving ? '...' : 'Update'}
        </button>
        {err && <div className="error" style={{ fontSize: 11 }}>{err}</div>}
      </td>
    </tr>
  );
}

export default function ReportsPage() {
  const { profile } = useProfile();
  const [period, setPeriod] = useState('daily');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = rangeStart(period);
      const { data } = await supabase
        .from('entries')
        .select('id, entry_date, schedule_page_time, release_page_time, delay_minutes, last_page_no, delay_reason, editions(name, branch, pullout, states(name))')
        .gte('entry_date', from)
        .order('entry_date', { ascending: false });
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [period, refreshTick]);

  const isDaily = period === 'daily';

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
    if (!text || !text.trim()) return text || '';
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      return json.translated || text;
    } catch {
      return text;
    }
  }

  async function handleDownload() {
    setExporting(true);
    try {
      if (isDaily) {
        const rowsWithTranslatedReasons = await Promise.all(
          rows.map(async (r) => ({
            state: r.editions?.states?.name,
            branch: r.editions?.branch,
            edition: r.editions?.name,
            pullout: r.editions?.pullout,
            schedule: r.schedule_page_time?.slice(0,5),
            release: r.release_page_time?.slice(0,5),
            delay_minutes: r.delay_minutes,
            reason: await translateReason(r.delay_reason),
            last_page: r.last_page_no,
          }))
        );
        await exportStyledExcel({
          filename: `edition-report-daily-${new Date().toISOString().slice(0,10)}.xlsx`,
          sheetName: 'Daily Report',
          delayKey: 'delay_minutes',
          columns: [
            { header: 'State', key: 'state', width: 14 },
            { header: 'Branch', key: 'branch', width: 16 },
            { header: 'Edition', key: 'edition', width: 22 },
            { header: 'Pullout', key: 'pullout', width: 16 },
            { header: 'Schedule Time', key: 'schedule', width: 14 },
            { header: 'Release Time', key: 'release', width: 14 },
            { header: 'Delay (min)', key: 'delay_minutes', width: 14 },
            { header: 'Reason', key: 'reason', width: 30 },
            { header: 'Last Page', key: 'last_page', width: 12 },
          ],
          rows: rowsWithTranslatedReasons,
        });
      } else {
        await exportStyledExcel({
          filename: `edition-report-${period}-${new Date().toISOString().slice(0,10)}.xlsx`,
          sheetName: `${period} Report`,
          delayKey: 'avg',
          columns: [
            { header: 'State', key: 'state', width: 14 },
            { header: 'Branch', key: 'branch', width: 16 },
            { header: 'Edition', key: 'name', width: 22 },
            { header: 'Pullout', key: 'pullout', width: 16 },
            { header: 'Avg Delay (min)', key: 'avg', width: 16 },
            { header: 'Entries', key: 'count', width: 10 },
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
        <div className="card">
          <h2>{profile?.role === 'edition_incharge' ? 'My Reports' : 'Reports (Director-Ready)'}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {['daily','weekly','monthly','half_yearly','yearly'].map(p => (
              <button
                key={p}
                type="button"
                className={p === period ? '' : 'secondary'}
                onClick={() => setPeriod(p)}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
            <button
              type="button"
              className="gold"
              onClick={handleDownload}
              disabled={exporting || (isDaily ? rows.length === 0 : avgRows.length === 0)}
              style={{ marginLeft: 'auto' }}
            >
              {exporting ? 'Preparing...' : '⬇ Download Excel'}
            </button>
          </div>
        </div>

        {loading ? <div className="card">Loading...</div> : isDaily ? (
          <div className="card" style={{ overflowX: 'auto' }}>
            <h3>Today's Detail (Which Edition Was Late/Early, and Why)</h3>
            {rows.length === 0 ? <p>No entries yet for this period.</p> : (
              <table>
                <thead>
                  <tr>
                    <th>State</th><th>Branch</th><th>Edition</th><th>Pullout</th>
                    <th>Schedule Time</th><th>Release Time</th><th>Delay/Early</th>
                    <th>Reason</th><th>Last Page</th>
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
                          <td>{r.editions?.states?.name}</td>
                          <td>{r.editions?.branch}</td>
                          <td><strong>{r.editions?.name}</strong></td>
                          <td>{r.editions?.pullout}</td>
                          <td>{r.schedule_page_time?.slice(0,5)}</td>
                          <td>{r.release_page_time?.slice(0,5)}</td>
                          <td><span className={`badge ${badge.cls}`}>{badge.text}</span></td>
                          <td>{r.delay_reason}</td>
                          <td>{r.last_page_no}</td>
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

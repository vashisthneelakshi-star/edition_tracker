'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import { exportStyledExcel } from '../../lib/exportExcel';
import AppShell from '../components/AppShell';

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

export default function ReportsPage() {
  const { profile } = useProfile();
  const [period, setPeriod] = useState('daily');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = rangeStart(period);
      const { data } = await supabase
        .from('entries')
        .select('entry_date, schedule_page_time, release_page_time, delay_minutes, last_page_no, delay_reason, editions(name, branch, pullout, states(name))')
        .gte('entry_date', from)
        .order('entry_date', { ascending: false });
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [period]);

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

  async function handleDownload() {
    setExporting(true);
    try {
      if (isDaily) {
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
          rows: rows.map(r => ({
            state: r.editions?.states?.name,
            branch: r.editions?.branch,
            edition: r.editions?.name,
            pullout: r.editions?.pullout,
            schedule: r.schedule_page_time?.slice(0,5),
            release: r.release_page_time?.slice(0,5),
            delay_minutes: r.delay_minutes,
            reason: r.delay_reason,
            last_page: r.last_page_no,
          })),
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
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
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
                  })}
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

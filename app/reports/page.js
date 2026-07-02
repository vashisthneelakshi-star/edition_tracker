'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import NavBar from '../components/NavBar';

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

export default function ReportsPage() {
  const { profile } = useProfile();
  const [period, setPeriod] = useState('daily');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = rangeStart(period);
      let query = supabase
        .from('entries')
        .select('entry_date, delay_minutes, last_page_no, delay_reason, editions(name, states(name))')
        .gte('entry_date', from)
        .order('entry_date', { ascending: false });
      const { data } = await query;
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [period]);

  // Aggregate per edition for non-daily reports
  const isDaily = period === 'daily';
  const grouped = {};
  rows.forEach(r => {
    const key = `${r.editions?.name} (${r.editions?.states?.name})`;
    if (!grouped[key]) grouped[key] = { count: 0, total: 0 };
    grouped[key].count += 1;
    grouped[key].total += r.delay_minutes;
  });
  const avgRows = Object.entries(grouped).map(([name, v]) => ({
    name, avg: Math.round(v.total / v.count), count: v.count,
  })).sort((a, b) => b.avg - a.avg);

  return (
    <>
      <NavBar profile={profile} />
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="card">
          <h2>Reports (Director-Ready)</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          </div>
        </div>

        {loading ? <div className="card">Loading...</div> : isDaily ? (
          <div className="card">
            <h3>Aaj Ki Detail (Kaunsa Edition Kitna Late/Early, Kyu)</h3>
            <table>
              <thead><tr><th>Edition</th><th>Delay/Early</th><th>Last Page</th><th>Reason</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.editions?.name} ({r.editions?.states?.name})</td>
                    <td>
                      <span className={`badge ${r.delay_minutes > 0 ? 'badge-late' : r.delay_minutes < 0 ? 'badge-early' : 'badge-ontime'}`}>
                        {r.delay_minutes === 0 ? 'On Time' : `${Math.abs(r.delay_minutes)} min ${r.delay_minutes > 0 ? 'Late' : 'Early'}`}
                      </span>
                    </td>
                    <td>{r.last_page_no}</td>
                    <td>{r.delay_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <h3>Average Delay/Early Per Edition ({period.replace('_',' ')})</h3>
            <table>
              <thead><tr><th>Edition</th><th>Avg Delay (min)</th><th>Entries</th></tr></thead>
              <tbody>
                {avgRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
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
          </div>
        )}
      </div>
    </>
  );
}

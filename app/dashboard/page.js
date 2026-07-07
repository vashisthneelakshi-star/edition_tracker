'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import { toLocalISODate } from '../../lib/dateUtils';
import AppShell from '../components/AppShell';

export default function DashboardPage() {
  const { profile } = useProfile();
  const [date, setDate] = useState(() => toLocalISODate(new Date()));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('entries')
        .select('delay_minutes, entry_date, editions(name, states(name))')
        .eq('entry_date', date);
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [date]);

  const withLabel = rows.map(r => ({
    name: `${r.editions?.name} (${r.editions?.states?.name})`,
    delay: r.delay_minutes,
  }));

  const topDelay = [...withLabel].filter(r => r.delay > 0).sort((a, b) => b.delay - a.delay).slice(0, 10);
  const topEarly = [...withLabel].filter(r => r.delay < 0).sort((a, b) => a.delay - b.delay).slice(0, 10)
    .map(r => ({ ...r, delay: Math.abs(r.delay) }));

  return (
    <AppShell profile={profile}>
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="card">
          <h2>Dashboard</h2>
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ maxWidth: 200 }} />
        </div>

        <div className="card">
          <h3>Top 10 Delayed Editions</h3>
          {loading ? <p>Loading...</p> : topDelay.length === 0 ? <p>No delayed entries for this date.</p> : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topDelay} layout="vertical" margin={{ left: 120 }}>
                <XAxis type="number" label={{ value: 'Minutes Late', position: 'insideBottom', offset: -5 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="delay" fill="#b3261e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3>Top 10 Early Editions</h3>
          {loading ? <p>Loading...</p> : topEarly.length === 0 ? <p>No early entries for this date.</p> : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topEarly} layout="vertical" margin={{ left: 120 }}>
                <XAxis type="number" label={{ value: 'Minutes Early', position: 'insideBottom', offset: -5 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="delay" fill="#1a6e3c" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AppShell>
  );
}

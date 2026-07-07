'use client';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// value: "HH:MM" string (or "" for empty). onChange receives "HH:MM".
export default function TimeSelect({ value, onChange, disabled }) {
  const [hh, mm] = value ? value.split(':') : ['', ''];

  function update(newHH, newMM) {
    if (newHH === '' || newMM === '') { onChange(''); return; }
    onChange(`${newHH}:${newMM}`);
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <select
        value={hh}
        disabled={disabled}
        onChange={e => update(e.target.value, mm || '00')}
        style={{ width: 70 }}
      >
        <option value="">HH</option>
        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span>:</span>
      <select
        value={mm}
        disabled={disabled}
        onChange={e => update(hh || '00', e.target.value)}
        style={{ width: 70 }}
      >
        <option value="">MM</option>
        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}

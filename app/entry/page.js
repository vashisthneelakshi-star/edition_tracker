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

function calcDelayLabel(scheduleTime, releaseTime) {
  if (!scheduleTime || !releaseTime) return null;
  const [sh, sm] = scheduleTime.split(':').map(Number);
  const [rh, rm] = releaseTime.split(':').map(Number);
  const diff = (rh * 60 + rm) - (sh * 60 + sm);
  if (diff === 0) return { text: 'On Time', cls: 'badge-ontime' };
  if (diff > 0) return { text: `${diff} min LATE`, cls: 'badge-late' };
  return { text: `${Math.abs(diff)} min EARLY`, cls: 'badge-early' };
}

export default function EntryPage() {
  const { loading, user, profile } = useProfile();
  const router = useRouter();

  const [edition, setEdition] = useState(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [releaseTime, setReleaseTime] = useState('');
  const [lastPageNo, setLastPageNo] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (profile && profile.role !== 'edition_incharge') { router.push('/dashboard'); return; }
    if (profile?.edition_id) {
      supabase.from('editions').select('*').eq('id', profile.edition_id).single()
        .then(({ data }) => setEdition(data));
    }
  }, [loading, user, profile, router]);

  const delayInfo = edition ? calcDelayLabel(edition.schedule_page_time?.slice(0,5), releaseTime) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(''); setMsg('');

    if (wordCount(reason) > WORD_LIMIT) {
      setErr(`Delay reason ${WORD_LIMIT} words se zyada hai. Abhi ${wordCount(reason)} words hai.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('entries').insert({
      edition_id: edition.id,
      entry_date: entryDate,
      schedule_page_time: edition.schedule_page_time,
      release_page_time: releaseTime,
      last_page_no: lastPageNo,
      delay_reason: reason,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      setErr(error.message.includes('duplicate') || error.code === '23505'
        ? 'Is date ka entry pehle se bhara ja chuka hai.'
        : 'Kuch galat hua: ' + error.message);
      return;
    }
    setMsg('Entry safaltapoorvak submit ho gaya!');
    setReleaseTime(''); setLastPageNo(''); setReason('');
  }

  if (loading || !edition) return <div className="container">Loading...</div>;

  return (
    <>
      <NavBar profile={profile} />
      <div className="container">
        <div className="card">
          <h2>Daily Page Entry</h2>
          <form onSubmit={handleSubmit}>
            <label>Date</label>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} required />

            <label>Edition Name</label>
            <input value={edition.name} readOnly className="locked-field" />

            {edition.branch && (
              <>
                <label>Branch</label>
                <input value={edition.branch} readOnly className="locked-field" />
              </>
            )}

            <label>Pullout</label>
            <input value={edition.pullout || 'MAIN'} readOnly className="locked-field" />

            <label>Schedule Page Time (Fixed)</label>
            <input value={edition.schedule_page_time?.slice(0,5)} readOnly className="locked-field" />

            <label>Release Page Time</label>
            <input type="time" value={releaseTime} onChange={e => setReleaseTime(e.target.value)} required />

            {delayInfo && (
              <div style={{ marginTop: 10 }}>
                <span className={`badge ${delayInfo.cls}`}>{delayInfo.text}</span>
              </div>
            )}

            <label>Last Page Name/No</label>
            <input value={lastPageNo} onChange={e => setLastPageNo(e.target.value)} placeholder="e.g. Page 12" />

            <label>Delay Reason (Max 100 words)</label>
            <textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason likhiye agar late/early hua ho" />
            <div style={{ fontSize: 12, color: wordCount(reason) > WORD_LIMIT ? '#c8102e' : '#888' }}>
              {wordCount(reason)}/{WORD_LIMIT} words
            </div>

            {err && <div className="error">{err}</div>}
            {msg && <div className="success">{msg}</div>}

            <button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Entry'}</button>
          </form>
        </div>
      </div>
    </>
  );
}

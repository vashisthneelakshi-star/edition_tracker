import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

function formatEntry(entry, includeEditionName) {
  const mins = entry.delay_minutes;
  const status = mins === 0 ? 'On Time' : mins > 0 ? `${mins} min LATE` : `${Math.abs(mins)} min EARLY`;
  const heading = includeEditionName
    ? `<b>${entry.editions?.name} - ${entry.editions?.pullout || 'MAIN'}</b> (${entry.editions?.branch || '—'})`
    : `<b>${entry.entry_date}</b>`;
  return `${heading} - ${status}\nDate: ${entry.entry_date}\nLast Page: ${entry.last_page_no || '-'}\nReason: ${entry.delay_reason || '-'}`;
}

function frequencyFromDate(fromDate, frequency, today) {
  if (frequency === 'weekly') fromDate.setDate(today.getDate() - 7);
  else if (frequency === 'monthly') fromDate.setMonth(today.getMonth() - 1);
  else if (frequency === 'half_yearly') fromDate.setMonth(today.getMonth() - 6);
  else if (frequency === 'yearly') fromDate.setFullYear(today.getFullYear() - 1);
  return fromDate;
}

// This route is triggered daily by Vercel Cron (see vercel.json).
// It checks which frequency buckets should fire "today" and sends the relevant report.
export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const isMonday = today.getDay() === 1;
  const isFirstOfMonth = today.getDate() === 1;
  const isFirstOfHalfYear = isFirstOfMonth && [0, 6].includes(today.getMonth());
  const isFirstOfYear = isFirstOfMonth && today.getMonth() === 0;

  const dueFrequencies = ['daily'];
  if (isMonday) dueFrequencies.push('weekly');
  if (isFirstOfMonth) dueFrequencies.push('monthly');
  if (isFirstOfHalfYear) dueFrequencies.push('half_yearly');
  if (isFirstOfYear) dueFrequencies.push('yearly');

  const { data: links } = await supabaseAdmin
    .from('telegram_links')
    .select('*, editions(name, branch, pullout, states(name)), states(name)')
    .eq('active', true)
    .in('frequency', dueFrequencies);

  let sentCount = 0;

  for (const link of links || []) {
    const fromDate = frequencyFromDate(new Date(today), link.frequency, today);
    const fromStr = fromDate.toISOString().slice(0, 10);

    if (link.scope_type === 'state') {
      // Fetch every entry for every edition in this state
      const { data: editionsInState } = await supabaseAdmin
        .from('editions')
        .select('id')
        .eq('state_id', link.state_id);

      const editionIds = (editionsInState || []).map(e => e.id);
      if (editionIds.length === 0) continue;

      const { data: entries } = await supabaseAdmin
        .from('entries')
        .select('*, editions(name, branch, pullout)')
        .in('edition_id', editionIds)
        .gte('entry_date', fromStr)
        .order('entry_date', { ascending: false });

      if (!entries || entries.length === 0) continue;

      const stateName = link.states?.name || 'State';
      let message = `📰 <b>${stateName} — State Report</b>\nReport type: ${link.frequency}\n\n`;
      message += entries.map(e => formatEntry(e, true)).join('\n\n');

      await sendTelegramMessage(link.chat_id, message);
      sentCount++;
    } else {
      // Edition-specific recipient
      const { data: entries } = await supabaseAdmin
        .from('entries')
        .select('*')
        .eq('edition_id', link.edition_id)
        .gte('entry_date', fromStr)
        .order('entry_date', { ascending: false });

      if (!entries || entries.length === 0) continue;

      const editionName = `${link.editions?.name} - ${link.editions?.pullout || 'MAIN'} (${link.editions?.branch || '—'}, ${link.editions?.states?.name || ''})`;
      let message = `📰 <b>${editionName}</b>\nReport type: ${link.frequency}\n\n`;
      message += entries.map(e => formatEntry(e, false)).join('\n\n');

      await sendTelegramMessage(link.chat_id, message);
      sentCount++;
    }
  }

  return NextResponse.json({ success: true, sent: sentCount, frequenciesChecked: dueFrequencies });
}

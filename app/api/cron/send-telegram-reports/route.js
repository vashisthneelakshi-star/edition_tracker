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

function formatEntry(entry) {
  const mins = entry.delay_minutes;
  const status = mins === 0 ? 'On Time' : mins > 0 ? `${mins} min LATE` : `${Math.abs(mins)} min EARLY`;
  return `<b>${entry.entry_date}</b> - ${status}\nLast Page: ${entry.last_page_no || '-'}\nReason: ${entry.delay_reason || '-'}`;
}

// This route is triggered daily by Vercel Cron (see vercel.json).
// It checks which frequency buckets should fire "today" and sends the relevant report.
export async function GET(req) {
  // Basic protection - Vercel Cron sends this header automatically
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const isMonday = today.getDay() === 1;
  const isFirstOfMonth = today.getDate() === 1;
  const isFirstOfHalfYear = isFirstOfMonth && [0, 6].includes(today.getMonth()); // Jan 1 / Jul 1
  const isFirstOfYear = isFirstOfMonth && today.getMonth() === 0;

  const dueFrequencies = ['daily'];
  if (isMonday) dueFrequencies.push('weekly');
  if (isFirstOfMonth) dueFrequencies.push('monthly');
  if (isFirstOfHalfYear) dueFrequencies.push('half_yearly');
  if (isFirstOfYear) dueFrequencies.push('yearly');

  const { data: links } = await supabaseAdmin
    .from('telegram_links')
    .select('*, editions(name, states(name))')
    .eq('active', true)
    .in('frequency', dueFrequencies);

  let sentCount = 0;

  for (const link of links || []) {
    // Fetch relevant entries depending on frequency window
    let fromDate = new Date();
    if (link.frequency === 'weekly') fromDate.setDate(fromDate.getDate() - 7);
    else if (link.frequency === 'monthly') fromDate.setMonth(fromDate.getMonth() - 1);
    else if (link.frequency === 'half_yearly') fromDate.setMonth(fromDate.getMonth() - 6);
    else if (link.frequency === 'yearly') fromDate.setFullYear(fromDate.getFullYear() - 1);
    else fromDate = today; // daily = just today

    const { data: entries } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('edition_id', link.edition_id)
      .gte('entry_date', fromDate.toISOString().slice(0, 10))
      .order('entry_date', { ascending: false });

    if (!entries || entries.length === 0) continue;

    const editionName = `${link.editions?.name} (${link.editions?.states?.name})`;
    let message = `📰 <b>${editionName}</b>\nReport type: ${link.frequency}\n\n`;
    message += entries.map(formatEntry).join('\n\n');

    await sendTelegramMessage(link.chat_id, message);
    sentCount++;
  }

  return NextResponse.json({ success: true, sent: sentCount, frequenciesChecked: dueFrequencies });
}

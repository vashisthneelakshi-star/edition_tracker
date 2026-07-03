import { NextResponse } from 'next/server';

// Uses Google Translate's public web endpoint (no API key needed).
// This is best-effort: if it fails or is rate-limited, we fall back to the original text.
export async function POST(req) {
  let text = '';
  try {
    const body = await req.json();
    text = body.text || '';
    if (!text.trim()) {
      return NextResponse.json({ translated: '' });
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Translate request failed');
    const data = await res.json();
    const translated = (data[0] || []).map(chunk => chunk[0]).join('');

    return NextResponse.json({ translated: translated || text });
  } catch (e) {
    // Fallback: return original text untranslated rather than failing the export
    return NextResponse.json({ translated: text });
  }
}

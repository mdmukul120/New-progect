/**
 * POST /api/chat — OpenRouter-এ স্ট্রিমিং প্রক্সি।
 * API key শুধু সার্ভারের env-এ (OPENROUTER_API_KEY) থাকে, ব্রাউজারে কখনো যায় না।
 * লোকাল টেস্টের জন্য OPENROUTER_BASE দিয়ে upstream বদলানো যায়।
 */

const UPSTREAM = (process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

// সহজ ইন-মেমরি রেট লিমিট (best effort: serverless instance-প্রতি)
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_PER_WINDOW;
}

function send(res, status, obj) {
  res.status(status);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return send(res, 405, { error: { message: 'শুধু POST অনুমোদিত' } });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return send(res, 500, {
      error: { message: 'সার্ভারে OPENROUTER_API_KEY সেট করা নেই (Vercel → Settings → Environment Variables)' }
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || !body.model || !Array.isArray(body.messages) || !body.messages.length) {
    return send(res, 400, { error: { message: 'model ও messages দরকার' } });
  }

  if (typeof body.model !== 'string' || (!body.model.endsWith(':free') && body.model !== 'openrouter/free')) {
    return send(res, 400, { error: { message: 'সার্ভার-মোডে শুধু ফ্রি মডেল অনুমোদিত' } });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    return send(res, 429, { error: { message: 'খুব বেশি রিকোয়েস্ট — কিছুক্ষণ পর চেষ্টা করুন (৫ মিনিটে ৩০টি)' } });
  }

  const messages = body.messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system') && typeof m.content === 'string')
    .slice(-24)
    .map(m => ({ role: m.role, content: m.content.slice(0, 24000) }));

  const payload = {
    model: String(body.model),
    messages,
    stream: body.stream !== false,
    temperature: typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 2) : 0.7,
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 1200, 64), 3000)
  };

  const origin = req.headers.origin || 'https://' + (req.headers.host || 'localhost');

  let upstream;
  try {
    upstream = await fetch(UPSTREAM + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': origin,
        'X-Title': 'Hybrid Chat'
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return send(res, 502, { error: { message: 'OpenRouter-এ পৌঁছানো যায়নি: ' + String(e.message || e) } });
  }

  if (!upstream.ok) {
    let detail = '';
    try { detail = await upstream.text(); } catch {}
    res.status(upstream.status);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(detail || JSON.stringify({ error: { message: 'OpenRouter HTTP ' + upstream.status } }));
  }

  // স্ট্রিমিং পাস-থ্রু
  res.status(200);
  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  if (!upstream.body) {
    const txt = await upstream.text();
    res.write(txt);
    return res.end();
  }

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (e) {
    // ক্লায়েন্ট আগে বন্ধ করলে বা upstream ভাঙলে — চুপচাপ শেষ
  }
  res.end();
};

module.exports.config = { maxDuration: 60 };

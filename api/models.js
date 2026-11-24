/**
 * GET /api/models — OpenRouter-এর মডেল তালিকা (OpenAI-সামঞ্জস্যপূর্ণ `{data:[{id}]}` আকারে)।
 * key সার্ভারেই থাকে। ১ ঘণ্টা ক্যাশ।
 */

const UPSTREAM = (process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'GET, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: { message: 'শুধু GET অনুমোদিত' } });
    return;
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    res.status(500).json({
      error: { message: 'সার্ভারে OPENROUTER_API_KEY সেট করা নেই (Vercel → Settings → Environment Variables)' }
    });
    return;
  }

  try {
    const r = await fetch(UPSTREAM + '/models', { headers: { Authorization: 'Bearer ' + key } });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      res.status(r.status);
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(t || JSON.stringify({ error: { message: 'OpenRouter HTTP ' + r.status } }));
      return;
    }
    const j = await r.json();
    const list = (j.data || [])
      .filter(m => m && typeof m.id === 'string')
      .map(m => ({
        id: m.id,
        name: m.name || m.id,
        context: m.context_length || null,
        free: /:free$/.test(m.id)
      }))
      .sort((a, b) => (a.free === b.free ? a.id.localeCompare(b.id) : a.free ? -1 : 1));

    res.status(200);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.end(JSON.stringify({ data: list, free: list.filter(m => m.free).length, total: list.length }));
  } catch (e) {
    res.status(502).json({ error: { message: 'OpenRouter-এ পৌঁছানো যায়নি: ' + String(e.message || e) } });
  }
};

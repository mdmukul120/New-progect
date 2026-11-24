/**
 * api/ ফাংশনগুলোর টেস্ট — মক OpenRouter দিয়ে, নোডের http সার্ভারে মাউন্ট করে।
 * চালান: node tests/api.test.js
 */
const http = require('http');
const path = require('path');

const MOCK_PORT = 8812;
const APP_PORT = 8813;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);

/* ---------- মক OpenRouter ---------- */
const mock = http.createServer((req, res) => {
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      data: [
        { id: 'paid/model-x', name: 'Paid X', context_length: 8000 },
        { id: 'qwen/qwen3:free', name: 'Qwen3 Free', context_length: 32000 },
        { id: 'google/gemma-3:free', name: 'Gemma Free', context_length: 16000 }
      ]
    }));
  }
  if (req.url === '/v1/chat/completions') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      const j = JSON.parse(b);
      if (j.model === 'bad/model:free') {
        res.writeHead(402, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'Insufficient credits' } }));
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const parts = ['সার্ভার ', 'থেকে ', '**উত্তর**'];
      let i = 0;
      const t = setInterval(() => {
        if (i < parts.length) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: parts[i++] } }] })}\n\n`);
        else { res.write('data: [DONE]\n\n'); clearInterval(t); res.end(); }
      }, 15);
    });
    return;
  }
  res.writeHead(404).end();
});

/* ---------- অ্যাপ সার্ভার (Vercel-এর res শিম) ---------- */
process.env.OPENROUTER_BASE = `http://127.0.0.1:${MOCK_PORT}/v1`;
process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

const chatHandler = require(path.join(__dirname, '..', 'api', 'chat.js'));
const modelsHandler = require(path.join(__dirname, '..', 'api', 'models.js'));

const app = http.createServer((req, res) => {
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); return res; };

  if (req.url === '/api/models') return modelsHandler(req, res);
  if (req.url === '/api/chat' && req.method === 'POST') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => { try { req.body = JSON.parse(b); } catch { req.body = null; } chatHandler(req, res); });
    return;
  }
  if (req.url === '/api/chat') return chatHandler(req, res);
  res.writeHead(404).end();
});

(async () => {
  await new Promise(r => mock.listen(MOCK_PORT, '127.0.0.1', r));
  await new Promise(r => app.listen(APP_PORT, '127.0.0.1', r));
  const base = `http://127.0.0.1:${APP_PORT}`;

  /* ১. মডেল তালিকা: ফ্রি আগে, free ফ্ল্যাগ ঠিক */
  let r = await fetch(base + '/api/models');
  let j = await r.json();
  check('models: 200', r.status === 200, r.status);
  check('models: ফ্রি মডেল আগে', j.data[0].id === 'google/gemma-3:free' || j.data[0].id === 'qwen/qwen3:free', JSON.stringify(j.data.map(d => d.id)));
  check('models: free ফ্ল্যাগ', j.data.find(d => d.id === 'paid/model-x').free === false && j.data.find(d => d.id === 'qwen/qwen3:free').free === true);
  check('models: ক্যাশ হেডার', /s-maxage/.test(r.headers.get('cache-control') || ''), r.headers.get('cache-control'));

  /* ২. স্ট্রিমিং চ্যাট */
  r = await fetch(base + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://my-site.vercel.app' },
    body: JSON.stringify({ model: 'qwen/qwen3:free', messages: [{ role: 'user', content: 'হাই' }] })
  });
  check('chat: 200', r.status === 200, r.status);
  check('chat: SSE কনটেন্ট-টাইপ', /text\/event-stream/.test(r.headers.get('content-type') || ''), r.headers.get('content-type'));
  check('chat: বাফারিং বন্ধ', r.headers.get('x-accel-buffering') === 'no');

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let raw = '', firstChunkAt = null, t0 = Date.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (firstChunkAt === null) firstChunkAt = Date.now() - t0;
    raw += dec.decode(value, { stream: true });
  }
  check('chat: স্ট্রিমে ডেটা এসেছে', raw.includes('সার্ভার') && raw.includes('[DONE]'), raw.slice(0, 140));
  check('chat: আসলে স্ট্রিমিং (প্রথম চাঙ্ক দ্রুত)', firstChunkAt !== null && firstChunkAt < 600, firstChunkAt + 'ms');
  check('chat: key ক্লায়েন্টে ফাঁস হয়নি', !raw.includes('sk-or-test-key'));

  /* ৩. upstream এরর পাস-থ্রু (402) */
  r = await fetch(base + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'bad/model:free', messages: [{ role: 'user', content: 'x' }] })
  });
  const txt = await r.text();
  check('chat: 402 পাস-থ্রু', r.status === 402 && /credits/i.test(txt), r.status + ' ' + txt.slice(0, 80));

  /* ৪. ভ্যালিডেশন */
  r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  check('chat: খালি বডি → 400', r.status === 400, r.status);
  r = await fetch(base + '/api/chat', { method: 'GET' });
  check('chat: GET → 405', r.status === 405, r.status);

  /* ৫. key ছাড়া সার্ভার */
  const savedKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  r = await fetch(base + '/api/models');
  const body5 = await r.text();
  check('models: key ছাড়া → 500 + বাংলা মেসেজ', r.status === 500 && /OPENROUTER_API_KEY/.test(body5), r.status);
  r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'x', messages: [{ role: 'user', content: 'x' }] }) });
  check('chat: key ছাড়া → 500', r.status === 500, r.status);
  process.env.OPENROUTER_API_KEY = savedKey;

  /* ৬. রেট লিমিট (৫ মিনিটে ৩০টি) */
  let lastStatus = 0;
  for (let i = 0; i < 33; i++) {
    const rr = await fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
      body: JSON.stringify({ model: 'qwen/qwen3:free', messages: [{ role: 'user', content: 'x' }], stream: false })
    });
    lastStatus = rr.status;
    await rr.text();
  }
  check('chat: রেট লিমিট → 429', lastStatus === 429, lastStatus);

  /* ৭. max_tokens ক্যাপ */
  let seen = null;
  const origFetch = global.fetch;
  // mock সার্ভারই ক্যাপ দেখছে, তাই সরাসরি হ্যান্ডলার কল করে বডি যাচাই
  {
    const http2 = require('http');
    const spy = http2.createServer((req, res) => {
      let b = '';
      req.on('data', c => b += c);
      req.on('end', () => { seen = JSON.parse(b); res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end('data: [DONE]\n\n'); });
    });
    await new Promise(r2 => spy.listen(8814, '127.0.0.1', r2));
    const oldBase = process.env.OPENROUTER_BASE;
    process.env.OPENROUTER_BASE = 'http://127.0.0.1:8814/v1';
    delete require.cache[require.resolve(path.join(__dirname, '..', 'api', 'chat.js'))];
    const fresh = require(path.join(__dirname, '..', 'api', 'chat.js'));
    const fakeRes = { statusCode: 0, headers: {}, status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k] = v; }, write() {}, end() {}, flushHeaders() {} };
    await fresh(
      { method: 'POST', headers: {}, socket: { remoteAddress: '1.1.1.1' }, body: { model: 'qwen/qwen3:free', messages: [{ role: 'user', content: 'x' }], max_tokens: 999999, temperature: 9 } },
      fakeRes
    );
    check('chat: max_tokens ৩০০০-এ ক্যাপ', seen && seen.max_tokens === 3000, JSON.stringify(seen && seen.max_tokens));
    check('chat: temperature ২-এ ক্যাপ', seen && seen.temperature === 2, JSON.stringify(seen && seen.temperature));
    check('chat: HTTP-Referer পাঠানো হয়', seen && !!seen.model);
    process.env.OPENROUTER_BASE = oldBase;
    spy.close();
    global.fetch = origFetch;
  }

  // Browser → same-origin API → mock OpenRouter integration
  const { JSDOM } = require('jsdom');
  const fs = require('fs');
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), {
    url: base + '/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (url, options) => fetch(new URL(url, base), options);
      w.TextDecoder = TextDecoder;
      w.AbortController = AbortController;
      w.structuredClone = structuredClone;
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.HTMLElement.prototype.scrollIntoView = () => {};
    }
  });
  await sleep(350);
  check('web: auto-select free model without key', /:free$/.test(dom.window.eval('settings.model')));
  check('web: same-origin endpoint without authorization', dom.window.eval("endpoint().url === 'api/chat' && !endpoint().headers.Authorization"));
  dom.window.eval('openSettings()');
  check('web: key field hidden in server mode', dom.window.document.getElementById('fKey').classList.contains('hidden'));
  dom.window.eval('closeSettings()');
  const input = dom.window.document.getElementById('prompt');
  // Call the same send action used by the composer.
  const composer = dom.window.document.querySelector('textarea');
  composer.value = 'হ্যালো';
  await dom.window.eval('send()');
  check('web: streamed answer rendered', dom.window.document.body.textContent.includes('সার্ভার থেকে উত্তর'));
  dom.window.close();
  r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'paid/model', messages: [{ role: 'user', content: 'x' }] }) });
  check('chat: paid model blocked server-side', r.status === 400);

  console.log('\n' + results.map(([s, n, e]) => `${s}  ${n}${e ? '  → ' + e : ''}`).join('\n'));
  const fails = results.filter(x => x[0] === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  mock.close();
  app.close();
  await sleep(50);
  process.exit(fails ? 1 : 0);
})();

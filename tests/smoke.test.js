const http = require('http');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 8811;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'mock-model' }, { id: 'qwen/qwen3:free' }, { id: 'paid/model' }] }));
  }
  if (req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const j = JSON.parse(body);
      if (j.model === 'fail-model') {
        res.writeHead(429, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'Rate limit exceeded (free tier)' } }));
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const parts = ['নমস্কার', '! আমি ', 'একটা **মক** মডেল।\n\n```js\nconsole.log(1)\n```'];
      let i = 0;
      const t = setInterval(() => {
        if (i < parts.length) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: parts[i++] } }] })}\n\n`);
        else { res.write('data: [DONE]\n\n'); clearInterval(t); res.end(); }
      }, 20);
    });
    return;
  }
  res.writeHead(404).end();
});

function makeDom(settingsExtra, chatsPreset, activePreset) {
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost:8000/',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (...a) => global.fetch(...a);
      w.TextDecoder = TextDecoder;
      w.AbortController = AbortController;
      w.ReadableStream = ReadableStream;
      w.structuredClone = structuredClone;
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => {} } });
      const settings = {
        provider: 'custom',
        keys: { custom: 'test' },
        bases: { custom: `http://127.0.0.1:${PORT}/v1` },
        model: 'mock-model',
        ...settingsExtra
      };
      w.localStorage.setItem('hc.settings.v1', JSON.stringify(settings));
      if (chatsPreset) w.localStorage.setItem('hc.chats.v1', JSON.stringify(chatsPreset));
      if (activePreset) w.localStorage.setItem('hc.active.v1', activePreset);
    }
  });
  return dom;
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const results = [];
  const check = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };

  // ---- test 1: streaming success ----
  let dom = makeDom({});
  let w = dom.window;
  await sleep(120);
  check('boot: welcome screen rendered', /ফ্রি/.test(w.document.getElementById('streamIn').textContent));
  check('boot: model chip shows model', w.document.getElementById('modelChipText').textContent === 'mock-model');

  const input = w.document.getElementById('input');
  input.value = 'হাই, কেমন আছো?';
  w.document.getElementById('btnSend').dispatchEvent(new w.Event('click', { bubbles: true }));
  await sleep(1500);

  const main = w.document.getElementById('streamIn');
  const text = main.textContent;
  check('stream: assistant reply arrived', text.includes('নমস্কার') && text.includes('মক'), JSON.stringify(text.slice(0, 90)));
  check('stream: markdown bold rendered', !!main.querySelector('strong'));
  check('stream: code block rendered with copy btn', !!main.querySelector('pre [data-copy]'));
  check('stream: user message shown', text.includes('হাই, কেমন আছো?'));
  check('stream: no cursor left', !main.querySelector('.cursor'));
  check('chat: saved to localStorage', (JSON.parse(w.localStorage.getItem('hc.chats.v1'))[0].messages || []).length === 2);
  check('chat: title auto-set', JSON.parse(w.localStorage.getItem('hc.chats.v1'))[0].title === 'হাই, কেমন আছো?');
  const errBoxes = main.querySelectorAll('.errbox').length;
  check('stream: no error box', errBoxes === 0, 'errboxes=' + errBoxes);

  // ---- test 2: rate-limit error surfaced ----
  dom = makeDom({ model: 'fail-model' });
  w = dom.window;
  await sleep(120);
  w.document.getElementById('input').value = 'টেস্ট';
  w.document.getElementById('btnSend').dispatchEvent(new w.Event('click', { bubbles: true }));
  await sleep(900);
  const errHtml = w.document.querySelector('.errbox')?.innerHTML || '';
  check('error: 429 shown', /429/.test(errHtml), errHtml.slice(0, 120).replace(/\n/g, ' '));
  check('error: bengali hint for rate limit', /লিমিট/.test(errHtml));

  // ---- test 3: OpenRouter path free-only filter ----
  dom = makeDom({
    provider: 'openrouter', model: '', freeOnly: true,
    keys: { openrouter: 'sk-or-test' },
    bases: { openrouter: `http://127.0.0.1:${PORT}/v1` }
  });
  w = dom.window;
  await sleep(120);
  w.document.getElementById('btnSettings').dispatchEvent(new w.Event('click', { bubbles: true }));
  check('settings: modal opens', !w.document.getElementById('settingsOverlay').classList.contains('hidden'));
  w.document.getElementById('btnRefreshModels').dispatchEvent(new w.Event('click', { bubbles: true }));
  await sleep(600);
  let opts = [...w.document.getElementById('selModel').options].map(o => o.value).filter(Boolean);
  check('models: free-only keeps :free models', opts.includes('qwen/qwen3:free'), JSON.stringify(opts));
  check('models: free-only hides paid models', !opts.includes('paid/model') && !opts.includes('mock-model'), JSON.stringify(opts));

  // ---- test 4: cached chats restore on reload ----
  const preset = [
    { id: 'c1', title: 'পুরোনো চ্যাট', messages: [{ role: 'user', content: 'আগের প্রশ্ন' }, { role: 'assistant', content: 'আগের **উত্তর**' }], updated: Date.now() },
    { id: 'c2', title: 'দ্বিতীয় চ্যাট', messages: [{ role: 'user', content: 'x' }], updated: Date.now() - 1000 }
  ];
  dom = makeDom({}, preset, 'c1');
  w = dom.window;
  await sleep(150);
  const t = w.document.getElementById('streamIn').textContent;
  check('restore: active chat messages shown', t.includes('আগের প্রশ্ন') && t.includes('আগের'));
  check('restore: markdown in restored msg', !!w.document.querySelector('#streamIn strong'));
  check('restore: header title from chat', w.document.getElementById('hTitle').textContent === 'পুরোনো চ্যাট');
  check('restore: sidebar lists both chats', w.document.querySelectorAll('.chatitem').length === 2);

  // delete second chat
  w.document.querySelector('[data-del="c2"]').dispatchEvent(new w.Event('click', { bubbles: true }));
  await sleep(80);
  check('delete: chat removed from sidebar', w.document.querySelectorAll('.chatitem').length === 1);
  check('delete: persisted', JSON.parse(w.localStorage.getItem('hc.chats.v1')).length === 1);

  // new chat button
  w.document.getElementById('btnNew').dispatchEvent(new w.Event('click', { bubbles: true }));
  await sleep(80);
  check('new chat: welcome shown again', /ফ্রি/.test(w.document.getElementById('streamIn').textContent));

  // ---- report ----
  console.log('\n' + results.map(([s, n, e]) => `${s}  ${n}${e && s === 'FAIL' ? '  → ' + String(e).slice(0, 200) : ''}`).join('\n'));
  const fails = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  server.close();
  process.exit(fails ? 1 : 0);
})();

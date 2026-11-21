/* ==========================================================================
   ChinFetcher — API client layer
   Base: https://chinfetcher.duckdns.org
   Endpoints: /api/providers /api/catalog /api/posts /api/search
              /api/info  /api/episodes  /api/stream
   ========================================================================== */

export const API_BASE = 'https://chinfetcher.duckdns.org';

/* ---------- low level fetch with timeout + abort ---------- */

const cache = new Map();          // url -> { at, data }
const CACHE_TTL = 90 * 1000;      // 90s in-memory cache

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* CORS relays used only when a direct browser call is blocked. */
const RELAYS = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];
let relayIndex = -1; // -1 = direct

async function request(url, timeout, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
      mode: 'cors',
      credentials: 'omit',
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }

    if (!res.ok) {
      const msg = json?.error || json?.message || `HTTP ${res.status}`;
      throw new ApiError(msg, res.status);
    }
    if (!json) throw new ApiError('Invalid JSON response', res.status);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function rawFetch(url, { timeout = 22000, signal } = {}) {
  // try the relay that worked last time first, then direct, then the rest
  const order = relayIndex >= 0
    ? [relayIndex, -1, ...RELAYS.map((_, i) => i).filter((i) => i !== relayIndex)]
    : [-1, ...RELAYS.map((_, i) => i)];

  let lastErr;
  for (const idx of order) {
    const target = idx === -1 ? url : RELAYS[idx](url);
    try {
      const data = await request(target, timeout, signal);
      relayIndex = idx;
      return data;
    } catch (err) {
      lastErr = err;
      // a real HTTP answer from the API (404/500) is not a transport problem:
      // do not mask it behind relays.
      if (err instanceof ApiError && err.status && err.status !== 0) throw err;
      if (err.name === 'AbortError') throw new ApiError('Request timed out', 0);
    }
  }
  throw lastErr;
}

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    u.set(k, String(v));
  }
  return u.toString();
}

/** GET with retry + cache. */
export async function api(path, params = {}, opts = {}) {
  const url = `${API_BASE}${path}${Object.keys(params).length ? '?' + qs(params) : ''}`;

  if (!opts.noCache) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < (opts.ttl ?? CACHE_TTL)) return hit.data;
  }

  const attempts = opts.retries ?? 2;
  let lastErr;
  for (let i = 0; i <= attempts; i++) {
    try {
      const data = await rawFetch(url, opts);
      if (data?.success === false) throw new ApiError(data.error || 'Request failed', 200);
      cache.set(url, { at: Date.now(), data });
      return data;
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') throw new ApiError('Request timed out', 0);
      if (i < attempts) await sleep(350 * (i + 1));
    }
  }
  throw lastErr;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** POST JSON (used as a fallback when a deployment exposes write-style routes). */
export async function apiPost(path, body, opts = {}) {
  const url = `${API_BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? 18000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    if (!res.ok) throw new ApiError(json?.error || `HTTP ${res.status}`, res.status);
    if (!json) throw new ApiError('Invalid JSON response', res.status);
    if (json.success === false) throw new ApiError(json.error || 'Request failed', 200);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- normalisers ---------- */

export const flatten = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
export const unwrap = (res) => (res?.data !== undefined ? res.data : res);

/* ---------- endpoint wrappers ---------- */

export async function getProviders() {
  const res = await api('/api/providers', {}, { ttl: 10 * 60 * 1000, retries: 3 });
  return flatten(res).map((p) => ({
    id: p.id,
    name: p.name || p.id,
    nonStreamable: Array.isArray(p.nonStreamableServer) ? p.nonStreamableServer : [],
  }));
}

export async function getCatalog(provider) {
  const res = await api('/api/catalog', { provider }, { retries: 1 });
  const cats = flatten(res);
  return cats.length ? cats : [{ title: 'Latest', filter: '' }];
}

export async function getPosts(provider, filter = '', page = 1, opts = {}) {
  const res = await api('/api/posts', { provider, filter, page }, { retries: 1, ...opts });
  return flatten(res).map((p) => ({ ...p, provider }));
}

export async function searchPosts(provider, query, page = 1) {
  const res = await api('/api/search', { provider, q: query, query, page }, { retries: 1, noCache: true });
  return flatten(res).map((p) => ({ ...p, provider }));
}

/**
 * Post details (link list / streams / episodes entry-point).
 * The public docs describe this as GET /api/info?provider=&link=; the live
 * deployment answers under /api/meta as well in some builds, so both are tried.
 */
export async function getInfo(provider, link) {
  const candidates = [
    ['/api/info', { provider, link }],
    ['/api/meta', { provider, link }],
    ['/api/info', { provider, url: link }],
  ];
  let lastErr;
  for (const [path, params] of candidates) {
    try {
      const res = await api(path, params, { retries: 0 });
      const data = unwrap(res);
      if (data && (data.linkList || data.title || data.streams)) return normaliseInfo(data, provider);
    } catch (e) { lastErr = e; }
  }
  // some builds expose the same route as POST JSON
  for (const path of ['/api/info', '/api/meta']) {
    try {
      const res = await apiPost(path, { provider, link });
      const data = unwrap(res);
      if (data && (data.linkList || data.title || data.streams)) return normaliseInfo(data, provider);
    } catch (e) { lastErr = lastErr || e; }
  }
  throw lastErr || new ApiError('Details unavailable for this link', 404);
}

export async function getEpisodes(provider, url) {
  try {
    const res = await api('/api/episodes', { provider, url }, { retries: 1 });
    const list = flatten(res);
    if (list.length) return list.map((e) => ({ ...e, provider }));
  } catch { /* fall through to POST */ }
  const res = await apiPost('/api/episodes', { provider, url });
  return flatten(res).map((e) => ({ ...e, provider }));
}

export async function getStream(provider, link, type = 'movie') {
  try {
    const res = await api('/api/stream', { provider, link, type }, { retries: 1, noCache: true });
    const list = flatten(res);
    if (list.length) return list;
  } catch { /* fall through to POST */ }
  const res = await apiPost('/api/stream', { provider, link, type });
  return flatten(res);
}

/* ---------- shaping ---------- */

function normaliseInfo(d, provider) {
  const links = d.linkList || d.links || [];
  return {
    title: d.title || '',
    image: d.image || d.poster || '',
    poster: d.poster || d.image || '',
    synopsis: d.synopsis || d.description || '',
    type: d.type || 'movie',
    imdbId: d.imdbId,
    tmdbId: d.tmdbId,
    rating: d.rating,
    tags: d.tags || [],
    cast: d.cast || [],
    webUrl: d.webUrl,
    provider,
    linkList: links.map((l) => ({
      title: l.title || l.quality || 'Source',
      quality: l.quality || extractQuality(l.title || ''),
      size: l.size || '',
      link: l.link || l.url || '',
      type: l.type || '',
      episodesLink: l.episodesLink || '',
      isEpisode: !!l.isEpisode,
      raw: l,
    })).filter((l) => l.link || l.episodesLink),
  };
}

export function extractQuality(text = '') {
  const all = String(text).match(/(2160p|1440p|1080p|720p|480p|360p|4K)/gi) || [];
  if (!all.length) return '';
  const order = ['360p', '480p', '720p', '1080p', '1440p', '2160p'];
  const best = all
    .map((v) => (v.toLowerCase() === '4k' ? '2160p' : v.toLowerCase()))
    .sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
  return best || '';
}

export function extractSize(text = '') {
  const all = [...String(text).matchAll(/\[?([\d.]+)\s*(GB|MB)\]?/gi)];
  if (!all.length) return '';
  const inMb = (m, u) => (u.toUpperCase() === 'GB' ? parseFloat(m) * 1024 : parseFloat(m));
  const best = all
    .map((m) => ({ raw: `${m[1]} ${m[2].toUpperCase()}`, mb: inMb(m[1], m[2]) }))
    .sort((a, b) => b.mb - a.mb)[0];
  return best.raw;
}

export function cleanTitle(raw = '') {
  return String(raw)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\b(480p|720p|1080p|2160p|1440p|4K|HEVC|10Bit|x264|x265|WEB-DL|WEBRip|BluRay|HDTC|HQ|DS4K|Dual Audio|Multi Audio|ESubs|MSubs|HDRip|Full Movie|All Episodes)\b/gi, ' ')
    .replace(/\|+/g, ' ')
    .replace(/&\s*HD\b|\bHD\b|\bV\d\b/g, ' ')
    .replace(/[\s&\-–]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Derive { name, year, season, isSeries, langs } from a raw post title. */
export function parsePost(post) {
  const raw = post.title || '';
  const yearM = raw.match(/\((19|20)\d{2}\)/);
  const seasonM = raw.match(/Season\s*([\d\s\-–]+)/i);
  const isSeries = /season|series|episodes/i.test(raw);

  let name = raw;
  if (yearM) name = name.slice(0, raw.indexOf(yearM[0]));
  name = name.replace(/Season\s*[\d\s\-–]+/i, '');
  name = cleanTitle(name)
    .replace(/^[\s\-–:|]+|[\s\-–:|]+$/g, '')
    .replace(/\s{2,}/g, ' ');

  const langs = [];
  const langBlock = raw.match(/[{(\[]([^})\]]*(?:Audio|Hindi|English|Tamil|Telugu|Korean|Japanese|Spanish|French|German|Punjabi|Malayalam|Kannada|Bengali|Marathi|Dutch|Polish|Danish|Turkish|Chinese|Russian|Italian|Arabic)[^})\]]*)[})\]]/gi) || [];
  langBlock.forEach((b) => {
    b.replace(/[{}()[\]]/g, '').split(/[-–,&/]/).forEach((l) => {
      const t = l
        .replace(/\(?DD[\d.]+\)?|Audio|Multi|Dual|WeB-DL|WEB-DL|ORG|ESubs|MSubs|HD|DS4K|\bV\d\b/gi, '')
        .replace(/[\d.]+/g, '')
        .trim();
      if (t && t.length > 1 && t.length < 18 && /^[A-Za-z ]+$/.test(t) && !langs.includes(t)) langs.push(t);
    });
  });

  return {
    ...post,
    raw,
    name: name || raw,
    year: yearM ? yearM[0].slice(1, 5) : '',
    season: seasonM ? seasonM[1].trim() : '',
    isSeries,
    langs: langs.slice(0, 4),
    quality: extractQuality(raw),
    size: extractSize(raw),
  };
}

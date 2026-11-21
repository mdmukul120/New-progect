/* ==========================================================================
   ChinFetcher — application shell
   ========================================================================== */

import {
  getProviders, getCatalog, getPosts, searchPosts,
  getInfo, getEpisodes, getStream,
  parsePost, extractQuality, API_BASE, ApiError,
} from './api.js';

/* ------------------------------ tiny utils ------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const nf = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const ICONS = {
  play: '<path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor" stroke="none"/>',
  dl: '<path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z"/>',
  star: '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" fill="currentColor" stroke="none"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.3v.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.7v.2"/>',
  film: '<rect x="2.5" y="4" width="19" height="16" rx="2.2"/><path d="M7 4v16M17 4v16M2.5 12h19"/>',
  tv: '<rect x="2.5" y="6.5" width="19" height="13" rx="2.4"/><path d="M8 3l2.5 3.5M16 3l-2.5 3.5"/>',
  server: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
};

const icon = (name, size = 16, sw = 2.2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" width="${size}" height="${size}">${ICONS[name] || ''}</svg>`;

/* ------------------------------ state ------------------------------ */

const state = {
  providers: [],
  provider: 'moviesmod',
  catalog: [],
  category: { title: 'Latest', filter: '' },
  page: 1,
  posts: [],
  loading: false,
  hasMore: true,
  filters: { text: '', type: 'all', quality: 'all' },
  sortDesc: true,
  view: 'home',
  favorites: loadFavs(),
  featured: [],
  loadingPosts: 0,
  streamCount: 0,
};

function loadFavs() {
  try { return JSON.parse(localStorage.getItem('cf:favs') || '[]'); } catch { return []; }
}
function saveFavs() {
  try { localStorage.setItem('cf:favs', JSON.stringify(state.favorites.slice(0, 200))); } catch {}
}
const isFav = (link) => state.favorites.some((f) => f.link === link);

/* ------------------------------ toasts ------------------------------ */

function toast(msg, kind = 'info', ms = 3200) {
  const t = el('div', `toast ${kind}`);
  t.innerHTML = `${icon(kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info', 16)}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, ms);
}

/* ------------------------------ modal helpers ------------------------------ */

let openModals = 0;

function openModal(id) {
  const m = document.getElementById(id);
  m.classList.add('open');
  openModals++;
  document.body.classList.add('no-scroll');
  return m;
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m.classList.contains('open')) return;
  m.classList.remove('open');
  openModals = Math.max(0, openModals - 1);
  if (!openModals) document.body.classList.remove('no-scroll');
}

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) {
    const m = closer.closest('.modal');
    if (m) {
      if (m.id === 'playerModal') stopPlayer();
      closeModal(m.id);
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const open = $$('.modal.open').pop();
    if (open) {
      if (open.id === 'playerModal') stopPlayer();
      closeModal(open.id);
    }
  }
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
    e.preventDefault();
    $('#quickSearch').focus();
  }
});

/* ------------------------------ navigation ------------------------------ */

function navigate(view) {
  if (view === 'series') { navigate('browse'); renderSeries(); }
  state.view = view;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  $$('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (view === 'browse' && !state.catalog.length) initBrowse();
  if (view === 'search') setTimeout(() => $('#searchInput').focus(), 220);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { e.preventDefault(); navigate(nav.dataset.nav); }
});

/* ------------------------------ theme ------------------------------ */

(function initTheme() {
  const saved = localStorage.getItem('cf:theme');
  const dark = saved ? saved === 'dark' : true;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();

$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('cf:theme', next);
});

/* ------------------------------ header scroll ------------------------------ */

addEventListener('scroll', () => {
  $('#siteHeader').classList.toggle('scrolled', scrollY > 8);
}, { passive: true });

/* ------------------------------ cards ------------------------------ */

const PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"><defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#171b28"/><stop offset="1" stop-color="#0c0f17"/></linearGradient></defs>
  <rect width="300" height="450" fill="url(#g)"/>
  <g fill="none" stroke="#2b3245" stroke-width="7" stroke-linecap="round">
  <rect x="105" y="185" width="90" height="70" rx="9"/><path d="M105 205h90M105 235h90"/></g></svg>`);

function posterCard(post, i = 0) {
  const p = post.parsed || parsePost(post);
  const card = el('article', 'card');
  card.style.animationDelay = `${Math.min(i * 18, 300)}ms`;
  card.dataset.link = p.link;
  card.dataset.provider = p.provider;
  card.dataset.raw = p.raw || p.title || '';

  const tag = p.isSeries
    ? `<span class="tag series">Series</span>`
    : p.year && Number(p.year) >= 2025
      ? `<span class="tag new">New</span>`
      : `<span class="tag hd">${esc(p.quality || 'HD')}</span>`;

  card.innerHTML = `
    <div class="card-poster">
      <img loading="lazy" decoding="async" alt="${esc(p.name)}" src="${esc(p.image || PLACEHOLDER)}" />
      <div class="card-tags">${tag}</div>
      <button class="card-fav ${isFav(p.link) ? 'on' : ''}" data-fav aria-label="Save to my list">
        ${icon('heart', 15)}
      </button>
      <div class="card-overlay">
        <button class="btn btn-primary btn-sm" data-open>
          ${icon('play', 14)} Details &amp; Play
        </button>
      </div>
    </div>
    <div class="card-body">
      <h3 class="card-title">${esc(p.name || p.title)}</h3>
      <div class="card-sub">
        ${p.year ? `<span>${esc(p.year)}</span><span class="sep"></span>` : ''}
        <span>${esc(PROVIDER_NAME[p.provider] || p.provider || '')}</span>
        ${p.langs.length ? `<span class="sep"></span><span>${esc(p.langs[0])}</span>` : ''}
      </div>
    </div>`;

  const img = $('img', card);
  img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  img.addEventListener('error', () => {
    if (!img.src.startsWith('data:')) { img.src = PLACEHOLDER; img.classList.add('loaded'); }
  }, { once: true });
  if (img.complete) img.classList.add('loaded');

  return card;
}

let PROVIDER_NAME = {};
const providerName = (id) => PROVIDER_NAME[id] || id;

function favouriteData(p) {
  return {
    title: p.name || p.title,
    link: p.link,
    image: p.image,
    provider: p.provider,
    year: p.year,
    isSeries: p.isSeries,
    quality: p.quality,
  };
}

document.addEventListener('click', (e) => {
  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) {
    e.stopPropagation();
    const card = favBtn.closest('.card');
    const link = card.dataset.link;
    const idx = state.favorites.findIndex((f) => f.link === link);
    if (idx >= 0) {
      state.favorites.splice(idx, 1);
      favBtn.classList.remove('on');
      toast('Removed from your list', 'info', 1800);
    } else {
      const p = parsePost({ title: card.dataset.raw || $('.card-title', card).textContent, link, image: $('img', card).src, provider: card.dataset.provider });
      state.favorites.unshift(favouriteData(p));
      favBtn.classList.add('on');
      toast('Saved to your list', 'ok', 1800);
    }
    saveFavs();
    return;
  }

  const opener = e.target.closest('[data-open]');
  const card = e.target.closest('.card');
  if (opener || card) {
    const target = card;
    if (!target) return;
    openDetail(target.dataset.provider, target.dataset.link);
  }
});

/* ------------------------------ skeletons ------------------------------ */

function skeletonGrid(host, count = 12) {
  host.innerHTML = '';
  for (let i = 0; i < count; i++) {
    host.appendChild(el('div', 'sk-card', `
      <div class="sk sk-poster"></div>
      <div class="sk sk-line"></div>
      <div class="sk sk-line short"></div>`));
  }
}

function skeletonRow(host, count = 6) {
  host.innerHTML = '';
  for (let i = 0; i < count; i++) {
    host.appendChild(el('div', 'sk-card', `
      <div class="sk sk-poster"></div>
      <div class="sk sk-line"></div>
      <div class="sk sk-line short"></div>`));
  }
}

/* ------------------------------ hero ------------------------------ */

let heroTimer = null;

function buildHero(items) {
  const wrap = $('#heroSlides');
  const dots = $('#heroDots');
  wrap.innerHTML = '';
  dots.innerHTML = '';
  state.featured = items.slice(0, 5);
  state.heroIndex = 0;

  state.featured.forEach((p, i) => {
    const slide = el('div', `hero-slide ${i === 0 ? 'active' : ''}`);
    slide.innerHTML = `
      <img class="hero-bg" alt="" src="${esc(p.image)}" onerror="this.style.opacity=.25" />
      <div class="hero-scrim"></div>
      <div class="hero-body">
        <div class="hero-badges">
          <span class="pill brand">${icon('star', 12)} Featured</span>
          <span class="pill">${esc(providerName(p.provider))}</span>
          ${p.quality ? `<span class="pill cdn">${esc(p.quality)}</span>` : ''}
          ${p.isSeries ? `<span class="pill">${icon('tv', 12)} Series</span>` : `<span class="pill">${icon('film', 12)} Movie</span>`}
        </div>
        <h1 class="hero-title">${esc(p.name || p.title)}</h1>
        <div class="hero-meta">
          ${p.year ? `<span>${esc(p.year)}</span><span class="dot"></span>` : ''}
          ${p.langs.length ? `<span>${esc(p.langs.join(' · '))}</span><span class="dot"></span>` : ''}
          ${p.size ? `<span>${esc(p.size)}</span><span class="dot"></span>` : ''}
          <span>${p.isSeries ? 'Full season' : 'Full movie'}</span>
        </div>
        <div class="hero-actions">
          <button class="btn btn-primary" data-hero-open="${i}">${icon('play', 16)} Watch &amp; Download</button>
          <button class="btn btn-ghost" data-hero-fav="${i}">${icon('heart', 16)} Save</button>
        </div>
      </div>`;
    wrap.appendChild(slide);

    const dot = el('button', i === 0 ? 'active' : '');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Featured ${i + 1}`);
    dot.addEventListener('click', () => setHero(i));
    dots.appendChild(dot);
  });

  clearInterval(heroTimer);
  if (state.featured.length > 1) {
    heroTimer = setInterval(() => setHero((state.heroIndex + 1) % state.featured.length), 7000);
  }
}

function setHero(i) {
  state.heroIndex = i;
  $$('#heroSlides .hero-slide').forEach((s, k) => s.classList.toggle('active', k === i));
  $$('#heroDots button').forEach((d, k) => d.classList.toggle('active', k === i));
}

document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-hero-open]');
  if (open) {
    const p = state.featured[+open.dataset.heroOpen];
    return openDetail(p.provider, p.link);
  }
  const fav = e.target.closest('[data-hero-fav]');
  if (fav) {
    const p = state.featured[+fav.dataset.heroFav];
    if (!isFav(p.link)) {
      state.favorites.unshift(favouriteData(parsePost(p)));
      saveFavs();
      toast('Saved to your list', 'ok', 1800);
    } else {
      toast('Already in your list', 'info', 1600);
    }
  }
});

/* ------------------------------ providers ------------------------------ */

function providerInitials(name) {
  return String(name || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
}

function renderProviders() {
  const strip = $('#providerStrip');
  strip.innerHTML = '';
  state.providers.forEach((p) => {
    const b = el('button', 'provider-chip');
    b.type = 'button';
    b.dataset.provider = p.id;
    b.innerHTML = `<span class="provider-logo">${esc(providerInitials(p.name))}</span>${esc(p.name)}`;
    b.addEventListener('click', () => { openProvider(p.id); });
    strip.appendChild(b);
  });

  const list = $('#providerList');
  list.innerHTML = '';
  state.providers.forEach((p) => {
    const b = el('button', 'provider-chip' + (p.id === state.provider ? ' active' : ''));
    b.type = 'button';
    b.dataset.provider = p.id;
    b.innerHTML = `<span class="provider-logo">${esc(providerInitials(p.name))}</span>${esc(p.name)}
      ${p.nonStreamable.length ? `<span class="count">${p.nonStreamable.length}</span>` : ''}`;
    b.addEventListener('click', () => selectProvider(p.id));
    list.appendChild(b);
  });

  const sel = $('#searchProvider');
  sel.innerHTML = '<option value="all">All providers</option>' +
    state.providers.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

  const ssel = $('#seriesProvider');
  ssel.innerHTML = state.providers.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
}

function openProvider(id) {
  navigate('browse');
  selectProvider(id);
}

/* ------------------------------ browse ------------------------------ */

async function initBrowse() {
  if (!state.catalog.length) {
    await loadCatalog(state.provider, true);
  }
}

async function selectProvider(id) {
  if (state.provider === id && state.posts.length && state.view === 'browse') return;
  state.provider = id;
  $$('#providerList .provider-chip').forEach((b) => b.classList.toggle('active', b.dataset.provider === id));
  state.catalog = [];
  state.posts = [];
  state.page = 1;
  state.hasMore = true;
  $('#browseGrid').innerHTML = '';
  await loadCatalog(id, true);
}

async function loadCatalog(provider, autoLoadPosts) {
  const list = $('#categoryList');
  list.innerHTML = '<span class="chip"><span class="sk" style="width:64px;height:12px"></span></span>';
  try {
    const cats = await getCatalog(provider);
    state.catalog = cats;
    renderCategories();
    if (autoLoadPosts) {
      state.category = cats[0] || { title: 'Latest', filter: '' };
      renderCategories();
      loadPosts(true);
    }
  } catch (err) {
    list.innerHTML = '';
    toast(`Could not load categories for ${providerName(provider)}`, 'err');
    // graceful fallback: still try default feed
    state.catalog = [{ title: 'Latest', filter: '' }];
    renderCategories();
    if (autoLoadPosts) loadPosts(true);
  }
}

function renderCategories() {
  const list = $('#categoryList');
  list.innerHTML = '';
  state.catalog.forEach((c) => {
    const b = el('button', 'chip' + (c.title === state.category.title ? ' active' : ''));
    b.type = 'button';
    b.innerHTML = `<span class="chip-dot"></span>${esc(c.title)}`;
    b.addEventListener('click', () => {
      state.category = c;
      state.page = 1;
      state.posts = [];
      state.hasMore = true;
      renderCategories();
      loadPosts(true);
    });
    list.appendChild(b);
  });
  $('#categorySub').textContent = `${providerName(state.provider)} · ${state.catalog.length} categories`;
}

function applyFilters(posts) {
  const { text, type, quality } = state.filters;
  const q = text.trim().toLowerCase();
  return posts.filter((p) => {
    if (q && !(p.title || '').toLowerCase().includes(q)) return false;
    if (type === 'movie' && p.isSeries) return false;
    if (type === 'series' && !p.isSeries) return false;
    if (quality !== 'all') {
      const order = ['360p', '480p', '720p', '1080p', '2160p'];
      const want = order.indexOf(quality);
      const have = Math.max(...order.map((o, i) => ((p.title || '').includes(o) ? i : -1)));
      if (have < want) return false;
    }
    return true;
  });
}

function renderBrowse(append = false) {
  const host = $('#browseGrid');
  const mapped = state.posts.map((p) => ({ ...p, parsed: parsePost(p) }));
  const filtered = applyFilters(mapped);
  const sorted = [...filtered].sort((a, b) => {
    const ay = Number(a.parsed.year) || 0;
    const by = Number(b.parsed.year) || 0;
    return state.sortDesc ? by - ay : ay - by;
  });

  if (!append) host.innerHTML = '';

  if (!mapped.length) {
    host.innerHTML = '';
    host.appendChild(emptyState(
      'Nothing here yet',
      `This category returned no posts from ${providerName(state.provider)}. Try another category or provider.`
    ));
    $('#browseCount').textContent = '0 titles';
    return;
  }

  if (!sorted.length) {
    host.innerHTML = '';
    host.appendChild(emptyState('No matches', 'No titles match your filters. Try relaxing them.'));
    $('#browseCount').textContent = `0 of ${mapped.length} titles`;
    return;
  }

  sorted.forEach((p, i) => host.appendChild(posterCard(p, i)));
  $('#browseCount').textContent =
    `${sorted.length}${filtered.length !== state.posts.length ? ` of ${state.posts.length}` : ''} titles · page ${state.page}`;
  $('#browseTitle').textContent = state.category.title || 'Results';
  $('#loadMore').style.display = state.hasMore && !state.filters.text && state.filters.type === 'all' && state.filters.quality === 'all' ? '' : 'none';
}

async function loadPosts(reset = false) {
  if (state.loading) return;
  state.loading = true;
  const btn = $('#loadMore');
  btn.disabled = true;
  btn.textContent = 'Loading…';

  if (reset) {
    state.page = 1;
    skeletonGrid($('#browseGrid'), 12);
    $('#browseCount').textContent = 'Loading…';
  }

  try {
    const posts = await getPosts(state.provider, state.category.filter, state.page);
    const enriched = posts.map((p) => ({ ...p, parsed: parsePost(p) }));
    state.posts = reset ? enriched : [...state.posts, ...enriched];
    state.hasMore = posts.length >= 10;
    state.streamCount += 0;
    renderBrowse(!reset);
    updateStats();
  } catch (err) {
    if (reset) {
      $('#browseGrid').innerHTML = '';
      $('#browseGrid').appendChild(errorState(err, () => loadPosts(true)));
    }
    toast(`${providerName(state.provider)}: ${err.message}`, 'err');
  } finally {
    state.loading = false;
    btn.disabled = false;
    btn.innerHTML = 'Load more';
  }
}

$('#loadMore').addEventListener('click', () => {
  state.page += 1;
  loadPosts(false);
});

$('#filterInput').addEventListener('input', (e) => {
  state.filters.text = e.target.value;
  renderBrowse(false);
});
$('#typeFilter').addEventListener('change', (e) => { state.filters.type = e.target.value; renderBrowse(false); });
$('#qualityFilter').addEventListener('change', (e) => { state.filters.quality = e.target.value; renderBrowse(false); });
$('#clearFilters').addEventListener('click', () => {
  state.filters = { text: '', type: 'all', quality: 'all' };
  $('#filterInput').value = '';
  $('#typeFilter').value = 'all';
  $('#qualityFilter').value = 'all';
  renderBrowse(false);
});
$('#sortBtn').addEventListener('click', () => {
  state.sortDesc = !state.sortDesc;
  toast(state.sortDesc ? 'Newest first' : 'Oldest first', 'info', 1500);
  renderBrowse(false);
});

/* ------------------------------ shared states ------------------------------ */

function emptyState(title, body, iconName = 'film') {
  const w = el('div', 'state');
  w.style.gridColumn = '1 / -1';
  w.innerHTML = `
    <div class="state-icon">${icon(iconName, 27, 1.9)}</div>
    <div><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
  return w;
}

function errorState(err, retry) {
  const w = el('div', 'state');
  w.style.gridColumn = '1 / -1';
  w.innerHTML = `
    <div class="state-icon" style="color:var(--danger)">${icon('alert', 27, 1.9)}</div>
    <div><h3>Could not reach the API</h3><p>${esc(err.message)}</p></div>`;
  const b = el('button', 'btn btn-ghost btn-sm', `${icon('arrow', 14)} Try again`);
  b.addEventListener('click', retry);
  w.appendChild(b);
  return w;
}

/* ------------------------------ home ------------------------------ */

async function loadProviders() {
  const t0 = performance.now();
  state.providers = await getProviders();
  const ms = Math.round(performance.now() - t0);
  state.providers.forEach((p) => { PROVIDER_NAME[p.id] = p.name; });
  renderProviders();
  $('#statProviders').textContent = state.providers.length;
  $('#statLatency').textContent = `${ms}ms`;
  return ms;
}

const TRENDING_PROVIDERS = ['hdhub4u', 'moviesdrive', 'uhd', 'movies4u', 'lux', 'topmovies'];

async function loadHome() {
  skeletonGrid($('#trendingGrid'), 10);
  skeletonGrid($('#freshGrid'), 10);

  try {
    await loadProviders();
  } catch (err) {
    toast(`Providers: ${err.message}`, 'err', 5000);
  }

  // ---- trending: first few providers in parallel
  const picks = TRENDING_PROVIDERS.filter((id) => state.providers.some((p) => p.id === id));
  const trendProviders = (picks.length ? picks : state.providers.slice(0, 4).map((p) => p.id)).slice(0, 4);

  Promise.allSettled(
    trendProviders.map((id) => getPosts(id, '', 1).then((posts) => posts.map((p) => ({ ...p, parsed: parsePost(p) }))))
  ).then((results) => {
    const merged = [];
    const seen = new Set();
    // interleave for provider diversity
    const lists = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const max = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < max; i++) {
      for (const l of lists) {
        const p = l[i];
        if (!p) continue;
        const key = (p.parsed.name || '').toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(p);
        if (merged.length >= 24) break;
      }
      if (merged.length >= 24) break;
    }

    const host = $('#trendingGrid');
    host.innerHTML = '';
    if (!merged.length) {
      host.appendChild(emptyState('No trending data', 'The providers returned no posts. Try again in a moment.'));
    } else {
      merged.slice(0, 18).forEach((p, i) => host.appendChild(posterCard(p, i)));
      buildHero(merged.filter((p) => p.image && !p.image.includes('placeholder')));
    }
    updateStats(merged.length);

    // ---- fresh across all providers
    loadFreshAcross();
  });
}

async function loadFreshAcross() {
  const host = $('#freshGrid');
  const ids = state.providers.map((p) => p.id);
  const picks = [...ids].sort(() => Math.random() - 0.5).slice(0, 6);

  const results = await Promise.allSettled(
    picks.map((id) => getPosts(id, '', 1, { retries: 0 }).then((posts) => posts.map((p) => ({ ...p, parsed: parsePost(p) }))))
  );

  const merged = [];
  const seen = new Set();
  const lists = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max && merged.length < 18; i++) {
    for (const l of lists) {
      const p = l[i];
      if (!p) continue;
      const key = (p.parsed.name || '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(p);
      if (merged.length >= 18) break;
    }
  }

  host.innerHTML = '';
  if (!merged.length) {
    host.appendChild(emptyState('Could not load fresh posts', 'Every provider request failed. Check your connection and refresh.'));
  } else {
    merged.forEach((p, i) => host.appendChild(posterCard(p, i)));
  }
  updateStats(merged.length);
}

let totalLoaded = 0;
function updateStats(extra = 0) {
  totalLoaded += extra;
  $('#statTitles').textContent = nf.format(Math.max(totalLoaded, state.posts.length));
}

$('#refreshHome').addEventListener('click', () => {
  toast('Refreshing feeds…', 'info', 1600);
  loadHome();
});

document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-scroll]');
  if (!s) return;
  const host = document.getElementById(s.dataset.scroll);
  host.scrollBy({ left: Number(s.dataset.dir) * Math.min(host.clientWidth * 0.8, 900), behavior: 'smooth' });
});

/* ------------------------------ search ------------------------------ */

let searchAbort = null;

async function runSearch(query) {
  const q = (query || '').trim();
  const grid = $('#searchGrid');
  if (!q) {
    grid.innerHTML = '';
    $('#searchCount').textContent = 'Type a query to begin';
    return;
  }

  searchAbort?.abort?.();
  const provSel = $('#searchProvider').value;
  const providers = provSel === 'all'
    ? state.providers.map((p) => p.id).slice(0, 14)
    : [provSel];

  grid.innerHTML = '';
  skeletonGrid(grid, 12);
  $('#searchCount').textContent = `Searching ${providers.length} provider${providers.length > 1 ? 's' : ''}…`;
  $('#searchTitle').textContent = `“${q}”`;

  const seen = new Set();
  let rendered = 0;

  // render results progressively as each provider answers
  providers.forEach((id) => {
    searchPosts(id, q).then((posts) => {
      if (!posts.length) return;
      if (rendered === 0) grid.innerHTML = '';
      posts.forEach((raw) => {
        const p = { ...raw, parsed: parsePost(raw) };
        const key = (p.parsed.name || p.title || '').toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        grid.appendChild(posterCard(p, rendered++));
      });
      $('#searchCount').textContent = `${rendered} result${rendered === 1 ? '' : 's'} from ${providers.length} providers`;
    }).catch(() => { /* one provider failing should not break the page */ })
      .finally(() => {
        // remove skeleton if nothing at all came back
        if (rendered === 0 && grid.querySelector('.sk-card')) {
          setTimeout(() => {
            if (rendered === 0) {
              grid.innerHTML = '';
              grid.appendChild(emptyState('No results', `Nothing found for “${q}”. Try a shorter title.`, 'search'));
              $('#searchCount').textContent = '0 results';
            }
          }, 1200);
        }
      });
  });
}

$('#searchGo').addEventListener('click', () => runSearch($('#searchInput').value));
$('#searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch(e.target.value);
});
let quickTimer;
$('#quickSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    $('#searchInput').value = e.target.value;
    navigate('search');
    runSearch(e.target.value);
  }
});
$('#quickSearch').addEventListener('input', (e) => {
  clearTimeout(quickTimer);
  const v = e.target.value.trim();
  if (v.length < 2) return;
  quickTimer = setTimeout(() => {
    $('#searchInput').value = v;
    if (state.view !== 'search') navigate('search');
    runSearch(v);
  }, 520);
});

/* ------------------------------ series ------------------------------ */

async function renderSeries() {
  const grid = $('#seriesGrid');
  const provId = $('#seriesProvider').value || state.providers[0]?.id || 'moviesmod';
  skeletonGrid(grid, 12);
  try {
    const posts = await getPosts(provId, '', 1);
    const series = posts.map((p) => ({ ...p, parsed: parsePost(p) })).filter((p) => p.parsed.isSeries);
    grid.innerHTML = '';
    if (!series.length) {
      grid.appendChild(emptyState('No series in latest', `Try another provider — ${providerName(provId)} latest has no series right now.`, 'tv'));
    } else {
      series.forEach((p, i) => grid.appendChild(posterCard(p, i)));
    }
  } catch (err) {
    grid.innerHTML = '';
    grid.appendChild(errorState(err, renderSeries));
  }
}
$('#seriesProvider').addEventListener('change', renderSeries);
$('#seriesFilter').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  $$('#seriesGrid .card').forEach((c) => {
    c.style.display = !q || $('.card-title', c).textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

/* ------------------------------ detail ------------------------------ */

let currentDetail = null;

async function openDetail(provider, link) {
  const modal = openModal('detailModal');
  const content = $('#detailContent');
  $('#detailCard').scrollTop = 0;
  content.innerHTML = `<div class="detail-hero"><div class="detail-hero-inner">
      <div class="sk" style="width:180px;height:26px;border-radius:8px;margin-bottom:12px"></div>
      <div class="sk" style="width:min(420px,80%);height:16px;border-radius:6px"></div>
    </div></div><div class="detail-body">${'<div class="sk sk-line" style="margin:0 0 10px"></div>'.repeat(6)}</div>`;

  try {
    const info = await getInfo(provider, link);
    currentDetail = info;
    renderDetail(info, provider, link);
  } catch (err) {
    // graceful: show a compact fallback with a direct link to the source page
    content.innerHTML = `
      <div class="detail-body" style="padding-top:36px">
        <h2 class="detail-title" style="max-width:100%">${esc(parsePost({ title: decodeURIComponent((link || '').split('/').filter(Boolean).pop() || 'Title').replace(/-/g, ' ') }).name)}</h2>
        <div class="detail-section">
          <p class="detail-label">Extraction unavailable</p>
          <p class="synopsis">The backend could not extract this post (${esc(err.message)}). You can still open the original page in a new tab.</p>
        </div>
        <a class="btn btn-primary" href="${sourceUrl(provider, link)}" target="_blank" rel="noopener noreferrer">
          ${icon('ext', 16)} Open source page
        </a>
      </div>`;
  }
}

const PROVIDER_DOMAINS = {
  moviesmod: 'https://moviesmod.fi',
  hdhub4u: 'https://hdhub4u.report',
  topmovies: 'https://topmovies.wtf',
  vega: 'https://vegamovies.tools',
  uhd: 'https://uhdmovies.pics',
  moviesdrive: 'https://moviesdrive.icu',
  lux: 'https://luxmovies.icu',
  gokuhd: 'https://goku.sx',
  movies4u: 'https://movies4u.pics',
  eonmovies: 'https://eonmovies.com',
  kat: 'https://katmoviehd.re',
  castle: 'https://castlemovies.net',
  onexbet: '',
  '4kHdHhub': 'https://4khdhub.ws',
};

function sourceUrl(provider, link) {
  if (/^https?:\/\//i.test(link)) return link;
  const base = PROVIDER_DOMAINS[provider];
  if (!base) return link;
  return base + (link.startsWith('/') ? link : '/' + link);
}

function qualityOrder(q) {
  const idx = ['360p', '480p', '720p', '1080p', '2160p'].indexOf(q);
  return idx === -1 ? -1 : idx;
}

function renderDetail(info, provider, link) {
  const content = $('#detailContent');
  const isSeries = info.type === 'series' || info.type === 'tv' || /episode|season/i.test(info.title);

  const poster = info.poster || info.image;
  const bigBg = info.image || poster;

  const streamable = !state.providers.find((p) => p.id === provider)?.nonStreamable;

  const groups = {};
  info.linkList.forEach((l) => {
    const key = l.quality || 'Other';
    (groups[key] = groups[key] || []).push(l);
  });
  const qKeys = Object.keys(groups).sort((a, b) => qualityOrder(b) - qualityOrder(a));

  const episodeLinks = info.linkList.filter((l) => l.episodesLink);

  content.innerHTML = `
    <div class="detail-hero">
      ${bigBg ? `<img class="detail-hero-bg" alt="" src="${esc(bigBg)}" />` : ''}
      <div class="hero-scrim" style="position:absolute;inset:0"></div>
      <div class="detail-hero-inner">
        <div class="hero-badges">
          <span class="pill brand">${esc(providerName(provider))}</span>
          ${info.rating ? `<span class="pill ok">${icon('star', 11)} ${esc(info.rating)}</span>` : ''}
          ${isSeries ? `<span class="pill">${icon('tv', 11)} Series</span>` : `<span class="pill">${icon('film', 11)} Movie</span>`}
          ${info.imdbId ? `<span class="pill">${esc(info.imdbId)}</span>` : ''}
        </div>
        <h2 class="detail-title" id="detailTitle">${esc(info.title || 'Untitled')}</h2>
        <div class="hero-meta" style="margin-bottom:0">
          <span>${info.linkList.length} server${info.linkList.length === 1 ? '' : 's'}</span>
          ${qKeys.length ? `<span class="dot"></span><span>${esc(qKeys.join(' · '))}</span>` : ''}
          ${info.webUrl ? `<span class="dot"></span><a href="${esc(info.webUrl)}" target="_blank" rel="noopener" style="color:var(--brand-3)">Source</a>` : ''}
        </div>
      </div>
      ${poster ? `<div class="detail-poster"><img alt="" src="${esc(poster)}" /></div>` : ''}
    </div>

    <div class="detail-body">
      ${info.synopsis ? `
        <div class="detail-section">
          <p class="detail-label">Synopsis</p>
          <p class="synopsis">${esc(info.synopsis)}</p>
        </div>` : ''}

      ${info.tags?.length ? `
        <div class="detail-section">
          <p class="detail-label">Tags</p>
          <div class="chips" style="padding-bottom:2px">
            ${info.tags.slice(0, 18).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
          </div>
        </div>` : ''}

      ${episodeLinks.length ? `
        <div class="detail-section">
          <p class="detail-label">Episodes</p>
          <div class="server-list">
            ${episodeLinks.map((l, i) => `
              <button class="server-btn" data-episodes="${esc(l.episodesLink || l.link)}" data-ep-title="${esc(l.title)}">
                <span class="sb-icon">${icon('tv', 14)}</span>
                <span class="sb-text"><span class="sb-name">${esc(l.title)}</span><span class="sb-meta">Load episode list</span></span>
                <span class="sb-arrow">${icon('arrow', 14)}</span>
              </button>`).join('')}
          </div>
          <div id="episodeHost" style="margin-top:14px"></div>
        </div>` : ''}

      <div class="detail-section">
        <p class="detail-label">Stream &amp; Download</p>
        ${info.linkList.length ? qKeys.map((q) => `
          <div class="server-group">
            <div class="server-group-head">
              <span class="q-badge">${esc(q)}</span>
              <span>${groups[q].length} server${groups[q].length === 1 ? '' : 's'}</span>
              ${groups[q][0].size ? `<span class="size">${esc(groups[q][0].size)}</span>` : ''}
            </div>
            <div class="server-list">
              ${groups[q].map((l, i) => `
                <button class="server-btn" data-stream="${esc(l.link)}" data-quality="${esc(q)}" data-type="${isSeries ? 'series' : 'movie'}" data-server="${esc(l.title)}">
                  <span class="sb-icon">${icon('server', 14)}</span>
                  <span class="sb-text">
                    <span class="sb-name">${esc(l.title)}</span>
                    <span class="sb-meta">${l.size ? esc(l.size) : 'Tap to play'}</span>
                  </span>
                  <span class="sb-arrow">${icon('arrow', 14)}</span>
                </button>`).join('')}
            </div>
          </div>`).join('') : `
          <div class="state" style="padding:26px 0">
            <div class="state-icon">${icon('alert', 24, 1.9)}</div>
            <div><h3>No servers extracted</h3><p>This post has no direct links. Open the source page instead.</p></div>
            <a class="btn btn-ghost btn-sm" href="${sourceUrl(provider, link)}" target="_blank" rel="noopener">${icon('ext', 14)} Open source</a>
          </div>`}
      </div>

      <div class="detail-section">
        <p class="detail-label">Quick actions</p>
        <div class="hero-actions">
          ${info.webUrl ? `<a class="btn btn-ghost btn-sm" href="${esc(info.webUrl)}" target="_blank" rel="noopener">${icon('ext', 14)} Source page</a>` : ''}
          <button class="btn btn-ghost btn-sm" id="detailFav">${icon('heart', 14)} ${isFav(link) ? 'Saved' : 'Save to my list'}</button>
          <button class="btn btn-ghost btn-sm" id="copyLink">${icon('dl', 14)} Copy link</button>
        </div>
      </div>
    </div>`;

  const favBtn = $('#detailFav');
  favBtn?.addEventListener('click', () => {
    if (isFav(link)) { toast('Already saved', 'info', 1500); return; }
    state.favorites.unshift(favouriteData(parsePost({ title: info.title, link, image: poster, provider })));
    saveFavs();
    favBtn.innerHTML = `${icon('heart', 14)} Saved`;
    toast('Saved to your list', 'ok', 1600);
  });

  $('#copyLink')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(sourceUrl(provider, link));
      toast('Link copied', 'ok', 1600);
    } catch {
      toast('Copy failed', 'err', 1600);
    }
  });

  // episode loading
  $$('[data-episodes]').forEach((btn) => {
    btn.addEventListener('click', () => loadEpisodes(provider, btn.dataset.episodes, btn.dataset.epTitle));
  });

  // stream buttons
  $$('[data-stream]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!streamable) {
        toast('This provider has non-streamable servers — use download', 'info', 2600);
      }
      playStream(provider, btn.dataset.stream, btn.dataset.type, btn.dataset.quality, info.title);
    });
  });
}

async function loadEpisodes(provider, url, title) {
  const host = $('#episodeHost');
  host.innerHTML = `<div class="state" style="padding:20px"><div class="spinner"></div><p>Loading episodes…</p></div>`;
  try {
    const eps = await getEpisodes(provider, url);
    if (!eps.length) {
      host.innerHTML = '';
      toast('No episodes returned', 'info', 2000);
      return;
    }
    const seasons = {};
    eps.forEach((e) => {
      const s = (String(e.title || '').match(/S(\d{1,2})/i)?.[1]) || '1';
      (seasons[s] = seasons[s] || []).push(e);
    });
    host.innerHTML = Object.keys(seasons).sort().map((s) => `
      <button class="season-head" data-season="${s}">
        <span class="sh-left">Season ${esc(s)} <span class="sh-count">${seasons[s].length} eps</span></span>
        <span>${icon('arrow', 15)}</span>
      </button>
      <div class="episode-list" data-season-body="${s}" style="display:none">
        ${seasons[s].map((e, i) => `
          <button class="episode-item" data-stream="${esc(e.link)}" data-quality="auto" data-type="episode" data-server="${esc(e.title)}">
            <span class="ep-num">${esc(String(e.title || '').match(/E(\d{1,3})/i)?.[1] || i + 1)}</span>
            <span class="ep-title">${esc(e.title || `Episode ${i + 1}`)}</span>
            <span class="ep-play">${icon('play', 14)}</span>
          </button>`).join('')}
      </div>`).join('');

    $$('.season-head', host).forEach((h) => {
      h.addEventListener('click', () => {
        const body = $(`[data-season-body="${h.dataset.season}"]`, host);
        const open = body.style.display === 'none';
        body.style.display = open ? 'grid' : 'none';
        h.classList.toggle('open', open);
      });
    });
    $$('[data-stream]', host).forEach((b) => {
      b.addEventListener('click', () => playStream(provider, b.dataset.stream, 'episode', 'auto', b.dataset.server));
    });
    $('.season-head', host)?.click();
  } catch (err) {
    host.innerHTML = '';
    toast(`Episodes: ${err.message}`, 'err');
  }
}

/* ------------------------------ player ------------------------------ */

let hlsInstance = null;

function stopPlayer() {
  const stage = $('#playerStage');
  const video = $('video', stage);
  if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch {} }
  if (hlsInstance) { try { hlsInstance.destroy(); } catch {} hlsInstance = null; }
  stage.innerHTML = '';
}

async function playStream(provider, link, type, quality, title) {
  openModal('playerModal');
  $('#playerTitle').textContent = title || 'Now playing';
  $('#playerQuality').textContent = quality || 'HD';
  $('#playerSources').innerHTML = '';

  const stage = $('#playerStage');
  stage.innerHTML = `
    <div class="player-loading">
      <div class="spinner"></div>
      <p class="pl-text">Extracting stream from ${esc(providerName(provider))}…</p>
    </div>`;

  const t0 = performance.now();
  try {
    const streams = await getStream(provider, link, type);
    const ms = Math.round(performance.now() - t0);
    state.streamCount++;
    $('#statStreams').textContent = state.streamCount;

    if (!streams.length) throw new Error('No playable sources returned');

    const playable = streams.filter((s) => s.link);
    const first = pickBest(playable);
    mountPlayer(first, title);
    renderSources(playable, title);
    toast(`Stream ready in ${ms}ms`, 'ok', 2000);
  } catch (err) {
    stage.innerHTML = '';
    const box = el('div', 'player-err');
    box.innerHTML = `
      <h4>Could not extract a stream</h4>
      <p>${esc(err.message)}. The source may require a browser session, or the file is download-only.</p>`;
    const a = el('a', 'btn btn-primary btn-sm', `${icon('ext', 14)} Open in new tab`);
    a.href = sourceUrl(provider, link);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    box.appendChild(a);
    stage.appendChild(box);
    toast(`Stream failed: ${err.message}`, 'err', 4000);
  }
}

function pickBest(streams) {
  return [...streams].sort((a, b) => qualityOrder(extractQuality(b.quality || b.link)) - qualityOrder(extractQuality(a.quality || a.link)))[0];
}

function renderSources(streams, title) {
  const host = $('#playerSources');
  host.innerHTML = '';
  streams.slice(0, 12).forEach((s, i) => {
    const q = extractQuality(s.quality || s.link) || s.quality || 'auto';
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''));
    b.type = 'button';
    b.innerHTML = `${esc(s.server || `Server ${i + 1}`)} <span class="count">${esc(q)}</span>`;
    b.addEventListener('click', () => {
      $$('button', host).forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      mountPlayer(s, title);
    });
    host.appendChild(b);
  });
}

function mountPlayer(stream, title) {
  const stage = $('#playerStage');
  stopPlayer();

  const url = stream.link;
  const kind = (stream.type || '').toLowerCase();
  const isHls = kind.includes('hls') || /\.m3u8(\?|$)/i.test(url);
  const isMp4 = kind.includes('mp4') || /\.(mp4|webm|mkv)(\?|$)/i.test(url);
  const isDash = kind.includes('dash') || /\.mpd(\?|$)/i.test(url);

  $('#playerQuality').textContent = extractQuality(stream.quality || url) || stream.quality || 'HD';
  $('#playerTitle').textContent = `${title} — ${stream.server || 'Server'}`;

  if (isHls || isDash || isMp4) {
    const video = el('video');
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.setAttribute('controlslist', 'nodownload');
    stage.appendChild(video);

    if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else if ((isHls || isDash) && window.Hls && window.Hls.isSupported()) {
      hlsInstance = new window.Hls({ enableWorker: true, lowLatencyMode: false });
      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(video);
      hlsInstance.on(window.Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          stopPlayer();
          showPlayerError(url, stream, title);
        }
      });
    } else {
      video.src = url;
    }
    video.play().catch(() => {});
    return;
  }

  // generic embed / direct file of unknown type
  if (/^https?:\/\//i.test(url) && !isMp4 && !isHls) {
    const iframe = el('iframe');
    iframe.src = url;
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    iframe.setAttribute('allowfullscreen', '');
    iframe.referrerPolicy = 'no-referrer';
    stage.appendChild(iframe);
    return;
  }
  videoFallback(url);
}

function videoFallback(url) {
  const stage = $('#playerStage');
  stage.innerHTML = '';
  const video = el('video');
  video.controls = true;
  video.autoplay = true;
  video.src = url;
  stage.appendChild(video);
}

function showPlayerError(url, stream, title) {
  const stage = $('#playerStage');
  stage.innerHTML = '';
  const box = el('div', 'player-err');
  box.innerHTML = `<h4>Playback blocked</h4><p>The server refused the stream in an embedded player. Open it directly instead.</p>`;
  const a = el('a', 'btn btn-primary btn-sm', `${icon('ext', 14)} Open stream`);
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  box.appendChild(a);
  stage.appendChild(box);
}

/* ------------------------------ favorites ------------------------------ */

$('#favBtn').addEventListener('click', () => {
  const grid = $('#favGrid');
  grid.innerHTML = '';
  $('#favCount').textContent = `${state.favorites.length} saved title${state.favorites.length === 1 ? '' : 's'}`;
  if (!state.favorites.length) {
    grid.appendChild(emptyState('Your list is empty', 'Tap the heart on any poster to keep it here.', 'heart'));
  } else {
    state.favorites.forEach((f, i) => grid.appendChild(posterCard({ ...f, title: f.title, provider: f.provider }, i)));
  }
  openModal('favModal');
});

/* ------------------------------ boot ------------------------------ */

(async function boot() {
  try {
    await loadHome();
  } catch (err) {
    toast(`Startup error: ${err.message}`, 'err', 6000);
  }

  // warm the browse view's provider default
  if (state.providers.length) {
    const preferred = state.providers.find((p) => p.id === 'moviesmod') || state.providers[0];
    state.provider = preferred.id;
  }

  // prefetch browse catalog in idle time for instant navigation
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  idle(() => { getCatalog(state.provider).then((c) => { state.catalog = c; renderCategories(); }).catch(() => {}); });

  // count "servers" stat once we have data
  $('#statStreams').textContent = '0';
})();

/* expose for debugging in the console */
window.CF = { state, API_BASE, parsePost };

/* ==================================================================
   MovieLinkBD — first-party UI script.
   No ad loaders, no popunders, no click hijacking, no remote calls
   except our own /api endpoints.
   ================================================================== */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* -------------------------------------------------- poster fallbacks */
  // Posters are loaded natively (loading="lazy"). This only recovers broken
  // image URLs and adds a fade-in class, so the grid works without JS too.
  function initImages() {
    $$('img[data-fallback]').forEach(function (img) {
      var fallback = img.getAttribute('data-fallback');
      if (!fallback) return;
      img.addEventListener('error', function () {
        if (img.src !== fallback) img.src = fallback;
      });
      if (img.complete) img.classList.add('is-loaded');
      else img.addEventListener('load', function () { img.classList.add('is-loaded'); }, { once: true });
    });
  }

  /* ------------------------------------------------------- mobile menu */
  function initDrawer() {
    var drawer = $('#drawer');
    var backdrop = $('#drawerBackdrop');
    var toggles = $$('[data-drawer-toggle]');
    if (!drawer) return;

    function setOpen(open) {
      drawer.classList.toggle('is-open', open);
      if (backdrop) backdrop.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      toggles.forEach(function (btn) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    }

    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setOpen(!drawer.classList.contains('is-open'));
      });
    });
    if (backdrop) backdrop.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  /* --------------------------------------------------- notice carousel */
  function initNotices() {
    var board = $('[data-notice-board]');
    if (!board) return;
    var slides = $$('.notice-item', board);
    var dots = $$('.notice-dots button', board);
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;

    function show(next) {
      slides[index].classList.remove('is-active');
      if (dots[index]) dots[index].classList.remove('is-active');
      index = (next + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      if (dots[index]) dots[index].classList.add('is-active');
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      var text = slides[index].textContent || '';
      var dwell = Math.min(16000, Math.max(6000, 2600 + text.length * 80));
      timer = setTimeout(function () { show(index + 1); }, dwell);
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { show(i); });
    });

    board.addEventListener('mouseenter', function () { clearTimeout(timer); });
    board.addEventListener('mouseleave', schedule);
    schedule();
  }

  /* --------------------------------------------- search suggestions */
  function initSearch() {
    var input = $('#searchInput');
    var box = $('#searchSuggest');
    if (!input || !box) return;

    var controller = null;
    var cache = new Map();
    var activeIndex = -1;

    function close() {
      box.classList.remove('is-open');
      box.innerHTML = '';
      activeIndex = -1;
    }

    function render(items) {
      if (!items.length) { close(); return; }
      box.innerHTML = items.map(function (item, i) {
        return '<a class="suggest-item" href="' + item.url + '" data-index="' + i + '">'
          + '<img src="' + (item.poster || '') + '" alt="" loading="lazy" width="30" height="44">'
          + '<span class="suggest-text"><b>' + escapeHtml(item.title) + '</b>'
          + '<small>' + escapeHtml((item.year || '') + ' • ' + (item.quality || item.type)) + '</small></span>'
          + '<em>' + item.views_human + '</em>'
          + '</a>';
      }).join('');
      box.classList.add('is-open');
    }

    function escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }

    function lookup(query) {
      if (cache.has(query)) { render(cache.get(query)); return; }
      if (controller) controller.abort();
      controller = new AbortController();
      box.innerHTML = '<div class="suggest-loading">Searching…</div>';
      box.classList.add('is-open');

      fetch('/api/suggest.json?q=' + encodeURIComponent(query), {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          var items = (json && json.data) || [];
          cache.set(query, items);
          render(items);
        })
        .catch(function () { close(); });
    }

    var debounce = null;
    input.addEventListener('input', function () {
      var value = input.value.trim();
      clearTimeout(debounce);
      if (value.length < 2) { close(); return; }
      debounce = setTimeout(function () { lookup(value); }, 180);
    });

    input.addEventListener('keydown', function (event) {
      var items = $$('.suggest-item', box);
      if (!items.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
      } else if (event.key === 'Escape') {
        close();
        return;
      } else {
        return;
      }
      items.forEach(function (el, i) { el.classList.toggle('is-active', i === activeIndex); });
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    });

    document.addEventListener('click', function (event) {
      if (!box.contains(event.target) && event.target !== input) close();
    });
  }

  /* ------------------------------------------- recently viewed (local) */
  var RECENT_KEY = 'mlbd_recent_v1';

  function rememberTitle() {
    var node = $('[data-title-slug]');
    if (!node) return;
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      var entry = {
        slug: node.getAttribute('data-title-slug'),
        title: node.getAttribute('data-title-name'),
        poster: node.getAttribute('data-title-poster'),
        url: node.getAttribute('data-title-url'),
        type: node.getAttribute('data-title-type')
      };
      list = list.filter(function (item) { return item.slug !== entry.slug; });
      list.unshift(entry);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)));
    } catch (err) { /* storage disabled */ }
  }

  /* ----------------------------------------- 18+ gate (single cookie) */
  function initAgeGate() {
    var gate = $('#ageGate');
    if (!gate) return;
    var accept = $('#ageGateAccept');
    var leave = $('#ageGateLeave');
    if (accept) {
      accept.addEventListener('click', function () {
        document.cookie = 'mlbd_adult=1;path=/;max-age=2592000;samesite=lax';
        gate.remove();
      });
    }
    if (leave) leave.addEventListener('click', function () { window.location.href = '/'; });
  }

  /* ---------------------------------------------------- sort select */
  function initFilters() {
    $$('[data-auto-submit]').forEach(function (el) {
      el.addEventListener('change', function () {
        var form = el.closest('form');
        if (form) form.submit();
      });
    });
  }

  /* ---------------------------------------------------- copy buttons */
  function initCopy() {
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        var done = function () {
          var original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = original; }, 1400);
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(done).catch(function () {});
        }
      });
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    initImages();
    initDrawer();
    initNotices();
    initSearch();
    initAgeGate();
    initFilters();
    initCopy();
    rememberTitle();
  });
})();

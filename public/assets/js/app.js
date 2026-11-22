/* ==================================================================
   MovieLinkBD — first-party UI script.
   No ad loaders, no popunders, no click hijacking.
   ================================================================== */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* -------------------------------------------------- poster fallbacks */
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

  /* --------------------------------------------------- hero carousel */
  function initHero() {
    var root = $('[data-hero]');
    if (!root) return;
    var slides = $$('.hero-slide', root);
    var dots = $$('.hero-dots button', root);
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
      timer = setTimeout(function () { show(index + 1); }, 6500);
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { show(i); });
    });
    root.addEventListener('mouseenter', function () { clearTimeout(timer); });
    root.addEventListener('mouseleave', schedule);
    schedule();
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
    var lastQuery = '';

    function close() {
      box.classList.remove('is-open');
      box.innerHTML = '';
      activeIndex = -1;
    }

    function formatViewsFallback(views) {
      var n = Number(views || 0);
      if (!n) return '';
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    }

    function render(items, query) {
      activeIndex = -1;
      var searchUrl = '/search?q=' + encodeURIComponent(query);
      if (!items.length) {
        box.innerHTML = '<div class="suggest-empty">No quick matches for “' + escapeHtml(query) + '”</div>'
          + '<a class="suggest-more" href="' + searchUrl + '">Search full catalog for “' + escapeHtml(query) + '” →</a>';
        box.classList.add('is-open');
        return;
      }
      box.innerHTML = items.map(function (item, i) {
        var viewsLabel = item.views_human || formatViewsFallback(item.views);
        var metaParts = [];
        if (item.year) metaParts.push(item.year);
        if (item.quality || item.type) metaParts.push(item.quality || item.type);
        return '<a class="suggest-item" href="' + escapeHtml(item.url) + '" data-index="' + i + '">'
          + '<img src="' + escapeHtml(item.poster || '/assets/img/poster-placeholder.svg') + '" alt="" loading="lazy" width="30" height="44" onerror="this.onerror=null;this.src=\'/assets/img/poster-placeholder.svg\'">'
          + '<span class="suggest-text"><b>' + escapeHtml(item.title) + '</b>'
          + '<small>' + escapeHtml(metaParts.join(' • ')) + '</small></span>'
          + '<em>' + escapeHtml(viewsLabel) + '</em>'
          + '</a>';
      }).join('') + '<a class="suggest-more" href="' + searchUrl + '">View all results for “' + escapeHtml(query) + '” →</a>';
      box.classList.add('is-open');
    }

    function lookup(query) {
      lastQuery = query;
      if (cache.has(query)) { render(cache.get(query), query); return; }
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
          if (lastQuery === query) render(items, query);
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          close();
        });
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
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (!items.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
      } else if (event.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        window.location.href = items[activeIndex].getAttribute('href');
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

  /* ------------------------------------------- online stream player */
  function initPlayer() {
    var root = $('#mlbdPlayer');
    if (!root) return;

    var video = $('#mlbdVideo', root);
    var frame = $('#mlbdFrame', root);
    var qualityBar = $('#playerQualities', root);
    var serverBtns = $$('[data-server-idx]', root);
    var nowPlaying = $('#nowPlayingLabel');
    var playerDlBtn = $('#playerDownloadBtn');
    var prevEpBtn = $('#prevEpBtn');
    var nextEpBtn = $('#nextEpBtn');
    var epChips = $$('[data-ep-index]');

    var titleBase = root.getAttribute('data-title-base') || '';
    var slug = root.getAttribute('data-slug') || 'title';
    var servers = [];
    try {
      servers = JSON.parse(root.getAttribute('data-servers') || '[]');
    } catch (e) {
      servers = [];
    }
    if (!servers.length) return;

    var currentServerIdx = 0;
    var currentQuality = '720p';
    var currentEpIdx = 0;
    epChips.forEach(function (chip, idx) {
      if (chip.classList.contains('is-active')) currentEpIdx = idx;
    });

    function progressKey() {
      return 'mlbd_pos_' + slug + '_' + currentEpIdx;
    }

    function renderQualities(server) {
      if (!qualityBar) return;
      var qualities = (server && server.qualities) || {};
      var keys = Object.keys(qualities);
      if (!keys.length || server.kind !== 'video') {
        qualityBar.innerHTML = '';
        return;
      }
      if (!qualities[currentQuality]) {
        currentQuality = keys.indexOf('720p') >= 0 ? '720p' : keys[0];
      }
      qualityBar.innerHTML = keys.map(function (q) {
        var active = q === currentQuality ? ' is-active' : '';
        return '<button type="button" class="chip' + active + '" data-quality="' + escapeHtml(q) + '" data-quality-src="' + escapeHtml(qualities[q]) + '">' + escapeHtml(q) + '</button>';
      }).join('');
    }

    function loadMedia(server, autoplay) {
      if (!server) return;
      if (server.kind === 'iframe') {
        if (video) {
          video.pause();
          video.classList.add('hidden');
        }
        if (frame) {
          frame.classList.remove('hidden');
          if (frame.src !== server.url) frame.src = server.url;
        }
        renderQualities(server);
        return;
      }

      if (frame) {
        frame.src = 'about:blank';
        frame.classList.add('hidden');
      }
      renderQualities(server);
      var targetUrl = (server.qualities && server.qualities[currentQuality]) || server.url;
      if (video && targetUrl) {
        var resumeTime = 0;
        try {
          resumeTime = parseFloat(localStorage.getItem(progressKey()) || '0') || 0;
        } catch (e) {}
        video.classList.remove('hidden');
        if (video.getAttribute('src') !== targetUrl) {
          video.setAttribute('src', targetUrl);
          video.load();
        }
        if (resumeTime > 3) {
          video.addEventListener('loadedmetadata', function () {
            if (video.duration && resumeTime < video.duration - 5) {
              video.currentTime = resumeTime;
            }
          }, { once: true });
        }
        if (autoplay) {
          var p = video.play();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        }
      }
    }

    serverBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-server-idx') || '0', 10);
        if (!servers[idx]) return;
        currentServerIdx = idx;
        serverBtns.forEach(function (b, i) {
          b.classList.toggle('is-active', i === idx);
          b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
        });
        loadMedia(servers[idx], true);
      });
    });

    if (qualityBar) {
      qualityBar.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-quality]');
        if (!btn) return;
        currentQuality = btn.getAttribute('data-quality') || '720p';
        var src = btn.getAttribute('data-quality-src') || '';
        $$('[data-quality]', qualityBar).forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        if (video && src) {
          var curTime = video.currentTime || 0;
          var wasPaused = video.paused;
          video.setAttribute('src', src);
          video.load();
          video.addEventListener('loadedmetadata', function () {
            if (curTime > 0 && (!video.duration || curTime < video.duration)) {
              video.currentTime = curTime;
            }
            if (!wasPaused) {
              var p = video.play();
              if (p && typeof p.catch === 'function') p.catch(function () {});
            }
          }, { once: true });
        }
      });
    }

    function selectEpisode(idx, autoplay) {
      if (idx < 0 || idx >= epChips.length) return;
      currentEpIdx = idx;
      var chip = epChips[idx];
      epChips.forEach(function (c, i) { c.classList.toggle('is-active', i === idx); });

      var code = chip.getAttribute('data-ep-code') || '';
      var epName = chip.getAttribute('data-ep-name') || '';
      var fastUrl = chip.getAttribute('data-stream-fast') || '';
      var hdUrl = chip.getAttribute('data-stream-hd') || fastUrl;
      var cinemaUrl = chip.getAttribute('data-stream-cinema') || '';
      var dlHref = chip.getAttribute('data-dl-href') || '';
      var dlName = chip.getAttribute('data-dl-name') || '';

      servers.forEach(function (srv) {
        if (srv.id === 'server-fast' && fastUrl) {
          srv.url = fastUrl;
          srv.qualities = { '480p': fastUrl, '720p': fastUrl, '1080p': hdUrl };
        } else if (srv.id === 'server-cinema' && cinemaUrl) {
          srv.url = cinemaUrl;
          srv.qualities = { '720p': cinemaUrl, '1080p': cinemaUrl };
        }
      });

      if (nowPlaying) {
        nowPlaying.textContent = 'Now playing: ' + titleBase + (code ? ' · ' + code : '') + (epName ? ' (' + epName + ')' : '');
      }
      if (playerDlBtn && dlHref) {
        playerDlBtn.setAttribute('href', dlHref);
        if (dlName) {
          playerDlBtn.setAttribute('download', dlName);
          playerDlBtn.setAttribute('data-download-name', dlName);
        }
        if (fastUrl) {
          playerDlBtn.setAttribute('data-download-direct', fastUrl);
        }
      }
      if (prevEpBtn) prevEpBtn.disabled = idx <= 0;
      if (nextEpBtn) nextEpBtn.disabled = idx >= epChips.length - 1;

      if (window.history && window.history.replaceState && code) {
        var u = new URL(window.location.href);
        u.searchParams.set('ep', code);
        window.history.replaceState(null, '', u.pathname + u.search + '#watch');
      }

      loadMedia(servers[currentServerIdx] || servers[0], autoplay);
    }

    epChips.forEach(function (chip, idx) {
      chip.addEventListener('click', function (event) {
        event.preventDefault();
        selectEpisode(idx, true);
        var watchSec = $('#watch');
        if (watchSec) watchSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    if (prevEpBtn) {
      prevEpBtn.addEventListener('click', function () { selectEpisode(currentEpIdx - 1, true); });
    }
    if (nextEpBtn) {
      nextEpBtn.addEventListener('click', function () { selectEpisode(currentEpIdx + 1, true); });
    }

    $$('[data-play-src]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = btn.getAttribute('data-play-src') || '';
        var label = btn.getAttribute('data-play-label') || '';
        if (!src || !video) return;
        if (frame) {
          frame.src = 'about:blank';
          frame.classList.add('hidden');
        }
        video.classList.remove('hidden');
        video.setAttribute('src', src);
        video.load();
        var p = video.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
        if (nowPlaying && label) {
          nowPlaying.textContent = 'Now playing: ' + titleBase + ' (' + label + ')';
        }
        var watchSec = $('#watch');
        if (watchSec) watchSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    $$('[data-watch-now]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        var watchSec = $('#watch');
        if (!watchSec) return;
        event.preventDefault();
        watchSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (video && !video.classList.contains('hidden')) {
          var p = video.play();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        }
      });
    });

    if (video) {
      var lastSaved = 0;
      video.addEventListener('timeupdate', function () {
        var now = Date.now();
        if (now - lastSaved < 4000) return;
        lastSaved = now;
        try {
          if (video.currentTime > 3) {
            localStorage.setItem(progressKey(), String(Math.floor(video.currentTime)));
          }
        } catch (e) {}
      });
    }
  }

  /* --------------------------------------- one-click direct downloads */
  function initDirectDownloads() {
    document.addEventListener('click', function (event) {
      var btn = event.target.closest('a[data-download-direct]');
      if (!btn) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      var directUrl = btn.getAttribute('data-download-direct') || '';
      var fileName = btn.getAttribute('data-download-name') || 'MovieLinkBD-video.mp4';
      var fallbackHref = btn.getAttribute('href') || directUrl;
      if (!directUrl || btn.getAttribute('data-busy') === '1') return;

      event.preventDefault();
      btn.setAttribute('data-busy', '1');
      var originalLabel = btn.textContent;
      btn.textContent = 'Starting…';

      fetch(directUrl, { mode: 'cors', credentials: 'omit' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var total = parseInt(res.headers.get('content-length') || '0', 10);
          if (!res.body || !res.body.getReader || !total) {
            btn.textContent = 'Downloading…';
            return res.blob();
          }
          var reader = res.body.getReader();
          var chunks = [];
          var received = 0;
          function pump() {
            return reader.read().then(function (part) {
              if (part.done) {
                return new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' });
              }
              chunks.push(part.value);
              received += part.value.byteLength;
              var pct = Math.min(99, Math.round((received / total) * 100));
              btn.textContent = 'Downloading ' + pct + '%…';
              return pump();
            });
          }
          return pump();
        })
        .then(function (blob) {
          var blobUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 30000);
          btn.textContent = '✓ Downloaded';
          setTimeout(function () {
            btn.textContent = originalLabel;
            btn.removeAttribute('data-busy');
          }, 2400);
        })
        .catch(function () {
          btn.textContent = originalLabel;
          btn.removeAttribute('data-busy');
          window.location.href = fallbackHref;
        });
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
    initHero();
    initNotices();
    initSearch();
    initPlayer();
    initDirectDownloads();
    rememberTitle();
    initAgeGate();
    initFilters();
    initCopy();
  });
})();

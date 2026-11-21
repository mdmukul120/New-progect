/* NovaCut — timeline UI: ruler, playhead, clip blocks, trim handles, drag reorder, zoom */
(function () {
  const NC = (window.NC = window.NC || {});
  const t = (k, p) => NC.i18n.t(k, p);

  let rootEl = null;
  let scrollEl = null;
  let tracksEl = null;
  let rulerEl = null;
  let playheadEl = null;
  let zoom = 42; // px per second
  let dragState = null;

  function pxPerSec() {
    return zoom;
  }

  function fmtTime(sec) {
    sec = Math.max(0, sec || 0);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  /* ---------- build ---------- */
  function init(el) {
    rootEl = el;
    rootEl.innerHTML = '';
    rootEl.classList.add('timeline-root');

    const zoomRow = document.createElement('div');
    zoomRow.className = 'tl-zoom-row';
    zoomRow.innerHTML =
      '<span class="tl-label">' +
      t('timeline.label') +
      '</span>' +
      '<span class="tl-zoom-ico">−</span>' +
      '<input type="range" class="tl-zoom" min="16" max="140" value="' + zoom + '">' +
      '<span class="tl-zoom-ico">+</span>' +
      '<span class="tl-time-badge"><b class="tl-cur">0:00</b> / <span class="tl-dur">0:00</span></span>';
    rootEl.appendChild(zoomRow);

    scrollEl = document.createElement('div');
    scrollEl.className = 'tl-scroll';
    rootEl.appendChild(scrollEl);

    rulerEl = document.createElement('div');
    rulerEl.className = 'tl-ruler';
    scrollEl.appendChild(rulerEl);

    tracksEl = document.createElement('div');
    tracksEl.className = 'tl-tracks';
    scrollEl.appendChild(tracksEl);

    playheadEl = document.createElement('div');
    playheadEl.className = 'tl-playhead';
    scrollEl.appendChild(playheadEl);

    const zoomInput = zoomRow.querySelector('.tl-zoom');
    zoomInput.addEventListener('input', () => {
      zoom = parseInt(zoomInput.value, 10) || 42;
      refresh();
    });

    /* scrubbing on ruler */
    rulerEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      rulerEl.setPointerCapture(e.pointerId);
      dragState = { type: 'scrub' };
      scrubTo(e);
    });
    rulerEl.addEventListener('pointermove', (e) => {
      if (dragState && dragState.type === 'scrub') scrubTo(e);
    });
    rulerEl.addEventListener('pointerup', () => {
      dragState = null;
    });
    rulerEl.addEventListener('pointercancel', () => {
      dragState = null;
    });

    NC.store.on('change', refresh);
    NC.store.on('time', updateTime);
    NC.store.on('selection', refresh);
    NC.store.on('langchange', () => {
      const lbl = zoomRow.querySelector('.tl-label');
      if (lbl) lbl.textContent = t('timeline.label');
      refresh();
    });

    refresh();
  }

  function scrubTo(e) {
    const rect = scrollEl.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollEl.scrollLeft;
    NC.engine.seek(x / pxPerSec());
  }

  /* ---------- refresh ---------- */
  function refresh() {
    if (!tracksEl) return;
    const project = NC.store.state.project;
    const total = Math.max(NC.store.totalDuration(), 8);
    const width = total * pxPerSec() + 240;

    /* ruler */
    rulerEl.style.width = width + 'px';
    rulerEl.innerHTML = '';
    const stepChoices = [0.5, 1, 2, 5, 10, 30, 60];
    let step = stepChoices.find((s) => s * pxPerSec() >= 56) || 60;
    for (let s = 0; s <= total; s += step) {
      const tick = document.createElement('div');
      tick.className = 'tl-tick';
      tick.style.left = s * pxPerSec() + 'px';
      tick.innerHTML = '<i></i><em>' + fmtTime(s) + '</em>';
      rulerEl.appendChild(tick);
    }

    /* tracks */
    tracksEl.style.width = width + 'px';
    tracksEl.innerHTML = '';

    /* video track */
    const vTrack = makeTrack(t('timeline.videoTrack'), 'video');
    let acc = 0;
    project.clips.forEach((clip, idx) => {
      const d = NC.store.clipDuration(clip);
      const block = makeClipBlock(clip, idx, acc, d);
      vTrack.body.appendChild(block);
      acc += d;
    });
    if (!project.clips.length) {
      const empty = document.createElement('div');
      empty.className = 'tl-empty';
      empty.textContent = t('empty.timeline');
      vTrack.body.appendChild(empty);
    }
    tracksEl.appendChild(vTrack.row);

    /* overlay track (text + stickers) */
    const oTrack = makeTrack(t('timeline.textTrack'), 'text');
    project.texts.forEach((item) => {
      oTrack.body.appendChild(makeOverlayBar(item, 'text'));
    });
    project.stickers.forEach((item) => {
      oTrack.body.appendChild(makeOverlayBar(item, 'sticker'));
    });
    tracksEl.appendChild(oTrack.row);

    /* audio track */
    const aTrack = makeTrack(t('timeline.audioTrack'), 'audio');
    project.audios.forEach((item) => {
      aTrack.body.appendChild(makeAudioBar(item));
    });
    tracksEl.appendChild(aTrack.row);

    updateTime();
    updatePlayhead();
  }

  function makeTrack(label, kind) {
    const row = document.createElement('div');
    row.className = 'tl-track tl-track-' + kind;
    const head = document.createElement('div');
    head.className = 'tl-track-head';
    head.textContent = label;
    const body = document.createElement('div');
    body.className = 'tl-track-body';
    row.appendChild(head);
    row.appendChild(body);
    return { row, body };
  }

  /* ---------- clip block ---------- */
  function makeClipBlock(clip, idx, start, dur) {
    const block = document.createElement('div');
    block.className = 'tl-clip';
    block.dataset.id = clip.id;
    if (NC.store.state.selection.id === clip.id) block.classList.add('selected');
    block.style.left = start * pxPerSec() + 'px';
    block.style.width = Math.max(24, dur * pxPerSec()) + 'px';

    const media = NC.store.getMedia(clip.mediaId);
    if (media && media.thumb) {
      block.style.backgroundImage = 'url(' + media.thumb + ')';
    }
    block.innerHTML =
      '<div class="tl-clip-name">' +
      (media ? escapeHtml(shorten(media.name, 18)) : '?') +
      (clip.speed !== 1 ? ' · ' + clip.speed + 'x' : '') +
      '</div>' +
      '<div class="tl-clip-trans">' +
      (clip.transition && clip.transition.type !== 'none' ? transitionGlyph(clip.transition.type) : '') +
      '</div>' +
      '<div class="tl-handle tl-handle-l"></div>' +
      '<div class="tl-handle tl-handle-r"></div>';

    /* selection */
    block.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('tl-handle')) return;
      const startX = e.clientX;
      let moved = false;
      const move = (ev) => {
        if (Math.abs(ev.clientX - startX) > 6) moved = true;
        if (moved) {
          const dx = ev.clientX - startX;
          block.style.transform = 'translateX(' + dx + 'px) translateY(-4px)';
          block.classList.add('dragging');
        }
      };
      const up = (ev) => {
        block.removeEventListener('pointermove', move);
        block.removeEventListener('pointerup', up);
        block.style.transform = '';
        block.classList.remove('dragging');
        if (moved) {
          const dx = ev.clientX - startX;
          const shift = Math.round(dx / (pxPerSec() * 0.7));
          if (shift !== 0) NC.store.moveClip(clip.id, idx + (shift > 0 ? 1 : -1));
        } else {
          NC.store.select('clip', clip.id);
          if (NC.tools && NC.tools.openTool) NC.tools.openTool('edit');
        }
      };
      block.addEventListener('pointermove', move);
      block.addEventListener('pointerup', up);
    });

    /* trim handles */
    bindTrimHandle(block.querySelector('.tl-handle-l'), clip, 'start');
    bindTrimHandle(block.querySelector('.tl-handle-r'), clip, 'end');
    return block;
  }

  function bindTrimHandle(handle, clip, side) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const orig = { start: clip.trimStart, end: clip.trimEnd };
      const media = NC.store.getMedia(clip.mediaId);
      const maxMedia = media && media.kind === 'video' ? media.duration : clip.trimEnd;

      const move = (ev) => {
        const dt = (ev.clientX - startX) / pxPerSec() * (clip.speed || 1);
        if (side === 'start') {
          let ns = orig.start + dt;
          ns = Math.max(0, Math.min(orig.end - 0.2, ns));
          clip.trimStart = ns;
        } else {
          let ne = orig.end + dt;
          ne = Math.min(maxMedia || orig.end, Math.max(orig.start + 0.2, ne));
          clip.trimEnd = ne;
        }
        NC.store.emit('change');
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        NC.store.snapshot();
        NC.store.saveSoon();
        NC.store.emit('change');
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  /* ---------- overlay bars ---------- */
  function makeOverlayBar(item, kind) {
    const bar = document.createElement('div');
    bar.className = 'tl-bar tl-bar-' + kind;
    if (NC.store.state.selection.id === item.id) bar.classList.add('selected');
    const left = (item.start || 0) * pxPerSec();
    const width = Math.max(30, ((item.end || 0) - (item.start || 0)) * pxPerSec());
    bar.style.left = left + 'px';
    bar.style.width = width + 'px';
    bar.textContent = kind === 'text' ? 'T ' + shorten(String(item.content || ''), 14) : item.emoji;
    bar.title = kind === 'text' ? item.content : '';

    bar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const origStart = item.start;
      const origEnd = item.end;
      let moved = false;
      const move = (ev) => {
        const dx = ev.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        const dt = dx / pxPerSec();
        const dur = origEnd - origStart;
        const ns = Math.max(0, origStart + dt);
        item.start = ns;
        item.end = ns + dur;
        NC.store.emit('change');
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        if (moved) {
          NC.store.snapshot();
          NC.store.saveSoon();
        }
        NC.store.select(kind, item.id);
        if (NC.tools && NC.tools.openTool) NC.tools.openTool(kind === 'text' ? 'text' : 'stickers');
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
    return bar;
  }

  /* ---------- audio bars ---------- */
  function makeAudioBar(item) {
    const bar = document.createElement('div');
    bar.className = 'tl-bar tl-bar-audio';
    if (NC.store.state.selection.id === item.id) bar.classList.add('selected');
    bar.style.left = (item.start || 0) * pxPerSec() + 'px';
    bar.style.width = Math.max(30, ((item.end || 0) - (item.start || 0)) * pxPerSec()) + 'px';

    const media = NC.store.getMedia(item.mediaId);
    const label = document.createElement('span');
    label.className = 'tl-bar-label';
    label.textContent = '♪ ' + shorten(item.name || 'audio', 16);
    bar.appendChild(label);

    if (media && media.peaks && media.peaks.length) {
      const wave = document.createElement('div');
      wave.className = 'tl-wave';
      const bars = 48;
      for (let i = 0; i < bars; i++) {
        const p = media.peaks[Math.floor((i / bars) * media.peaks.length)] || 0;
        const b = document.createElement('i');
        b.style.height = Math.max(8, p * 100) + '%';
        wave.appendChild(b);
      }
      bar.appendChild(wave);
    }

    bar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const origStart = item.start;
      const origEnd = item.end;
      let moved = false;
      const move = (ev) => {
        const dx = ev.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        const dt = dx / pxPerSec();
        const dur = origEnd - origStart;
        const ns = Math.max(0, origStart + dt);
        item.start = ns;
        item.end = ns + dur;
        NC.store.emit('change');
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        if (moved) {
          NC.store.snapshot();
          NC.store.saveSoon();
        }
        NC.store.select('audio', item.id);
        if (NC.tools && NC.tools.openTool) NC.tools.openTool('audio');
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
    return bar;
  }

  /* ---------- playhead + time ---------- */
  function updatePlayhead() {
    if (!playheadEl) return;
    const x = NC.store.state.time * pxPerSec();
    playheadEl.style.left = x + 'px';
    /* auto-scroll during playback */
    if (NC.engine.isPlaying() && scrollEl) {
      const viewL = scrollEl.scrollLeft;
      const viewR = viewL + scrollEl.clientWidth;
      if (x < viewL + 20 || x > viewR - 60) {
        scrollEl.scrollLeft = Math.max(0, x - scrollEl.clientWidth * 0.3);
      }
    }
  }

  function updateTime() {
    const cur = rootEl && rootEl.querySelector('.tl-cur');
    const dur = rootEl && rootEl.querySelector('.tl-dur');
    if (cur) cur.textContent = fmtTime(NC.store.state.time);
    if (dur) dur.textContent = fmtTime(NC.store.totalDuration());
    updatePlayhead();
  }

  /* ---------- helpers ---------- */
  function shorten(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function transitionGlyph(type) {
    const map = {
      fade: '✕',
      'fade-black': '◐',
      'slide-left': '←',
      'slide-right': '→',
      'slide-up': '↑',
      zoom: '⤢',
      wipe: '▤',
    };
    return map[type] || '';
  }

  NC.timeline = {
    init,
    refresh,
    setZoom(z) {
      zoom = z;
      const input = rootEl && rootEl.querySelector('.tl-zoom');
      if (input) input.value = z;
      refresh();
    },
    getZoom: () => zoom,
    fmtTime,
  };
})();

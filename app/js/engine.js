/* NovaCut — playback engine & canvas compositor
 * Renders video/image clips + filters + transitions + text + stickers onto a canvas.
 * Handles preview playback in sync with the store timeline.
 */
(function () {
  const NC = (window.NC = window.NC || {});

  const ASPECTS = {
    '16:9': { w: 16, h: 9, label: 'aspect.16:9' },
    '9:16': { w: 9, h: 16, label: 'aspect.9:16' },
    '1:1': { w: 1, h: 1, label: 'aspect.1:1' },
    '4:5': { w: 4, h: 5, label: 'aspect.4:5' },
  };

  const FILTERS = {
    none: '',
    vivid: 'saturate(1.5) contrast(1.1)',
    warm: 'sepia(0.25) saturate(1.2) brightness(1.05)',
    cool: 'hue-rotate(-12deg) saturate(1.1) brightness(1.02)',
    cinematic: 'contrast(1.2) saturate(0.9) brightness(0.95)',
    vintage: 'sepia(0.4) contrast(0.95) brightness(1.05) saturate(0.85)',
    bw: 'grayscale(1) contrast(1.05)',
    sepia: 'sepia(0.8)',
    dramatic: 'contrast(1.35) brightness(0.9) saturate(1.1)',
    film: 'contrast(1.08) saturate(0.92) sepia(0.12)',
    pink: 'hue-rotate(-25deg) saturate(1.35) brightness(1.05)',
    mono: 'grayscale(1) contrast(1.25) brightness(1.02)',
  };

  const TRANSITIONS = ['none', 'fade', 'fade-black', 'slide-left', 'slide-right', 'slide-up', 'zoom', 'wipe'];

  /* ---------- elements ---------- */
  let canvas = null;
  let ctx = null;
  let previewW = 540;
  let previewH = 960;

  /* media element pool: clipId -> video/image element */
  const clipEls = new Map();
  /* audio element pool: audioId -> HTMLAudioElement */
  const audioEls = new Map();
  /* web audio graph */
  let ac = null;
  let masterGain = null;
  let exportDest = null;
  const nodeMap = new WeakMap(); // media element -> {src, gain}
  let audioGraphBroken = false;

  /* playback clock */
  let rafId = 0;
  let lastWall = 0;
  let playing = false;

  function ensureAudioGraph() {
    if (audioGraphBroken) return;
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
          audioGraphBroken = true;
          return;
        }
        ac = new AC();
        masterGain = ac.createGain();
        masterGain.gain.value = NC.store ? NC.store.state.project.masterVolume : 1;
        masterGain.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) {
      audioGraphBroken = true;
    }
  }

  function connectMediaElement(el) {
    if (audioGraphBroken || !ac) return;
    if (nodeMap.has(el)) return;
    try {
      const src = ac.createMediaElementSource(el);
      const gain = ac.createGain();
      gain.gain.value = 1;
      src.connect(gain);
      gain.connect(masterGain);
      nodeMap.set(el, { src, gain });
    } catch (e) {
      /* element may already be connected or unsupported — fall back to element.volume */
    }
  }

  function setElementVolume(el, v) {
    const node = nodeMap.get(el);
    if (node && !audioGraphBroken) {
      node.gain.gain.value = v;
      el.volume = 1;
    } else {
      try {
        el.volume = Math.max(0, Math.min(1, v));
      } catch (e) {}
    }
  }

  /* ---------- sizing ---------- */
  function computePreviewSize() {
    const aspect = ASPECTS[NC.store.state.project.aspect] || ASPECTS['9:16'];
    const maxDim = 640;
    const ratio = aspect.w / aspect.h;
    let w, h;
    if (ratio >= 1) {
      w = maxDim;
      h = Math.round(maxDim / ratio);
    } else {
      h = maxDim;
      w = Math.round(maxDim * ratio);
    }
    previewW = w;
    previewH = h;
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  /* ---------- clip media elements ---------- */
  function getClipEl(clip) {
    let el = clipEls.get(clip.id);
    const url = NC.store.getMediaURL(clip.mediaId);
    if (!url) return null;
    if (el && el.dataset.mediaId !== clip.mediaId) {
      try {
        el.pause();
      } catch (e) {}
      el = null;
    }
    if (!el) {
      if (clip.type === 'video') {
        el = document.createElement('video');
        el.preload = 'auto';
        el.playsInline = true;
        el.crossOrigin = 'anonymous';
        el.src = url;
        el.dataset.mediaId = clip.mediaId;
        el.load();
      } else {
        el = new Image();
        el.src = url;
        el.dataset.mediaId = clip.mediaId;
      }
      clipEls.set(clip.id, el);
    }
    return el;
  }

  function getAudioEl(item) {
    let el = audioEls.get(item.id);
    const url = NC.store.getMediaURL(item.mediaId);
    if (!url) return null;
    if (el && el.dataset.mediaId !== item.mediaId) {
      try {
        el.pause();
      } catch (e) {}
      el = null;
    }
    if (!el) {
      el = new Audio();
      el.preload = 'auto';
      el.src = url;
      el.dataset.mediaId = item.mediaId;
      audioEls.set(item.id, el);
    }
    return el;
  }

  function cleanupUnusedEls() {
    const usedClips = new Set(NC.store.state.project.clips.map((c) => c.id));
    for (const [id, el] of clipEls) {
      if (!usedClips.has(id)) {
        try {
          el.pause && el.pause();
        } catch (e) {}
        clipEls.delete(id);
      }
    }
    const usedAudios = new Set(NC.store.state.project.audios.map((a) => a.id));
    for (const [id, el] of audioEls) {
      if (!usedAudios.has(id)) {
        try {
          el.pause();
        } catch (e) {}
        audioEls.delete(id);
      }
    }
  }

  /* ---------- filter strings ---------- */
  function adjustFilterString(adjust) {
    const a = adjust || {};
    const parts = [];
    const b = a.brightness != null ? a.brightness : 1;
    const c = a.contrast != null ? a.contrast : 1;
    const s = a.saturation != null ? a.saturation : 1;
    const h = a.hue || 0;
    if (b !== 1) parts.push('brightness(' + b + ')');
    if (c !== 1) parts.push('contrast(' + c + ')');
    if (s !== 1) parts.push('saturate(' + s + ')');
    if (h) parts.push('hue-rotate(' + h + 'deg)');
    if (a.temperature > 0) parts.push('sepia(' + Math.min(0.6, a.temperature * 0.6) + ')');
    else if (a.temperature < 0) parts.push('hue-rotate(' + a.temperature * 20 + 'deg)');
    return parts.join(' ');
  }

  function clipFilterString(clip) {
    const preset = FILTERS[clip.filterId] || '';
    const adj = adjustFilterString(clip.adjust);
    return (preset + ' ' + adj).trim();
  }

  /* ---------- cover-crop draw ---------- */
  function drawMediaCover(el, srcW, srcH, focal, alpha, geometry) {
    // geometry: {dx, dy, dw, dh} destination rect; cover-crop source rect using focal point
    const fw = focal && focal.x != null ? focal.x : 0.5;
    const fh = focal && focal.y != null ? focal.y : 0.5;
    const destRatio = geometry.dw / geometry.dh;
    const srcRatio = srcW / srcH;
    let sx, sy, sw, sh;
    if (srcRatio > destRatio) {
      sh = srcH;
      sw = srcH * destRatio;
      sx = Math.max(0, Math.min(srcW - sw, srcW * fw - sw / 2));
      sy = 0;
    } else {
      sw = srcW;
      sh = srcW / destRatio;
      sx = 0;
      sy = Math.max(0, Math.min(srcH - sh, srcH * fh - sh / 2));
    }
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    try {
      ctx.drawImage(el, sx, sy, sw, sh, geometry.dx, geometry.dy, geometry.dw, geometry.dh);
    } catch (e) {}
    ctx.restore();
  }

  /* ---------- clip frame ---------- */
  function drawClipFrame(clip, localT, alpha, opts) {
    const el = getClipEl(clip);
    if (!el) return;
    const isVideo = clip.type === 'video';
    if (isVideo) {
      const target = clip.trimStart + localT * (clip.speed || 1);
      if (el.readyState >= 1 && Math.abs((el.currentTime || 0) - target) > (opts && opts.exporting ? 0.02 : 0.22)) {
        try {
          el.currentTime = target;
        } catch (e) {}
      }
      if (playing || (opts && opts.exporting)) {
        if (el.paused) {
          el.playbackRate = clip.speed || 1;
          const pr = el.play();
          if (pr && pr.catch) pr.catch(() => {});
        } else if (Math.abs(el.playbackRate - (clip.speed || 1)) > 0.01) {
          el.playbackRate = clip.speed || 1;
        }
      } else if (!el.paused) {
        el.pause();
      }
      setElementVolume(el, clip.muted ? 0 : (clip.volume != null ? clip.volume : 1) * (NC.store.state.project.masterVolume || 1));
    }

    const srcW = isVideo ? el.videoWidth || 16 : el.naturalWidth || 16;
    const srcH = isVideo ? el.videoHeight || 9 : el.naturalHeight || 9;

    const geom = (opts && opts.geom) || { dx: 0, dy: 0, dw: previewW, dh: previewH };

    ctx.save();
    const fStr = clipFilterString(clip);
    if (fStr) ctx.filter = fStr;
    drawMediaCover(el, srcW, srcH, clip.focal, alpha, geom);
    ctx.restore();

    // vignette
    const vig = (clip.adjust && clip.adjust.vignette) || 0;
    if (vig > 0) {
      const g = ctx.createRadialGradient(
        geom.dx + geom.dw / 2,
        geom.dy + geom.dh / 2,
        Math.min(geom.dw, geom.dh) * 0.25,
        geom.dx + geom.dw / 2,
        geom.dy + geom.dh / 2,
        Math.max(geom.dw, geom.dh) * 0.72
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,' + Math.min(0.85, vig) + ')');
      ctx.save();
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.fillStyle = g;
      ctx.fillRect(geom.dx, geom.dy, geom.dw, geom.dh);
      ctx.restore();
    }
    // grain
    const grain = (clip.adjust && clip.adjust.grain) || 0;
    if (grain > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.35, grain * 0.35) * (alpha == null ? 1 : alpha);
      for (let i = 0; i < 60; i++) {
        const gx = geom.dx + Math.random() * geom.dw;
        const gy = geom.dy + Math.random() * geom.dh;
        const gs = Math.random() * 2.2 + 0.5;
        ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
        ctx.fillRect(gx, gy, gs, gs);
      }
      ctx.restore();
    }
  }

  /* ---------- transitions ---------- */
  function drawTransition(prevHit, curHit, t) {
    const clip = curHit.clip;
    const tdur = Math.min(clip.transition.duration || 0.5, curHit.duration);
    const p = Math.max(0, Math.min(1, curHit.localT / tdur));
    const type = clip.transition.type || 'none';

    const prevClip = NC.store.state.project.clips[curHit.index - 1];
    const w = previewW;
    const h = previewH;

    function drawPrev(alpha, geom) {
      if (!prevClip) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        return;
      }
      const prevDur = NC.store.clipDuration(prevClip);
      drawClipFrame(prevClip, Math.max(0, prevDur - 0.001), alpha, { geom: geom });
    }

    switch (type) {
      case 'fade':
        drawPrev(1);
        drawClipFrame(clip, curHit.localT, p);
        break;
      case 'fade-black':
        drawPrev(1 - p);
        drawClipFrame(clip, curHit.localT, p);
        break;
      case 'slide-left':
        drawPrev(1, { dx: -p * w, dy: 0, dw: w, dh: h });
        drawClipFrame(clip, curHit.localT, 1, { geom: { dx: (1 - p) * w, dy: 0, dw: w, dh: h } });
        break;
      case 'slide-right':
        drawPrev(1, { dx: p * w, dy: 0, dw: w, dh: h });
        drawClipFrame(clip, curHit.localT, 1, { geom: { dx: -(1 - p) * w, dy: 0, dw: w, dh: h } });
        break;
      case 'slide-up':
        drawPrev(1, { dx: 0, dy: p * h, dw: w, dh: h });
        drawClipFrame(clip, curHit.localT, 1, { geom: { dx: 0, dy: -(1 - p) * h, dw: w, dh: h } });
        break;
      case 'zoom':
        drawPrev(1);
        {
          const scale = 1.35 - 0.35 * p;
          const dw = w * scale;
          const dh = h * scale;
          drawClipFrame(clip, curHit.localT, p, { geom: { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh } });
        }
        break;
      case 'wipe':
        drawPrev(1);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w * p, h);
        ctx.clip();
        drawClipFrame(clip, curHit.localT, 1);
        ctx.restore();
        break;
      default:
        drawClipFrame(clip, curHit.localT, 1);
    }
  }

  /* ---------- overlays ---------- */
  const FONT_STACKS = {
    sans: "'Noto Sans Bengali','Hind Siliguri','Segoe UI',system-ui,-apple-system,sans-serif",
    serif: "'Noto Serif Bengali',Georgia,'Times New Roman',serif",
    mono: "'JetBrains Mono','Consolas','Courier New',monospace",
    rounded: "'Nunito','Noto Sans Bengali','Segoe UI',system-ui,sans-serif",
  };

  function animState(item, tSec, dur) {
    const tIn = tSec - item.start;
    const tOut = item.end - tSec;
    const fadeLen = 0.45;
    let alpha = 1;
    let dx = 0;
    let dy = 0;
    let scale = item.scale != null ? item.scale : 1;
    const anim = item.anim || 'none';
    if (anim === 'fade') {
      alpha = Math.min(1, tIn / fadeLen) * Math.min(1, tOut / fadeLen);
    } else if (anim === 'slide') {
      if (tIn < fadeLen) {
        const p = tIn / fadeLen;
        dy = (1 - p) * previewH * 0.08;
        alpha = p;
      }
      if (tOut < fadeLen) {
        const p = tOut / fadeLen;
        alpha = Math.min(alpha, p);
      }
    } else if (anim === 'pop') {
      if (tIn < fadeLen) {
        const p = tIn / fadeLen;
        const s = p < 0.7 ? p * 1.45 : 1 + (1 - p) * 0.25;
        scale = (item.scale != null ? item.scale : 1) * s;
        alpha = Math.min(1, p * 1.6);
      }
      if (tOut < fadeLen) alpha = Math.min(alpha, tOut / fadeLen);
    } else {
      if (tIn < 0.2) alpha = tIn / 0.2;
      if (tOut < 0.2) alpha = Math.min(alpha, tOut / 0.2);
    }
    return { alpha: Math.max(0, Math.min(1, alpha)), dx, dy, scale };
  }

  function drawTextItem(item, tSec) {
    if (tSec < item.start || tSec > item.end) return;
    const st = item.style || {};
    const a = animState(item, tSec);
    const x = item.x * previewW + a.dx;
    const y = item.y * previewH + a.dy;
    const size = (st.size || 42) * (previewW / 540);

    ctx.save();
    ctx.globalAlpha = a.alpha;
    ctx.translate(x, y);
    if (item.rot) ctx.rotate((item.rot * Math.PI) / 180);
    ctx.scale(a.scale, a.scale);
    ctx.textAlign = st.align === 'left' ? 'left' : st.align === 'right' ? 'right' : 'center';
    ctx.textBaseline = 'middle';
    const weight = st.bold ? '700' : '400';
    const italic = st.italic ? 'italic ' : '';
    ctx.font = italic + weight + ' ' + size + 'px ' + (FONT_STACKS[st.font] || FONT_STACKS.sans);

    const lines = String(item.content || '').split('\n');
    const lineH = size * 1.25;
    const startY = -((lines.length - 1) * lineH) / 2;

    if (st.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = size * 0.22;
      ctx.shadowOffsetY = size * 0.07;
      ctx.fillStyle = st.color || '#fff';
      lines.forEach((ln, i) => ctx.fillText(ln, 0, startY + i * lineH));
      ctx.restore();
    }
    if (st.stroke > 0) {
      ctx.lineWidth = (st.stroke || 0) * (size / 32);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = st.strokeColor || '#000';
      lines.forEach((ln, i) => ctx.strokeText(ln, 0, startY + i * lineH));
    }
    ctx.fillStyle = st.color || '#fff';
    lines.forEach((ln, i) => ctx.fillText(ln, 0, startY + i * lineH));
    ctx.restore();
  }

  function drawStickerItem(item, tSec) {
    if (tSec < item.start || tSec > item.end) return;
    const a = animState(item, tSec);
    const size = 96 * (previewW / 540) * (item.scale != null ? item.scale : 1);
    ctx.save();
    ctx.globalAlpha = a.alpha;
    ctx.translate(item.x * previewW + a.dx, item.y * previewH + a.dy);
    if (item.rot) ctx.rotate((item.rot * Math.PI) / 180);
    ctx.scale(a.scale / (item.scale || 1), a.scale / (item.scale || 1));
    ctx.font = size + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.emoji, 0, 0);
    ctx.restore();
  }

  /* ---------- main render ---------- */
  function renderFrame(tSec, opts) {
    if (!ctx) return;
    const project = NC.store.state.project;
    ctx.clearRect(0, 0, previewW, previewH);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, previewW, previewH);

    const hit = NC.store.clipAtTime(tSec);
    if (hit && hit.clip) {
      const clip = hit.clip;
      const tdur = Math.min(clip.transition.duration || 0.5, hit.duration);
      const hasTransition = hit.index > 0 && clip.transition && clip.transition.type && clip.transition.type !== 'none';
      if (hasTransition && hit.localT < tdur) {
        drawTransition(null, hit, tSec);
      } else {
        drawClipFrame(clip, hit.localT, 1, opts);
      }
    }

    for (const s of project.stickers) drawStickerItem(s, tSec);
    for (const tx of project.texts) drawTextItem(tx, tSec);
  }

  /* ---------- audio sync during preview ---------- */
  function syncAudio(tSec, isPlaying, opts) {
    const project = NC.store.state.project;
    for (const item of project.audios) {
      const el = getAudioEl(item);
      if (!el) continue;
      const inRange = tSec >= item.start && tSec <= item.end;
      const localT = item.trimStart + (tSec - item.start);
      if (inRange) {
        if (el.readyState >= 1 && Math.abs((el.currentTime || 0) - localT) > 0.3) {
          try {
            el.currentTime = Math.max(0, localT);
          } catch (e) {}
        }
        let vol = (item.volume != null ? item.volume : 1) * (project.masterVolume || 1);
        const tIn = tSec - item.start;
        const tOut = item.end - tSec;
        if (item.fadeIn > 0) vol *= Math.min(1, tIn / item.fadeIn);
        if (item.fadeOut > 0) vol *= Math.min(1, tOut / item.fadeOut);
        setElementVolume(el, vol);
        if ((isPlaying || (opts && opts.exporting)) && el.paused) {
          const pr = el.play();
          if (pr && pr.catch) pr.catch(() => {});
        } else if (!isPlaying && !(opts && opts.exporting) && !el.paused) {
          el.pause();
        }
      } else if (!el.paused) {
        el.pause();
      }
    }
  }

  /* ---------- playback loop ---------- */
  function tick() {
    rafId = 0;
    const now = performance.now();
    const dt = lastWall ? (now - lastWall) / 1000 : 0;
    lastWall = now;

    if (playing) {
      const dur = NC.store.totalDuration();
      let t = NC.store.state.time + dt;
      if (t >= dur) {
        t = dur;
        setPlaying(false);
        NC.store.setTime(dur);
      } else {
        NC.store.state.time = t;
        NC.store.emit('time', t);
      }
      renderFrame(NC.store.state.time);
      syncAudio(NC.store.state.time, true);
    } else {
      renderFrame(NC.store.state.time);
    }
    if (playing || keepRendering) {
      rafId = requestAnimationFrame(tick);
    }
  }

  let keepRendering = true; // keep a light render loop alive for overlay drags

  function requestRender() {
    if (!rafId) {
      lastWall = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function setPlaying(p) {
    playing = !!p;
    NC.store.setPlaying(playing);
    if (!playing) {
      // pause all clip video elements and audio
      for (const [, el] of clipEls) {
        try {
          el.pause && el.pause();
        } catch (e) {}
      }
      syncAudio(NC.store.state.time, false);
    } else {
      ensureAudioGraph();
    }
    requestRender();
    NC.store.emit('playstate', playing);
  }

  /* ---------- public init ---------- */
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    computePreviewSize();
    requestRender();

    NC.store.on('change', () => {
      cleanupUnusedEls();
      computePreviewSize();
      requestRender();
    });
    NC.store.on('time', () => requestRender());
    NC.store.on('langchange', () => requestRender());
    // keep looping so dragging overlays reflects instantly
    requestRender();
    setInterval(() => {
      if (!playing && !rafId) requestRender();
    }, 250);
  }

  NC.engine = {
    init,
    renderFrame,
    requestRender,
    setPlaying,
    isPlaying: () => playing,
    togglePlay: () => setPlaying(!playing),
    seek(tSec) {
      // pause videos and reposition
      for (const [id, el] of clipEls) {
        if (el && el.tagName === 'VIDEO') {
          try {
            const clip = NC.store.state.project.clips.find((c) => c.id === id);
            if (clip) {
              const hit = NC.store.clipAtTime(tSec);
              if (hit && hit.clip.id === id) {
                el.currentTime = clip.trimStart + hit.localT * (clip.speed || 1);
              }
            }
          } catch (e) {}
        }
      }
      NC.store.setTime(tSec);
      syncAudio(tSec, playing);
      requestRender();
    },
    computePreviewSize,
    ASPECTS,
    FILTERS,
    TRANSITIONS,
    FONT_STACKS,
    adjustFilterString,
    ensureAudioGraph,
    setMasterVolume(v) {
      if (masterGain) masterGain.gain.value = v;
    },
    stopAll() {
      setPlaying(false);
    },
  };
})();

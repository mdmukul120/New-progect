/* NovaCut — exporter: render the timeline to a video file via MediaRecorder */
(function () {
  const NC = (window.NC = window.NC || {});
  const t = (k, p) => NC.i18n.t(k, p);

  let exporting = false;
  let cancelled = false;
  let recorder = null;
  let progressCb = null;

  function pickMime() {
    const candidates = [
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const m of candidates) {
      try {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
      } catch (e) {}
    }
    return '';
  }

  function resFor(resKey, aspectKey) {
    const aspect = NC.engine.ASPECTS[aspectKey] || NC.engine.ASPECTS['9:16'];
    const ratio = aspect.w / aspect.h;
    let long;
    if (resKey === '1080') long = 1920;
    else if (resKey === '480') long = 854;
    else long = 1280;
    let w, h;
    if (ratio >= 1) {
      w = long;
      h = Math.round(long / ratio / 2) * 2;
    } else {
      h = long;
      w = Math.round(long * ratio / 2) * 2;
    }
    return { w: w - (w % 2), h: h - (h % 2) };
  }

  async function start(opts) {
    if (exporting) return;
    const project = NC.store.state.project;
    if (!project.clips.length) {
      if (progressCb) progressCb({ type: 'error', message: t('empty.timeline') });
      return;
    }
    exporting = true;
    cancelled = false;
    NC.engine.stopAll();

    const res = resFor(opts.resolution || '720', project.aspect);
    const fps = opts.fps || 30;
    const quality = opts.quality || 'high';
    const bitrate =
      quality === 'high' ? (res.h >= 1080 ? 12000000 : 8000000) : quality === 'medium' ? 4500000 : 2000000;

    if (progressCb) progressCb({ type: 'status', message: t('export.preparing') });

    /* offscreen export canvas at full res */
    const canvas = document.createElement('canvas');
    canvas.width = res.w;
    canvas.height = res.h;
    const ctx = canvas.getContext('2d');

    /* video-only stream from canvas */
    const canvasStream = canvas.captureStream(fps);

    /* audio mix via WebAudio */
    NC.engine.ensureAudioGraph();
    let audioTrack = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      await ac.resume();
      const dest = ac.createMediaStreamDestination();
      /* hook every media element used by the project */
      const elements = [];
      project.clips.forEach((clip) => {
        const url = NC.store.getMediaURL(clip.mediaId);
        if (!url) return;
        if (clip.type === 'video') {
          const v = document.createElement('video');
          v.src = url;
          v.preload = 'auto';
          v.playsInline = true;
          v.crossOrigin = 'anonymous';
          elements.push({ el: v, clip });
        }
      });
      project.audios.forEach((item) => {
        const url = NC.store.getMediaURL(item.mediaId);
        if (!url) return;
        const a = new Audio();
        a.src = url;
        a.preload = 'auto';
        elements.push({ el: a, audio: item });
      });
      for (const entry of elements) {
        try {
          const src = ac.createMediaElementSource(entry.el);
          const gain = ac.createGain();
          gain.gain.value = 1;
          src.connect(gain);
          gain.connect(dest);
          entry.gain = gain;
        } catch (e) {}
      }
      if (dest.stream.getAudioTracks().length) {
        audioTrack = dest.stream.getAudioTracks()[0];
      }
      canvas._ncAudioCtx = ac;
      canvas._ncEntries = elements;
    } catch (e) {
      console.warn('audio graph for export failed', e);
    }

    const stream = new MediaStream();
    canvasStream.getVideoTracks().forEach((tr) => stream.addTrack(tr));
    if (audioTrack) stream.addTrack(audioTrack);

    const mime = pickMime();
    if (!mime && !window.MediaRecorder) {
      exporting = false;
      if (progressCb) progressCb({ type: 'error', message: t('export.error') });
      return;
    }

    const chunks = [];
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: 128000,
      });
    } catch (e) {
      exporting = false;
      if (progressCb) progressCb({ type: 'error', message: t('export.error') + ': ' + e.message });
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };

    const done = new Promise((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(250);

    /* ---- playback loop through the timeline, rendered to export canvas ---- */
    const duration = NC.store.totalDuration();
    const startWall = performance.now();

    function renderExportFrame(tSec) {
      ctx.save();
      ctx.scale(res.w / (canvas._ncPrevW || res.w), res.h / (canvas._ncPrevH || res.h));
      ctx.restore();
      /* render via engine's compositor into this canvas: temporarily swap */
      renderToCanvas(ctx, res.w, res.h, tSec);
    }

    canvas._ncPrevW = res.w;
    canvas._ncPrevH = res.h;

    /* drive clip media elements at export res */
    function renderToCanvas(targetCtx, W, H, tSec) {
      targetCtx.fillStyle = '#000';
      targetCtx.fillRect(0, 0, W, H);
      const hit = NC.store.clipAtTime(tSec);
      if (hit && hit.clip) {
        const clip = hit.clip;
        const el = ensureEl(clip);
        if (el) {
          const isVideo = clip.type === 'video';
          if (isVideo) {
            const target = clip.trimStart + hit.localT * (clip.speed || 1);
            if (el.readyState >= 1 && Math.abs((el.currentTime || 0) - target) > 0.02) {
              try {
                el.currentTime = target;
              } catch (e) {}
            }
            if (el.paused) {
              el.playbackRate = clip.speed || 1;
              const pr = el.play();
              if (pr && pr.catch) pr.catch(() => {});
            }
            /* volume */
            const v = clip.muted ? 0 : (clip.volume != null ? clip.volume : 1) * (project.masterVolume || 1);
            try {
              el.volume = Math.max(0, Math.min(1, v));
            } catch (e) {}
          }
          const srcW = isVideo ? el.videoWidth || 16 : el.naturalWidth || 16;
          const srcH = isVideo ? el.videoHeight || 9 : el.naturalHeight || 9;
          const fStr = (NC.engine.FILTERS[clip.filterId] || '') + ' ' + NC.engine.adjustFilterString(clip.adjust);
          targetCtx.save();
          if (fStr.trim()) targetCtx.filter = fStr.trim();
          drawCover(targetCtx, el, srcW, srcH, clip.focal, 1, { dx: 0, dy: 0, dw: W, dh: H });
          targetCtx.restore();
          /* vignette */
          const vig = (clip.adjust && clip.adjust.vignette) || 0;
          if (vig > 0) {
            const g = targetCtx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,' + Math.min(0.85, vig) + ')');
            targetCtx.fillStyle = g;
            targetCtx.fillRect(0, 0, W, H);
          }
        }
      }
      /* texts + stickers (scaled from preview-space 540x960 reference) */
      const scaleRef = W / 540;
      for (const s of project.stickers) drawStickerExport(targetCtx, s, tSec, W, H, scaleRef);
      for (const tx of project.texts) drawTextExport(targetCtx, tx, tSec, W, H, scaleRef);
    }

    function ensureEl(clip) {
      if (!canvas._ncExportEls) canvas._ncExportEls = new Map();
      let el = canvas._ncExportEls.get(clip.id);
      const url = NC.store.getMediaURL(clip.mediaId);
      if (!url) return null;
      if (!el) {
        if (clip.type === 'video') {
          el = document.createElement('video');
          el.src = url;
          el.preload = 'auto';
          el.playsInline = true;
          el.muted = false;
        } else {
          el = new Image();
          el.src = url;
        }
        canvas._ncExportEls.set(clip.id, el);
      }
      return el;
    }

    function drawCover(c2, el, srcW, srcH, focal, alpha, geom) {
      const fw = focal && focal.x != null ? focal.x : 0.5;
      const fh = focal && focal.y != null ? focal.y : 0.5;
      const destRatio = geom.dw / geom.dh;
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
      c2.save();
      c2.globalAlpha = alpha;
      try {
        c2.drawImage(el, sx, sy, sw, sh, geom.dx, geom.dy, geom.dw, geom.dh);
      } catch (e) {}
      c2.restore();
    }

    function animAlpha(item, tSec) {
      const tIn = tSec - item.start;
      const tOut = item.end - tSec;
      const fadeLen = 0.45;
      let alpha = 1;
      if ((item.anim || 'none') === 'fade') {
        alpha = Math.min(1, tIn / fadeLen) * Math.min(1, tOut / fadeLen);
      } else {
        if (tIn < 0.2) alpha = tIn / 0.2;
        if (tOut < 0.2) alpha = Math.min(alpha, tOut / 0.2);
      }
      return Math.max(0, Math.min(1, alpha));
    }

    function drawTextExport(c2, item, tSec, W, H, scaleRef) {
      if (tSec < item.start || tSec > item.end) return;
      const st = item.style || {};
      const alpha = animAlpha(item, tSec);
      const size = (st.size || 42) * scaleRef;
      c2.save();
      c2.globalAlpha = alpha;
      c2.translate(item.x * W, item.y * H);
      if (item.rot) c2.rotate((item.rot * Math.PI) / 180);
      const sc = item.scale != null ? item.scale : 1;
      c2.scale(sc, sc);
      c2.textAlign = st.align === 'left' ? 'left' : st.align === 'right' ? 'right' : 'center';
      c2.textBaseline = 'middle';
      const weight = st.bold ? '700' : '400';
      const italic = st.italic ? 'italic ' : '';
      const stacks = NC.engine.FONT_STACKS;
      c2.font = italic + weight + ' ' + size + 'px ' + (stacks[st.font] || stacks.sans);
      const lines = String(item.content || '').split('\n');
      const lineH = size * 1.25;
      const startY = -((lines.length - 1) * lineH) / 2;
      if (st.shadow) {
        c2.save();
        c2.shadowColor = 'rgba(0,0,0,0.55)';
        c2.shadowBlur = size * 0.22;
        c2.shadowOffsetY = size * 0.07;
        c2.fillStyle = st.color || '#fff';
        lines.forEach((ln, i) => c2.fillText(ln, 0, startY + i * lineH));
        c2.restore();
      }
      if (st.stroke > 0) {
        c2.lineWidth = (st.stroke || 0) * (size / 32);
        c2.lineJoin = 'round';
        c2.strokeStyle = st.strokeColor || '#000';
        lines.forEach((ln, i) => c2.strokeText(ln, 0, startY + i * lineH));
      }
      c2.fillStyle = st.color || '#fff';
      lines.forEach((ln, i) => c2.fillText(ln, 0, startY + i * lineH));
      c2.restore();
    }

    function drawStickerExport(c2, item, tSec, W, H, scaleRef) {
      if (tSec < item.start || tSec > item.end) return;
      const alpha = animAlpha(item, tSec);
      const size = 96 * scaleRef * (item.scale != null ? item.scale : 1);
      c2.save();
      c2.globalAlpha = alpha;
      c2.translate(item.x * W, item.y * H);
      if (item.rot) c2.rotate((item.rot * Math.PI) / 180);
      c2.font = size + 'px serif';
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.fillText(item.emoji, 0, 0);
      c2.restore();
    }

    /* audio elements driven by time */
    function driveAudio(tSec) {
      project.audios.forEach((item) => {
        const entry = (canvas._ncEntries || []).find((e) => e.audio && e.audio.id === item.id);
        if (!entry) return;
        const el = entry.el;
        const inRange = tSec >= item.start && tSec <= item.end;
        const localT = item.trimStart + (tSec - item.start);
        if (inRange) {
          if (el.readyState >= 1 && Math.abs((el.currentTime || 0) - localT) > 0.25) {
            try {
              el.currentTime = Math.max(0, localT);
            } catch (e) {}
          }
          let vol = (item.volume != null ? item.volume : 1) * (project.masterVolume || 1);
          if (item.fadeIn > 0) vol *= Math.min(1, (tSec - item.start) / item.fadeIn);
          if (item.fadeOut > 0) vol *= Math.min(1, (item.end - tSec) / item.fadeOut);
          try {
            el.volume = Math.max(0, Math.min(1, vol));
          } catch (e) {}
          if (el.paused) {
            const pr = el.play();
            if (pr && pr.catch) pr.catch(() => {});
          }
        } else if (!el.paused) {
          el.pause();
        }
      });
    }

    await new Promise((resolve) => {
      function loop() {
        if (cancelled) return resolve();
        const elapsed = (performance.now() - startWall) / 1000;
        const tSec = Math.min(elapsed, duration);
        renderExportFrame(tSec);
        driveAudio(tSec);
        if (progressCb) {
          progressCb({
            type: 'progress',
            value: duration ? tSec / duration : 0,
            message: t('export.rendering'),
          });
        }
        if (elapsed >= duration) return resolve();
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });

    /* stop everything */
    try {
      recorder.stop();
    } catch (e) {}
    await done;

    try {
      (canvas._ncEntries || []).forEach((e) => {
        try {
          e.el.pause();
        } catch (err) {}
      });
      if (canvas._ncAudioCtx && canvas._ncAudioCtx.close) canvas._ncAudioCtx.close();
    } catch (e) {}

    exporting = false;

    const ext = (mime || 'video/webm').indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    if (!blob.size) {
      if (progressCb) progressCb({ type: 'error', message: t('export.error') });
      return;
    }
    const url = URL.createObjectURL(blob);
    const fileName =
      (project.name || 'novacut').replace(/[^\w\u0980-\u09FF-]+/g, '_') + '_' + Date.now() + '.' + ext;

    /* Android app bridge: save straight to Movies/NovaCut */
    if (window.NovaCutBridge && window.NovaCutBridge.saveFile) {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const b64 = String(reader.result).split(',')[1] || '';
            window.NovaCutBridge.saveFile(b64, fileName, mime || 'video/webm');
          } catch (e) {}
        };
        reader.readAsDataURL(blob);
      } catch (e) {}
    }

    if (progressCb) progressCb({ type: 'done', url, fileName, size: blob.size });
  }

  function cancel() {
    cancelled = true;
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } catch (e) {}
    exporting = false;
  }

  NC.exporter = {
    start,
    cancel,
    onProgress: (cb) => {
      progressCb = cb;
    },
    isExporting: () => exporting,
  };
})();

/* NovaCut — AI smart tools: Auto Enhance, Smart Scene Cut, Auto Captions, Auto Reframe, Auto Volume */
(function () {
  const NC = (window.NC = window.NC || {});
  const t = (k, p) => NC.i18n.t(k, p);

  function status(msg, isError) {
    const s = document.getElementById('ai-status');
    if (s) {
      s.textContent = msg || '';
      s.classList.toggle('error', !!isError);
    }
    if (msg && !isError && msg !== t('ai.working')) {
      setTimeout(() => {
        if (s && s.textContent === msg) s.textContent = '';
      }, 3500);
    }
  }

  function selectedClip() {
    const sel = NC.store.getSelected();
    if (sel && sel.kind === 'clip') return sel.item;
    return NC.store.state.project.clips[0] || null;
  }

  function videoElFor(clip) {
    return new Promise((resolve, reject) => {
      const url = NC.store.getMediaURL(clip.mediaId);
      const media = NC.store.getMedia(clip.mediaId);
      if (!url || !media) return reject(new Error('no media'));
      if (media.kind !== 'video') return reject(new Error('not video'));
      const v = document.createElement('video');
      v.preload = 'auto';
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      v.onloadeddata = () => resolve(v);
      v.onerror = () => reject(new Error('load error'));
    });
  }

  function seek(v, time) {
    return new Promise((resolve) => {
      const done = () => {
        v.removeEventListener('seeked', done);
        resolve();
      };
      v.addEventListener('seeked', done);
      try {
        v.currentTime = Math.max(0, Math.min(time, (v.duration || 1) - 0.05));
      } catch (e) {
        resolve();
      }
      setTimeout(done, 1200);
    });
  }

  function frameStats(v, w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cx = c.getContext('2d');
    cx.drawImage(v, 0, 0, w, h);
    const data = cx.getImageData(0, 0, w, h).data;
    let sumL = 0;
    let sumL2 = 0;
    let sumSat = 0;
    const n = w * h;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      sumL += l;
      sumL2 += l * l;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      sumSat += mx === 0 ? 0 : (mx - mn) / mx;
    }
    const meanL = sumL / n;
    const varL = Math.max(0, sumL2 / n - meanL * meanL);
    return { brightness: meanL, contrast: Math.sqrt(varL), saturation: sumSat / n };
  }

  function smallDiff(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i += 4) {
      d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    }
    return d / (a.length / 4) / 255;
  }

  /* ---------- 1. Auto Enhance ---------- */
  async function autoEnhance() {
    const clip = selectedClip();
    if (!clip) return status(t('empty.timeline'), true);
    status(t('ai.working'));
    try {
      let stats;
      if (clip.type === 'video') {
        const v = await videoElFor(clip);
        const samples = [];
        for (const frac of [0.15, 0.4, 0.6, 0.85]) {
          await seek(v, (v.duration || 2) * frac);
          samples.push(frameStats(v, 48, 48));
        }
        stats = samples.reduce(
          (acc, s) => ({
            brightness: acc.brightness + s.brightness / samples.length,
            contrast: acc.contrast + s.contrast / samples.length,
            saturation: acc.saturation + s.saturation / samples.length,
          }),
          { brightness: 0, contrast: 0, saturation: 0 }
        );
        v.src = '';
      } else {
        const url = NC.store.getMediaURL(clip.mediaId);
        const img = await new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = rej;
          im.src = url;
        });
        const c = document.createElement('canvas');
        c.width = 48;
        c.height = 48;
        c.getContext('2d').drawImage(img, 0, 0, 48, 48);
        const d = c.getContext('2d').getImageData(0, 0, 48, 48).data;
        let sumL = 0;
        let sumSat = 0;
        const n = 48 * 48;
        for (let i = 0; i < d.length; i += 4) {
          sumL += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
          const mx = Math.max(d[i], d[i + 1], d[i + 2]);
          const mn = Math.min(d[i], d[i + 1], d[i + 2]);
          sumSat += mx === 0 ? 0 : (mx - mn) / mx;
        }
        stats = { brightness: sumL / n, contrast: 0.25, saturation: sumSat / n };
      }

      /* target: brightness ~0.52, saturation ~0.32 */
      const bTarget = 0.52;
      const sTarget = 0.32;
      let b = 1;
      let s = 1;
      let c = 1;
      if (stats.brightness > 0.02) {
        b = Math.max(0.65, Math.min(1.55, bTarget / stats.brightness));
      }
      s = Math.max(0.7, Math.min(1.7, sTarget / Math.max(0.05, stats.saturation)));
      c = Math.max(0.9, Math.min(1.3, 0.32 / Math.max(0.12, stats.contrast)));

      NC.store.updateClip(clip.id, {
        adjust: { brightness: round2(b), contrast: round2(c), saturation: round2(s) },
        filterId: 'none',
      });
      status(t('ai.done') + ' — ' + t('toast.enhanced'));
    } catch (e) {
      console.warn(e);
      status(t('toast.mediaError'), true);
    }
  }

  /* ---------- 2. Smart Scene Cut ---------- */
  async function smartSceneCut() {
    const clip = selectedClip();
    if (!clip || clip.type !== 'video') return status(t('empty.timeline'), true);
    status(t('ai.working'));
    try {
      const v = await videoElFor(clip);
      const dur = v.duration || 0;
      const w = 32;
      const h = 18;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cx = c.getContext('2d', { willReadFrequently: true });

      const step = Math.max(0.25, dur / 90); // sample up to ~90 frames
      const frames = [];
      for (let time = clip.trimStart; time < clip.trimEnd; time += step) {
        await seek(v, time);
        cx.drawImage(v, 0, 0, w, h);
        frames.push({ time, data: cx.getImageData(0, 0, w, h).data.slice(0) });
      }
      v.src = '';

      const cuts = [];
      for (let i = 1; i < frames.length; i++) {
        const diff = smallDiff(frames[i - 1].data, frames[i].data);
        if (diff > 0.16) {
          const cutTime = (frames[i - 1].time + frames[i].time) / 2;
          if (cutTime > clip.trimStart + 0.15 && cutTime < clip.trimEnd - 0.15) cuts.push(cutTime);
        }
      }

      if (!cuts.length) {
        status(t('toast.sceneCutNone'));
        return;
      }

      /* split the clip at each cut point (timeline coordinates) */
      NC.store.snapshot();
      let current = clip;
      let index = NC.store.state.project.clips.findIndex((x) => x.id === clip.id);
      for (const cut of cuts) {
        const localT = (cut - current.trimStart) / (current.speed || 1);
        const hitStart = NC.store.clipStartAt(index);
        const splitAt = hitStart + localT;
        const curDur = NC.store.clipDuration(current);
        if (localT <= 0.15 || localT >= curDur - 0.15) continue;
        const second = JSON.parse(JSON.stringify(current));
        second.id = NC.store.uid('clip');
        second.trimStart = cut;
        current.trimEnd = cut;
        NC.store.state.project.clips.splice(index + 1, 0, second);
        current = second;
        index += 1;
      }
      NC.store.saveSoon();
      NC.store.emit('change');
      status(t('ai.done') + ' — ' + cuts.length + ' ' + t('ai.scenesFound'));
    } catch (e) {
      console.warn(e);
      status(t('toast.mediaError'), true);
    }
  }

  /* ---------- 3. Auto Captions (mic-assisted speech recognition) ---------- */
  let captionBusy = false;

  async function autoCaption() {
    if (captionBusy) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      status(t('ai.captionNoSupport'), true);
      /* open manual captions fallback */
      openManualCaptions();
      return;
    }
    if (!NC.store.state.project.clips.length) return status(t('empty.timeline'), true);

    captionBusy = true;
    status(t('ai.captionListening'));
    NC.engine.ensureAudioGraph();

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = NC.i18n.getLang() === 'bn' ? 'bn-BD' : 'en-US';

    const segments = [];
    let segStart = 0;
    let segText = '';

    const startT = performance.now();
    const timeNow = () => (performance.now() - startT) / 1000;

    rec.onresult = (ev) => {
      let interim = '';
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (final.trim()) {
        if (!segText) segStart = Math.max(0, timeNow() - final.length * 0.06);
        segText = (segText + ' ' + final.trim()).trim();
        const end = timeNow();
        if (segText.length > 2) {
          segments.push({ start: segStart, end: Math.max(segStart + 0.8, end), text: segText });
        }
        segText = '';
      } else if (interim.trim()) {
        if (!segText) segStart = timeNow();
        segText = interim.trim();
      }
    };

    rec.onerror = () => {
      finishCaption();
    };
    rec.onend = () => {
      finishCaption();
    };

    function finishCaption() {
      if (!captionBusy) return;
      captionBusy = false;
      try {
        NC.engine.stopAll();
      } catch (e) {}
      if (!segments.length) {
        status(t('toast.mediaError'), true);
        return;
      }
      NC.store.snapshot();
      segments.forEach((seg) => {
        NC.store.state.project.texts.push({
          id: NC.store.uid('text'),
          content: seg.text,
          start: Math.round(seg.start * 10) / 10,
          end: Math.round(Math.min(seg.end + 0.6, NC.store.totalDuration() || seg.end + 0.6) * 10) / 10,
          x: 0.5,
          y: 0.85,
          scale: 0.8,
          rot: 0,
          anim: 'fade',
          style: {
            color: '#ffffff',
            size: 30,
            font: 'sans',
            bold: true,
            italic: false,
            stroke: 2.5,
            strokeColor: '#000000',
            shadow: true,
            align: 'center',
          },
        });
      });
      NC.store.saveSoon();
      NC.store.emit('change');
      status(t('ai.done') + ' — ' + t('toast.captionDone'));
    }

    try {
      rec.start();
    } catch (e) {
      captionBusy = false;
      status(t('ai.captionNoSupport'), true);
      return;
    }

    /* play the video from 0 so the mic hears it */
    NC.engine.seek(0);
    setTimeout(() => {
      NC.engine.setPlaying(true);
    }, 250);

    /* auto-stop at video end + margin */
    const dur = NC.store.totalDuration();
    setTimeout(() => {
      try {
        rec.stop();
      } catch (e) {}
      setTimeout(finishCaption, 1500);
    }, (dur + 2) * 1000);
  }

  function openManualCaptions() {
    /* create a starter caption the user can edit */
    NC.store.addText(t('ai.captionManual'));
  }

  /* ---------- 4. Auto Reframe ---------- */
  async function autoReframe() {
    const project = NC.store.state.project;
    const order = ['9:16', '1:1', '4:5', '16:9'];
    const idx = order.indexOf(project.aspect);
    const next = order[(idx + 1) % order.length];
    NC.store.snapshot();
    project.aspect = next;
    NC.engine.computePreviewSize();
    NC.store.saveSoon();
    NC.store.emit('change');
    status(t('ai.done') + ' — ' + t('toast.reframed'));
  }

  /* ---------- 5. Auto Volume ---------- */
  async function autoVolume() {
    const audios = NC.store.state.project.audios;
    const clipAudios = NC.store.state.project.clips.filter((c) => !c.muted);
    status(t('ai.working'));
    try {
      /* analyze project audio loudness and normalize toward ~0.7 */
      for (const item of audios) {
        const media = NC.store.getMedia(item.mediaId);
        if (!media) continue;
        const url = NC.store.getMediaURL(item.mediaId);
        const blob = await fetch(url).then((r) => r.blob());
        const buf = await blob.arrayBuffer();
        const AC = window.AudioContext || window.webkitAudioContext;
        const ac = new AC();
        const audioBuf = await new Promise((res, rej) => ac.decodeAudioData(buf, res, rej));
        const data = audioBuf.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < data.length; i += 32) {
          const v = Math.abs(data[i]);
          if (v > peak) peak = v;
        }
        ac.close && ac.close();
        const target = 0.72;
        const vol = peak > 0.01 ? Math.max(0.15, Math.min(1, target / peak)) : 1;
        NC.store.updateAudio(item.id, { volume: Math.round(vol * 100) / 100 }, { skipSnapshot: true });
      }
      /* balance clip volumes to their setting (keep as-is but ensure unmuted clips have volume) */
      clipAudios.forEach((c) => {
        if (c.volume == null) NC.store.updateClip(c.id, { volume: 1 }, { skipSnapshot: true });
      });
      NC.store.snapshot();
      NC.store.saveSoon();
      NC.store.emit('change');
      status(t('ai.done') + ' — ' + t('toast.volumeDone'));
    } catch (e) {
      console.warn(e);
      status(t('toast.mediaError'), true);
    }
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  NC.ai = {
    autoEnhance,
    smartSceneCut,
    autoCaption,
    autoReframe,
    autoVolume,
    status,
  };
})();

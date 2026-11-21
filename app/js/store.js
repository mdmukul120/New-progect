/* NovaCut — state store: project model, media library (IndexedDB), undo/redo, autosave */
(function () {
  const NC = (window.NC = window.NC || {});
  const t = (k, p) => NC.i18n.t(k, p);

  /* ---------- tiny event bus ---------- */
  const listeners = {};
  function on(ev, fn) {
    (listeners[ev] = listeners[ev] || []).push(fn);
  }
  function emit(ev, payload) {
    (listeners[ev] || []).forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error('[NovaCut] listener error', ev, e);
      }
    });
    (listeners['*'] || []).forEach((fn) => {
      try {
        fn(ev, payload);
      } catch (e) {}
    });
  }

  /* ---------- IndexedDB ---------- */
  const DB_NAME = 'novacut-db';
  const DB_VER = 1;
  let db = null;

  function openDb() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(store, value) {
    return openDb().then(
      (d) =>
        new Promise((resolve, reject) => {
          const tx = d.transaction(store, 'readwrite');
          tx.objectStore(store).put(value);
          tx.oncomplete = () => resolve(value);
          tx.onerror = () => reject(tx.error);
        })
    );
  }
  function idbGet(store, key) {
    return openDb().then(
      (d) =>
        new Promise((resolve, reject) => {
          const tx = d.transaction(store, 'readonly');
          const req = tx.objectStore(store).get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        })
    );
  }
  function idbAll(store) {
    return openDb().then(
      (d) =>
        new Promise((resolve, reject) => {
          const tx = d.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    );
  }
  function idbDelete(store, key) {
    return openDb().then(
      (d) =>
        new Promise((resolve, reject) => {
          const tx = d.transaction(store, 'readwrite');
          tx.objectStore(store).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    );
  }

  /* ---------- ids ---------- */
  let idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    return prefix + '-' + Date.now().toString(36) + '-' + idCounter.toString(36);
  }

  /* ---------- project model ---------- */
  function newProjectModel(name) {
    return {
      id: uid('proj'),
      name: name || t('top.untitled'),
      aspect: '9:16',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      clips: [], // { id, mediaId, type:'video'|'image', trimStart, trimEnd, speed, volume, muted, filterId, adjust:{...}, transition:{type,duration}, focal:{x,y} }
      texts: [], // { id, content, start, end, x, y, scale, rot, style:{...}, anim }
      stickers: [], // { id, emoji, start, end, x, y, scale, rot, anim }
      audios: [], // { id, mediaId, name, start, end, trimStart, volume, fadeIn, fadeOut }
      masterVolume: 1,
    };
  }

  const DEFAULT_ADJUST = { brightness: 1, contrast: 1, saturation: 1, hue: 0, temperature: 0, vignette: 0, grain: 0 };

  function makeClip(mediaId, type) {
    const m = mediaCache.get(mediaId);
    return {
      id: uid('clip'),
      mediaId,
      type, // 'video' | 'image'
      trimStart: 0,
      trimEnd: type === 'image' ? 3 : (m && m.duration) || 5,
      speed: 1,
      volume: 1,
      muted: false,
      filterId: 'none',
      adjust: Object.assign({}, DEFAULT_ADJUST),
      transition: { type: 'none', duration: 0.5 },
      focal: { x: 0.5, y: 0.5 },
    };
  }

  /* ---------- state ---------- */
  const state = {
    project: newProjectModel(),
    time: 0,
    playing: false,
    zoom: 42, // px per second
    tool: 'edit',
    selection: { kind: null, id: null }, // kind: 'clip'|'text'|'sticker'|'audio'
  };

  /* ---------- media library ---------- */
  const mediaCache = new Map(); // id -> { id, name, type, duration, width, height, thumb, peaks }
  const urlCache = new Map(); // id -> objectURL

  function getMediaURL(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    return null;
  }

  async function registerMediaBlob(id, blob) {
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  }

  function probeVideo(url) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      const fail = () => reject(new Error('video probe failed'));
      v.onloadedmetadata = () => {
        const meta = { duration: v.duration || 0, width: v.videoWidth || 0, height: v.videoHeight || 0 };
        // thumbnail at ~0.15s
        const grab = () => {
          try {
            const c = document.createElement('canvas');
            const scale = 160 / Math.max(v.videoWidth, 1);
            c.width = Math.max(1, Math.round(v.videoWidth * scale));
            c.height = Math.max(1, Math.round(v.videoHeight * scale));
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
            meta.thumb = c.toDataURL('image/jpeg', 0.7);
          } catch (e) {
            meta.thumb = null;
          }
          resolve(meta);
        };
        v.onseeked = grab;
        try {
          v.currentTime = Math.min(0.15, (meta.duration || 1) / 2);
        } catch (e) {
          grab();
        }
      };
      v.onerror = fail;
    });
  }

  function probeImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const scale = 160 / Math.max(img.width, 1);
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve({
          duration: 3,
          width: img.width,
          height: img.height,
          thumb: c.toDataURL('image/jpeg', 0.7),
        });
      };
      img.onerror = () => reject(new Error('image probe failed'));
      img.src = url;
    });
  }

  function probeAudio(url, blob) {
    return new Promise((resolve) => {
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.src = url;
      const done = (peaks) => resolve({ duration: a.duration || 0, width: 0, height: 0, thumb: null, peaks: peaks || null });
      a.onloadedmetadata = () => {
        // try to compute waveform peaks
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const ac = new AC();
              ac.decodeAudioData(
                reader.result,
                (buf) => {
                  const data = buf.getChannelData(0);
                  const N = 120;
                  const block = Math.floor(data.length / N) || 1;
                  const peaks = [];
                  for (let i = 0; i < N; i++) {
                    let max = 0;
                    const s = i * block;
                    for (let j = 0; j < block; j += 16) {
                      const v = Math.abs(data[s + j] || 0);
                      if (v > max) max = v;
                    }
                    peaks.push(Math.round(max * 100) / 100);
                  }
                  ac.close && ac.close();
                  done(peaks);
                },
                () => done(null)
              );
            } catch (e) {
              done(null);
            }
          };
          reader.onerror = () => done(null);
          reader.readAsArrayBuffer(blob);
        } catch (e) {
          done(null);
        }
      };
      a.onerror = () => done(null);
    });
  }

  async function addMedia(file) {
    const kind = (file.type || '').split('/')[0];
    if (kind !== 'video' && kind !== 'image' && kind !== 'audio') throw new Error('unsupported');
    const id = uid('media');
    await idbPut('media', {
      id,
      name: file.name || (kind + '-' + id),
      kind,
      type: file.type,
      blob: file,
      createdAt: Date.now(),
    });
    const url = await registerMediaBlob(id, file);
    let meta;
    if (kind === 'video') meta = await probeVideo(url);
    else if (kind === 'image') meta = await probeImage(url);
    else meta = await probeAudio(url, file);
    const rec = {
      id,
      name: file.name || id,
      kind,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      thumb: meta.thumb,
      peaks: meta.peaks || null,
    };
    mediaCache.set(id, rec);
    emit('media', rec);
    return rec;
  }

  async function loadMediaLibrary() {
    const all = await idbAll('media');
    for (const rec of all) {
      mediaCache.set(rec.id, rec);
      registerMediaBlob(rec.id, rec.blob);
    }
  }

  function getMedia(id) {
    return mediaCache.get(id) || null;
  }

  function listMediaByKind(kind) {
    const out = [];
    for (const rec of mediaCache.values()) {
      if (!kind || rec.kind === kind) out.push(rec);
    }
    return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async function deleteMedia(id) {
    mediaCache.delete(id);
    const u = urlCache.get(id);
    if (u) {
      URL.revokeObjectURL(u);
      urlCache.delete(id);
    }
    await idbDelete('media', id);
  }

  /* ---------- undo / redo ---------- */
  const undoStack = [];
  const redoStack = [];
  const MAX_UNDO = 40;

  function snapshot() {
    undoStack.push(JSON.stringify(state.project));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    emit('history');
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(state.project));
    state.project = JSON.parse(undoStack.pop());
    clearDeadSelection();
    saveSoon();
    emit('change');
    emit('history');
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(state.project));
    state.project = JSON.parse(redoStack.pop());
    clearDeadSelection();
    saveSoon();
    emit('change');
    emit('history');
  }

  function clearDeadSelection() {
    const s = state.selection;
    if (!s.kind) return;
    const arr =
      s.kind === 'clip'
        ? state.project.clips
        : s.kind === 'text'
        ? state.project.texts
        : s.kind === 'sticker'
        ? state.project.stickers
        : state.project.audios;
    if (!arr.find((x) => x.id === s.id)) state.selection = { kind: null, id: null };
  }

  /* ---------- persistence ---------- */
  let saveTimer = null;
  function saveSoon() {
    state.project.updatedAt = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 1200);
  }

  async function saveNow() {
    try {
      await idbPut('projects', {
        id: state.project.id,
        name: state.project.name,
        updatedAt: state.project.updatedAt,
        state: JSON.parse(JSON.stringify(state.project)),
      });
      emit('saved');
    } catch (e) {
      console.warn('save failed', e);
    }
  }

  async function listProjects() {
    const all = await idbAll('projects');
    return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function loadProject(id) {
    const rec = await idbGet('projects', id);
    if (!rec) return false;
    state.project = rec.state;
    undoStack.length = 0;
    redoStack.length = 0;
    state.time = 0;
    state.selection = { kind: null, id: null };
    emit('change');
    emit('project');
    return true;
  }

  function createProject(name) {
    state.project = newProjectModel(name);
    undoStack.length = 0;
    redoStack.length = 0;
    state.time = 0;
    state.selection = { kind: null, id: null };
    saveNow();
    emit('change');
    emit('project');
  }

  async function deleteProject(id) {
    await idbDelete('projects', id);
  }

  async function renameProject(id, name) {
    if (state.project.id === id) {
      state.project.name = name;
      emit('change');
    }
    const rec = await idbGet('projects', id);
    if (rec) {
      rec.name = name;
      if (rec.state) rec.state.name = name;
      await idbPut('projects', rec);
    }
  }

  /* ---------- timeline math ---------- */
  function clipDuration(clip) {
    const raw = Math.max(0, (clip.trimEnd || 0) - (clip.trimStart || 0));
    return raw / (clip.speed || 1);
  }

  function clipStartAt(index) {
    let s = 0;
    for (let i = 0; i < index; i++) s += clipDuration(state.project.clips[i]);
    return s;
  }

  function totalDuration() {
    return state.project.clips.reduce((s, c) => s + clipDuration(c), 0);
  }

  function clipAtTime(t) {
    let acc = 0;
    const clips = state.project.clips;
    for (let i = 0; i < clips.length; i++) {
      const d = clipDuration(clips[i]);
      if (t < acc + d || i === clips.length - 1) {
        return { clip: clips[i], index: i, start: acc, duration: d, localT: Math.min(Math.max(0, t - acc), d) };
      }
      acc += d;
    }
    return null;
  }

  /* ---------- clip ops ---------- */
  function addClipFromMedia(mediaId) {
    const m = getMedia(mediaId);
    if (!m || m.kind === 'audio') return null;
    snapshot();
    const clip = makeClip(mediaId, m.kind);
    state.project.clips.push(clip);
    saveSoon();
    emit('change');
    return clip;
  }

  function removeClip(id) {
    snapshot();
    const p = state.project;
    const i = p.clips.findIndex((c) => c.id === id);
    if (i >= 0) p.clips.splice(i, 1);
    if (state.selection.id === id) state.selection = { kind: null, id: null };
    saveSoon();
    emit('change');
  }

  function moveClip(id, toIndex) {
    const p = state.project;
    const from = p.clips.findIndex((c) => c.id === id);
    if (from < 0) return;
    toIndex = Math.max(0, Math.min(p.clips.length - 1, toIndex));
    if (from === toIndex) return;
    snapshot();
    const [c] = p.clips.splice(from, 1);
    p.clips.splice(toIndex, 0, c);
    saveSoon();
    emit('change');
  }

  function duplicateClip(id) {
    const p = state.project;
    const i = p.clips.findIndex((c) => c.id === id);
    if (i < 0) return;
    snapshot();
    const copy = JSON.parse(JSON.stringify(p.clips[i]));
    copy.id = uid('clip');
    p.clips.splice(i + 1, 0, copy);
    saveSoon();
    emit('change');
  }

  function splitClipAtPlayhead() {
    const hit = clipAtTime(state.time);
    if (!hit || hit.localT <= 0.05 || hit.localT >= hit.duration - 0.05) {
      emit('toast', t('toast.nothingSplit'));
      return false;
    }
    snapshot();
    const clip = hit.clip;
    const localMediaTime = clip.trimStart + hit.localT * (clip.speed || 1);
    const second = JSON.parse(JSON.stringify(clip));
    second.id = uid('clip');
    second.trimStart = localMediaTime;
    clip.trimEnd = localMediaTime;
    state.project.clips.splice(hit.index + 1, 0, second);
    saveSoon();
    emit('change');
    return true;
  }

  function updateClip(id, patch, opts) {
    const clip = state.project.clips.find((c) => c.id === id);
    if (!clip) return;
    if (!opts || !opts.skipSnapshot) snapshot();
    Object.assign(clip, patch);
    if (patch.adjust) clip.adjust = Object.assign({}, clip.adjust, patch.adjust);
    if (patch.transition) clip.transition = Object.assign({}, clip.transition, patch.transition);
    if (patch.focal) clip.focal = Object.assign({}, clip.focal, patch.focal);
    saveSoon();
    emit('change');
  }

  /* ---------- text / sticker / audio ops ---------- */
  function addText(content) {
    snapshot();
    const start = Math.min(state.time, Math.max(0, totalDuration() - 1));
    const item = {
      id: uid('text'),
      content: content || 'NovaCut',
      start,
      end: Math.min(totalDuration() || start + 3, start + 3),
      x: 0.5,
      y: 0.5,
      scale: 1,
      rot: 0,
      anim: 'fade',
      style: {
        color: '#ffffff',
        size: 42,
        font: 'sans',
        bold: true,
        italic: false,
        stroke: 2,
        strokeColor: '#000000',
        shadow: true,
        align: 'center',
      },
    };
    if (totalDuration() === 0) {
      item.start = 0;
      item.end = 3;
    }
    state.project.texts.push(item);
    state.selection = { kind: 'text', id: item.id };
    saveSoon();
    emit('change');
    return item;
  }

  function updateText(id, patch, opts) {
    const item = state.project.texts.find((x) => x.id === id);
    if (!item) return;
    if (!opts || !opts.skipSnapshot) snapshot();
    Object.assign(item, patch);
    if (patch.style) item.style = Object.assign({}, item.style, patch.style);
    saveSoon();
    emit('change');
  }

  function removeItem(kind, id) {
    snapshot();
    const arr =
      kind === 'text' ? state.project.texts : kind === 'sticker' ? state.project.stickers : state.project.audios;
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr.splice(i, 1);
    if (state.selection.id === id) state.selection = { kind: null, id: null };
    saveSoon();
    emit('change');
  }

  function addSticker(emoji) {
    snapshot();
    const start = Math.min(state.time, Math.max(0, totalDuration() - 1));
    const item = {
      id: uid('sticker'),
      emoji: emoji || '😀',
      start: totalDuration() ? start : 0,
      end: totalDuration() ? Math.min(totalDuration(), start + 3) : 3,
      x: 0.5,
      y: 0.4,
      scale: 1,
      rot: 0,
      anim: 'pop',
    };
    state.project.stickers.push(item);
    state.selection = { kind: 'sticker', id: item.id };
    saveSoon();
    emit('change');
    return item;
  }

  function updateSticker(id, patch, opts) {
    const item = state.project.stickers.find((x) => x.id === id);
    if (!item) return;
    if (!opts || !opts.skipSnapshot) snapshot();
    Object.assign(item, patch);
    saveSoon();
    emit('change');
  }

  function addAudioFromMedia(mediaId) {
    const m = getMedia(mediaId);
    if (!m || m.kind !== 'audio') return null;
    snapshot();
    const item = {
      id: uid('audio'),
      mediaId,
      name: m.name,
      start: 0,
      end: m.duration || 5,
      trimStart: 0,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
    };
    state.project.audios.push(item);
    state.selection = { kind: 'audio', id: item.id };
    saveSoon();
    emit('change');
    return item;
  }

  function updateAudio(id, patch, opts) {
    const item = state.project.audios.find((x) => x.id === id);
    if (!item) return;
    if (!opts || !opts.skipSnapshot) snapshot();
    Object.assign(item, patch);
    saveSoon();
    emit('change');
  }

  /* ---------- selection ---------- */
  function select(kind, id) {
    state.selection = { kind: kind || null, id: id || null };
    emit('selection');
    emit('change');
  }

  function getSelected() {
    const s = state.selection;
    if (!s.kind) return null;
    const arr =
      s.kind === 'clip'
        ? state.project.clips
        : s.kind === 'text'
        ? state.project.texts
        : s.kind === 'sticker'
        ? state.project.stickers
        : state.project.audios;
    const item = arr.find((x) => x.id === s.id);
    return item ? { kind: s.kind, item } : null;
  }

  /* ---------- time ---------- */
  function setTime(tSec, opts) {
    const dur = totalDuration();
    state.time = Math.max(0, Math.min(dur, tSec));
    emit('time', state.time);
    if (opts && opts.force) emit('change');
  }

  function setPlaying(p) {
    state.playing = !!p;
    emit('playstate', state.playing);
  }

  /* ---------- init ---------- */
  async function init() {
    try {
      await openDb();
      await loadMediaLibrary();
      const projects = await listProjects();
      if (projects.length) {
        state.project = projects[0].state;
      } else {
        await saveNow();
      }
    } catch (e) {
      console.warn('[NovaCut] storage init failed, running in-memory', e);
    }
    emit('change');
    emit('project');
  }

  NC.store = {
    on,
    emit,
    init,
    state,
    t,
    /* media */
    addMedia,
    getMedia,
    getMediaURL,
    listMediaByKind,
    deleteMedia,
    /* project */
    createProject,
    loadProject,
    listProjects,
    deleteProject,
    renameProject,
    saveNow,
    saveSoon,
    /* clips */
    addClipFromMedia,
    removeClip,
    moveClip,
    duplicateClip,
    splitClipAtPlayhead,
    updateClip,
    clipDuration,
    clipStartAt,
    clipAtTime,
    totalDuration,
    /* overlays */
    addText,
    updateText,
    addSticker,
    updateSticker,
    addAudioFromMedia,
    updateAudio,
    removeItem,
    /* misc */
    select,
    getSelected,
    setTime,
    setPlaying,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    snapshot,
    uid,
    DEFAULT_ADJUST,
  };
})();

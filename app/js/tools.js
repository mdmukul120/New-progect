/* NovaCut — tool panels: clip edit, filters, adjust, text, stickers, audio, AI, aspect */
(function () {
  const NC = (window.NC = window.NC || {});
  const t = (k, p) => NC.i18n.t(k, p);

  let panelEl = null;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function slider(label, min, max, step, value, onInput, opts) {
    const wrap = el('div', 'tool-slider');
    const lab = el('label', null, label + '<b>' + (opts && opts.format ? opts.format(value) : value) + '</b>');
    const input = el('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    let snapTaken = false;
    input.addEventListener('pointerdown', () => {
      if (!snapTaken) {
        NC.store.snapshot();
        snapTaken = true;
      }
    });
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      lab.querySelector('b').textContent = opts && opts.format ? opts.format(v) : v;
      onInput(v);
    });
    input.addEventListener('change', () => {
      snapTaken = false;
      NC.store.saveSoon();
    });
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function button(label, cls, onClick) {
    const b = el('button', 'btn ' + (cls || ''), label);
    b.addEventListener('click', onClick);
    return b;
  }

  function sectionTitle(txt) {
    return el('div', 'tool-section-title', txt);
  }

  function selected() {
    return NC.store.getSelected();
  }

  /* ================= EDIT (clip) ================= */
  function renderEdit() {
    const wrap = el('div', 'tool-body');
    const sel = selected();
    const clip = sel && sel.kind === 'clip' ? sel.item : null;
    if (!clip) {
      wrap.appendChild(el('div', 'tool-empty', t('empty.timeline')));
      const importBtn = button('＋ ' + t('import.media'), 'btn-primary', () => NC.app.pickMedia());
      wrap.appendChild(importBtn);
      return wrap;
    }

    wrap.appendChild(sectionTitle(t('tool.edit')));
    /* speed */
    wrap.appendChild(
      slider(
        t('clip.speed') + ' ',
        0.25,
        4,
        0.05,
        clip.speed || 1,
        (v) => NC.store.updateClip(clip.id, { speed: v }, { skipSnapshot: true }),
        { format: (v) => v.toFixed(2) + 'x' }
      )
    );
    /* volume */
    wrap.appendChild(
      slider(
        t('clip.volume') + ' ',
        0,
        1,
        0.01,
        clip.volume != null ? clip.volume : 1,
        (v) => NC.store.updateClip(clip.id, { volume: v }, { skipSnapshot: true }),
        { format: (v) => Math.round(v * 100) + '%' }
      )
    );
    wrap.appendChild(
      button(
        clip.muted ? '🔇 ' + t('transport.unmute') : '🔊 ' + t('transport.mute'),
        'btn-ghost',
        () => NC.store.updateClip(clip.id, { muted: !clip.muted })
      )
    );

    /* transition */
    wrap.appendChild(sectionTitle(t('clip.transition')));
    const selTrans = el('select', 'tool-select');
    NC.engine.TRANSITIONS.forEach((tr) => {
      const o = el('option', null, tr);
      o.value = tr;
      if (clip.transition && clip.transition.type === tr) o.selected = true;
      selTrans.appendChild(o);
    });
    selTrans.addEventListener('change', () => {
      NC.store.updateClip(clip.id, { transition: { type: selTrans.value, duration: (clip.transition && clip.transition.duration) || 0.5 } });
    });
    wrap.appendChild(selTrans);
    if (clip.transition && clip.transition.type !== 'none') {
      wrap.appendChild(
        slider(
          t('text.duration') + ' ',
          0.2,
          2,
          0.1,
          clip.transition.duration || 0.5,
          (v) => NC.store.updateClip(clip.id, { transition: { duration: v } }, { skipSnapshot: true }),
          { format: (v) => v.toFixed(1) + 's' }
        )
      );
    }

    /* trim info */
    wrap.appendChild(sectionTitle(t('clip.trim')));
    const media = NC.store.getMedia(clip.mediaId);
    const info = el('div', 'tool-info');
    info.textContent =
      t('clip.startTrim') + ' ' + clip.trimStart.toFixed(1) + 's → ' + t('clip.endTrim') + ' ' + clip.trimEnd.toFixed(1) + 's' + (media && media.duration ? ' / ' + media.duration.toFixed(1) + 's' : '');
    wrap.appendChild(info);
    wrap.appendChild(el('div', 'tool-hint', '✂ ' + t('tool.edit') + ' — ' + t('timeline.label')));

    /* focal hint */
    wrap.appendChild(sectionTitle(t('clip.focal')));
    wrap.appendChild(el('div', 'tool-hint', t('clip.focalHint')));
    wrap.appendChild(
      slider('X ', 0, 1, 0.01, clip.focal ? clip.focal.x : 0.5, (v) =>
        NC.store.updateClip(clip.id, { focal: { x: v } }, { skipSnapshot: true })
      )
    );
    wrap.appendChild(
      slider('Y ', 0, 1, 0.01, clip.focal ? clip.focal.y : 0.5, (v) =>
        NC.store.updateClip(clip.id, { focal: { y: v } }, { skipSnapshot: true })
      )
    );

    /* actions */
    const actions = el('div', 'tool-actions');
    actions.appendChild(button('◀ ' + t('clip.moveLeft'), 'btn-ghost', () => {
      const idx = NC.store.state.project.clips.findIndex((c) => c.id === clip.id);
      NC.store.moveClip(clip.id, idx - 1);
    }));
    actions.appendChild(button(t('clip.moveRight') + ' ▶', 'btn-ghost', () => {
      const idx = NC.store.state.project.clips.findIndex((c) => c.id === clip.id);
      NC.store.moveClip(clip.id, idx + 1);
    }));
    actions.appendChild(button('⧉ ' + t('transport.duplicate'), 'btn-ghost', () => {
      NC.store.duplicateClip(clip.id);
      NC.app.toast(t('toast.copied'));
    }));
    actions.appendChild(button('🗑 ' + t('transport.delete'), 'btn-danger', () => {
      NC.store.removeClip(clip.id);
      NC.app.toast(t('toast.deleted'));
    }));
    wrap.appendChild(actions);
    return wrap;
  }

  /* ================= FILTERS ================= */
  function renderFilters() {
    const wrap = el('div', 'tool-body');
    const sel = selected();
    const clip = sel && sel.kind === 'clip' ? sel.item : null;
    if (!clip) {
      wrap.appendChild(el('div', 'tool-empty', t('empty.timeline')));
      return wrap;
    }
    wrap.appendChild(sectionTitle(t('tool.filters')));
    const grid = el('div', 'filter-grid');
    const presetIds = ['none', 'vivid', 'warm', 'cool', 'cinematic', 'vintage', 'bw', 'sepia', 'dramatic', 'film', 'pink', 'mono'];
    presetIds.forEach((id) => {
      const cell = el('div', 'filter-cell' + (clip.filterId === id ? ' active' : ''));
      const thumb = el('div', 'filter-thumb');
      const media = NC.store.getMedia(clip.mediaId);
      if (media && media.thumb) {
        thumb.style.backgroundImage = 'url(' + media.thumb + ')';
      }
      if (id !== 'none' && NC.engine.FILTERS[id]) {
        thumb.style.filter = NC.engine.FILTERS[id];
      }
      cell.appendChild(thumb);
      cell.appendChild(el('span', null, t('filter.' + id)));
      cell.addEventListener('click', () => {
        NC.store.updateClip(clip.id, { filterId: id });
      });
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  /* ================= ADJUST ================= */
  function renderAdjust() {
    const wrap = el('div', 'tool-body');
    const sel = selected();
    const clip = sel && sel.kind === 'clip' ? sel.item : null;
    if (!clip) {
      wrap.appendChild(el('div', 'tool-empty', t('empty.timeline')));
      return wrap;
    }
    const a = clip.adjust || NC.store.DEFAULT_ADJUST;
    wrap.appendChild(sectionTitle(t('tool.adjust')));
    wrap.appendChild(
      slider(t('adjust.brightness') + ' ', 0.3, 2, 0.01, a.brightness != null ? a.brightness : 1, (v) =>
        NC.store.updateClip(clip.id, { adjust: { brightness: v } }, { skipSnapshot: true }), { format: (v) => v.toFixed(2) })
    );
    wrap.appendChild(
      slider(t('adjust.contrast') + ' ', 0.3, 2, 0.01, a.contrast != null ? a.contrast : 1, (v) =>
        NC.store.updateClip(clip.id, { adjust: { contrast: v } }, { skipSnapshot: true }), { format: (v) => v.toFixed(2) })
    );
    wrap.appendChild(
      slider(t('adjust.saturation') + ' ', 0, 2.5, 0.01, a.saturation != null ? a.saturation : 1, (v) =>
        NC.store.updateClip(clip.id, { adjust: { saturation: v } }, { skipSnapshot: true }), { format: (v) => v.toFixed(2) })
    );
    wrap.appendChild(
      slider(t('adjust.hue') + ' ', -180, 180, 1, a.hue || 0, (v) =>
        NC.store.updateClip(clip.id, { adjust: { hue: v } }, { skipSnapshot: true }), { format: (v) => v + '°' })
    );
    wrap.appendChild(
      slider(t('adjust.temperature') + ' ', -1, 1, 0.01, a.temperature || 0, (v) =>
        NC.store.updateClip(clip.id, { adjust: { temperature: v } }, { skipSnapshot: true }), { format: (v) => v.toFixed(2) })
    );
    wrap.appendChild(
      slider(t('adjust.vignette') + ' ', 0, 1, 0.01, a.vignette || 0, (v) =>
        NC.store.updateClip(clip.id, { adjust: { vignette: v } }, { skipSnapshot: true }), { format: (v) => v.toFixed(2) })
    );
    wrap.appendChild(
      slider(t('adjust.grain') + ' ', 0, 1, 0.01, a.grain || 0, (v) =>
        NC.store.updateClip(clip.id, { adjust: { grain: v } }, { skipSnapshot: true }), { format: (v) => v.toFixed(2) })
    );
    const actions = el('div', 'tool-actions');
    actions.appendChild(button('↺ ' + t('adjust.reset'), 'btn-ghost', () => {
      NC.store.updateClip(clip.id, { adjust: Object.assign({}, NC.store.DEFAULT_ADJUST) });
    }));
    actions.appendChild(button(t('adjust.applyAll'), 'btn-ghost', () => {
      NC.store.snapshot();
      NC.store.state.project.clips.forEach((c) => {
        c.adjust = Object.assign({}, clip.adjust);
        c.filterId = clip.filterId;
      });
      NC.store.saveSoon();
      NC.store.emit('change');
    }));
    wrap.appendChild(actions);
    return wrap;
  }

  /* ================= TEXT ================= */
  function renderText() {
    const wrap = el('div', 'tool-body');
    const sel = selected();
    const item = sel && sel.kind === 'text' ? sel.item : null;

    wrap.appendChild(sectionTitle(t('tool.text')));
    wrap.appendChild(button('＋ ' + t('text.add'), 'btn-primary', () => {
      NC.store.addText(t('text.placeholder'));
    }));

    /* list */
    const list = el('div', 'tool-list');
    NC.store.state.project.texts.forEach((tx) => {
      const row = el('div', 'tool-list-item' + (item && item.id === tx.id ? ' active' : ''));
      row.textContent = 'T ' + String(tx.content || '').slice(0, 22);
      row.addEventListener('click', () => {
        NC.store.select('text', tx.id);
      });
      list.appendChild(row);
    });
    if (NC.store.state.project.texts.length) wrap.appendChild(list);

    if (!item) return wrap;

    wrap.appendChild(el('div', 'tool-hint', t('text.hint')));

    /* content */
    const ta = el('textarea', 'tool-textarea');
    ta.value = item.content || '';
    ta.placeholder = t('text.placeholder');
    ta.addEventListener('input', () => {
      NC.store.updateText(item.id, { content: ta.value }, { skipSnapshot: true });
    });
    ta.addEventListener('change', () => NC.store.saveSoon());
    wrap.appendChild(ta);

    /* style grid */
    const grid = el('div', 'tool-grid2');
    /* font */
    const fontSel = el('select', 'tool-select');
    ['sans', 'serif', 'mono', 'rounded'].forEach((f) => {
      const o = el('option', null, f);
      o.value = f;
      if ((item.style.font || 'sans') === f) o.selected = true;
      fontSel.appendChild(o);
    });
    fontSel.addEventListener('change', () => NC.store.updateText(item.id, { style: { font: fontSel.value } }));
    grid.appendChild(wrapField(t('text.font'), fontSel));
    /* align */
    const alignSel = el('select', 'tool-select');
    ['left', 'center', 'right'].forEach((f) => {
      const o = el('option', null, f);
      o.value = f;
      if ((item.style.align || 'center') === f) o.selected = true;
      alignSel.appendChild(o);
    });
    alignSel.addEventListener('change', () => NC.store.updateText(item.id, { style: { align: alignSel.value } }));
    grid.appendChild(wrapField(t('text.align'), alignSel));
    /* color */
    const color = el('input', 'tool-color');
    color.type = 'color';
    color.value = item.style.color || '#ffffff';
    color.addEventListener('input', () => NC.store.updateText(item.id, { style: { color: color.value } }, { skipSnapshot: true }));
    grid.appendChild(wrapField(t('text.color'), color));
    /* stroke color */
    const scolor = el('input', 'tool-color');
    scolor.type = 'color';
    scolor.value = item.style.strokeColor || '#000000';
    scolor.addEventListener('input', () => NC.store.updateText(item.id, { style: { strokeColor: scolor.value } }, { skipSnapshot: true }));
    grid.appendChild(wrapField(t('text.stroke'), scolor));
    wrap.appendChild(grid);

    wrap.appendChild(
      slider(t('text.size') + ' ', 12, 120, 1, item.style.size || 42, (v) =>
        NC.store.updateText(item.id, { style: { size: v } }, { skipSnapshot: true })
      )
    );
    wrap.appendChild(
      slider(t('text.stroke') + ' ', 0, 10, 0.5, item.style.stroke || 0, (v) =>
        NC.store.updateText(item.id, { style: { stroke: v } }, { skipSnapshot: true })
      )
    );

    /* toggles */
    const toggles = el('div', 'tool-toggles');
    toggles.appendChild(toggleBtn(t('text.bold'), !!item.style.bold, (v) => NC.store.updateText(item.id, { style: { bold: v } })));
    toggles.appendChild(toggleBtn(t('text.italic'), !!item.style.italic, (v) => NC.store.updateText(item.id, { style: { italic: v } })));
    toggles.appendChild(toggleBtn(t('text.shadow'), item.style.shadow !== false, (v) => NC.store.updateText(item.id, { style: { shadow: v } })));
    wrap.appendChild(toggles);

    /* animation */
    wrap.appendChild(sectionTitle(t('text.animation')));
    const animSel = el('select', 'tool-select');
    ['none', 'fade', 'slide', 'pop'].forEach((f) => {
      const o = el('option', null, t('text.anim.' + f));
      o.value = f;
      if ((item.anim || 'none') === f) o.selected = true;
      animSel.appendChild(o);
    });
    animSel.addEventListener('change', () => NC.store.updateText(item.id, { anim: animSel.value }));
    wrap.appendChild(animSel);

    /* timing */
    wrap.appendChild(sectionTitle(t('text.duration')));
    const total = NC.store.totalDuration();
    wrap.appendChild(
      slider('Start ', 0, Math.max(total, 0.1), 0.1, item.start || 0, (v) => {
        const end = Math.max(item.end, v + 0.2);
        NC.store.updateText(item.id, { start: v, end }, { skipSnapshot: true });
      }, { format: (v) => v.toFixed(1) + 's' })
    );
    wrap.appendChild(
      slider('End ', 0, Math.max(total, 0.1), 0.1, item.end || 0, (v) => {
        const start = Math.min(item.start, v - 0.2);
        NC.store.updateText(item.id, { start, end: v }, { skipSnapshot: true });
      }, { format: (v) => v.toFixed(1) + 's' })
    );

    const actions = el('div', 'tool-actions');
    actions.appendChild(button('🗑 ' + t('transport.delete'), 'btn-danger', () => {
      NC.store.removeItem('text', item.id);
    }));
    wrap.appendChild(actions);
    return wrap;
  }

  /* ================= STICKERS ================= */
  const EMOJIS = [
    '😀', '😂', '😍', '🥳', '😎', '🤩', '😢', '😡', '🤯', '😴',
    '❤️', '🔥', '⭐', '✨', '💯', '🎉', '🎈', '🌈', '☀️', '🌙',
    '👍', '👏', '🙏', '💪', '✌️', '🤞', '👀', '🤯', '💐', '🎁',
    '🎬', '🎵', '🎤', '🎧', '📸', '⚡', '💰', '🏆', '⚽', '🏏',
    '🌸', '❄️', '🍕', '☕', '🚗', '✈️', '🏝️', '📌', '✅', '❌',
  ];

  function renderStickers() {
    const wrap = el('div', 'tool-body');
    const sel = selected();
    const item = sel && sel.kind === 'sticker' ? sel.item : null;

    wrap.appendChild(sectionTitle(t('tool.stickers')));
    const grid = el('div', 'emoji-grid');
    EMOJIS.forEach((em) => {
      const cell = el('div', 'emoji-cell', em);
      cell.addEventListener('click', () => {
        if (item) NC.store.updateSticker(item.id, { emoji: em });
        else NC.store.addSticker(em);
      });
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);

    if (!item) return wrap;
    wrap.appendChild(el('div', 'tool-hint', t('text.hint')));
    wrap.appendChild(
      slider(t('text.size') + ' ', 0.3, 4, 0.05, item.scale || 1, (v) =>
        NC.store.updateSticker(item.id, { scale: v }, { skipSnapshot: true })
      )
    );
    wrap.appendChild(
      slider('↻ ', -180, 180, 1, item.rot || 0, (v) =>
        NC.store.updateSticker(item.id, { rot: v }, { skipSnapshot: true }), { format: (v) => v + '°' })
    );
    const total = NC.store.totalDuration();
    wrap.appendChild(
      slider('Start ', 0, Math.max(total, 0.1), 0.1, item.start || 0, (v) => {
        const end = Math.max(item.end, v + 0.2);
        NC.store.updateSticker(item.id, { start: v, end }, { skipSnapshot: true });
      }, { format: (v) => v.toFixed(1) + 's' })
    );
    wrap.appendChild(
      slider('End ', 0, Math.max(total, 0.1), 0.1, item.end || 0, (v) => {
        const start = Math.min(item.start, v - 0.2);
        NC.store.updateSticker(item.id, { start, end: v }, { skipSnapshot: true });
      }, { format: (v) => v.toFixed(1) + 's' })
    );
    const actions = el('div', 'tool-actions');
    actions.appendChild(button('🗑 ' + t('transport.delete'), 'btn-danger', () => {
      NC.store.removeItem('sticker', item.id);
    }));
    wrap.appendChild(actions);
    return wrap;
  }

  /* ================= AUDIO ================= */
  function renderAudio() {
    const wrap = el('div', 'tool-body');
    const sel = selected();
    const item = sel && sel.kind === 'audio' ? sel.item : null;

    wrap.appendChild(sectionTitle(t('tool.audio')));
    wrap.appendChild(button('＋ ' + t('audio.import'), 'btn-primary', () => NC.app.pickAudio()));

    /* list of imported audio media */
    const mediaList = el('div', 'tool-list');
    let hasAudio = false;
    NC.store.state && null; // no-op
    // iterate media via store list
    NC.store.listMediaByKind &&
      NC.store.listMediaByKind('audio').forEach((m) => {
        hasAudio = true;
        const row = el('div', 'tool-list-item');
        row.textContent = '♪ ' + m.name;
        row.addEventListener('click', () => {
          NC.store.addAudioFromMedia(m.id);
          NC.app.toast(t('toast.mediaAdded'));
        });
        mediaList.appendChild(row);
      });
    if (!hasAudio) wrap.appendChild(el('div', 'tool-hint', t('audio.noAudio')));
    else wrap.appendChild(mediaList);

    /* selected audio params */
    if (item) {
      wrap.appendChild(sectionTitle(esc(item.name || 'audio')));
      wrap.appendChild(
        slider(t('clip.volume') + ' ', 0, 1, 0.01, item.volume != null ? item.volume : 1, (v) =>
          NC.store.updateAudio(item.id, { volume: v }, { skipSnapshot: true }), { format: (v) => Math.round(v * 100) + '%' })
      );
      const total = NC.store.totalDuration();
      wrap.appendChild(
        slider(t('audio.fadeIn') + ' ', 0, 5, 0.1, item.fadeIn || 0, (v) =>
          NC.store.updateAudio(item.id, { fadeIn: v }, { skipSnapshot: true }), { format: (v) => v.toFixed(1) + 's' })
      );
      wrap.appendChild(
        slider(t('audio.fadeOut') + ' ', 0, 5, 0.1, item.fadeOut || 0, (v) =>
          NC.store.updateAudio(item.id, { fadeOut: v }, { skipSnapshot: true }), { format: (v) => v.toFixed(1) + 's' })
      );
      wrap.appendChild(
        slider('Start ', 0, Math.max(total, 0.1), 0.1, item.start || 0, (v) => {
          const end = Math.max(item.end, v + 0.2);
          NC.store.updateAudio(item.id, { start: v, end }, { skipSnapshot: true });
        }, { format: (v) => v.toFixed(1) + 's' })
      );
      wrap.appendChild(
        slider('End ', 0, Math.max(total + 10, 0.1), 0.1, item.end || 0, (v) => {
          const start = Math.min(item.start, v - 0.2);
          NC.store.updateAudio(item.id, { start, end: v }, { skipSnapshot: true });
        }, { format: (v) => v.toFixed(1) + 's' })
      );
      const actions = el('div', 'tool-actions');
      actions.appendChild(button('🗑 ' + t('transport.delete'), 'btn-danger', () => {
        NC.store.removeItem('audio', item.id);
      }));
      wrap.appendChild(actions);
    }
    return wrap;
  }

  /* ================= AI ================= */
  function renderAi() {
    const wrap = el('div', 'tool-body');
    wrap.appendChild(sectionTitle(t('ai.title')));

    wrap.appendChild(aiCard('✨', t('ai.enhance'), t('ai.enhanceDesc'), () => NC.ai.autoEnhance()));
    wrap.appendChild(aiCard('🎬', t('ai.sceneCut'), t('ai.sceneCutDesc'), () => NC.ai.smartSceneCut()));
    wrap.appendChild(aiCard('💬', t('ai.caption'), t('ai.captionDesc'), () => NC.ai.autoCaption()));
    wrap.appendChild(aiCard('📐', t('ai.reframe'), t('ai.reframeDesc'), () => NC.ai.autoReframe()));
    wrap.appendChild(aiCard('🔊', t('ai.autoVolume'), t('ai.autoVolumeDesc'), () => NC.ai.autoVolume()));

    const status = el('div', 'ai-status');
    status.id = 'ai-status';
    wrap.appendChild(status);
    return wrap;
  }

  function aiCard(icon, title, desc, onClick) {
    const card = el('div', 'ai-card');
    const ic = el('div', 'ai-card-ic', icon);
    const tx = el('div', 'ai-card-tx');
    tx.appendChild(el('b', null, title));
    tx.appendChild(el('span', null, desc));
    card.appendChild(ic);
    card.appendChild(tx);
    card.addEventListener('click', onClick);
    return card;
  }

  /* ================= ASPECT ================= */
  function renderAspect() {
    const wrap = el('div', 'tool-body');
    wrap.appendChild(sectionTitle(t('aspect.ratio')));
    const grid = el('div', 'aspect-grid');
    const project = NC.store.state.project;
    Object.keys(NC.engine.ASPECTS).forEach((key) => {
      const a = NC.engine.ASPECTS[key];
      const cell = el('div', 'aspect-cell' + (project.aspect === key ? ' active' : ''));
      const box = el('div', 'aspect-box');
      box.style.aspectRatio = a.w + '/' + a.h;
      cell.appendChild(box);
      cell.appendChild(el('span', null, t(a.label)));
      cell.addEventListener('click', () => {
        NC.store.snapshot();
        project.aspect = key;
        NC.engine.computePreviewSize();
        NC.store.saveSoon();
        NC.store.emit('change');
      });
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);

    wrap.appendChild(sectionTitle(t('settings.masterVolume')));
    wrap.appendChild(
      slider(t('settings.masterVolume') + ' ', 0, 1, 0.01, project.masterVolume != null ? project.masterVolume : 1, (v) => {
        project.masterVolume = v;
        NC.engine.setMasterVolume(v);
        NC.store.saveSoon();
      }, { format: (v) => Math.round(v * 100) + '%' })
    );
    return wrap;
  }

  /* ---------- small helpers ---------- */
  function wrapField(label, control) {
    const f = el('div', 'tool-field');
    f.appendChild(el('label', null, label));
    f.appendChild(control);
    return f;
  }

  function toggleBtn(label, active, onToggle) {
    const b = el('button', 'btn btn-toggle' + (active ? ' active' : ''), label);
    b.addEventListener('click', () => {
      b.classList.toggle('active');
      onToggle(b.classList.contains('active'));
    });
    return b;
  }

  /* ---------- panel control ---------- */
  const RENDERERS = {
    edit: renderEdit,
    filters: renderFilters,
    adjust: renderAdjust,
    text: renderText,
    stickers: renderStickers,
    audio: renderAudio,
    ai: renderAi,
    aspect: renderAspect,
  };

  function openTool(name) {
    if (!panelEl) return;
    NC.store.state.tool = name;
    const titleKey = {
      edit: 'tool.edit',
      filters: 'tool.filters',
      adjust: 'tool.adjust',
      text: 'tool.text',
      stickers: 'tool.stickers',
      audio: 'tool.audio',
      ai: 'tool.ai',
      aspect: 'tool.aspect',
    }[name];
    panelEl.innerHTML = '';
    const head = el('div', 'tool-head');
    head.appendChild(el('h3', null, t(titleKey || 'tool.edit')));
    const closeBtn = el('button', 'tool-close', '✕');
    closeBtn.addEventListener('click', () => {
      panelEl.classList.remove('open');
    });
    head.appendChild(closeBtn);
    panelEl.appendChild(head);
    const body = (RENDERERS[name] || renderEdit)();
    panelEl.appendChild(body);
    panelEl.classList.add('open');

    /* update active tab */
    document.querySelectorAll('.tool-tab').forEach((tabEl) => {
      tabEl.classList.toggle('active', tabEl.dataset.tool === name);
    });
  }

  function refresh() {
    if (panelEl && panelEl.classList.contains('open')) {
      openTool(NC.store.state.tool || 'edit');
    }
  }

  function init(panel) {
    panelEl = panel;
    let lastSig = '';
    NC.store.on('change', () => {
      /* auto-refresh the panel only when the selection actually changed
         (keeps slider drags from being interrupted) */
      const sel = NC.store.getSelected();
      const sig = sel ? sel.kind + ':' + sel.item.id : 'none';
      if (sig !== lastSig && panelEl && panelEl.classList.contains('open')) {
        lastSig = sig;
        openTool(NC.store.state.tool || 'edit');
      }
      lastSig = sig;
    });
    NC.store.on('langchange', refresh);
  }

  NC.tools = {
    init,
    openTool,
    refresh,
  };
})();

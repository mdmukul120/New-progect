/* NovaCut — app bootstrap & UI wiring */
(function () {
  const NC = (window.NC = window.NC || {});
  const t = (k, p) => NC.i18n.t(k, p);

  /* ---------- toast ---------- */
  let toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ---------- file pickers ---------- */
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'video/*,image/*';
  fileInput.multiple = true;
  fileInput.style.display = 'none';

  const audioInput = document.createElement('input');
  audioInput.type = 'file';
  audioInput.accept = 'audio/*';
  audioInput.multiple = true;
  audioInput.style.display = 'none';

  function pickMedia() {
    fileInput.value = '';
    fileInput.click();
  }
  function pickAudio() {
    audioInput.value = '';
    audioInput.click();
  }

  async function handleFiles(files, expectKind) {
    for (const file of files) {
      try {
        const rec = await NC.store.addMedia(file);
        if (expectKind === 'audio' || rec.kind === 'audio') {
          if (rec.kind === 'audio') NC.store.addAudioFromMedia(rec.id);
        } else {
          NC.store.addClipFromMedia(rec.id);
        }
        toast(t('toast.mediaAdded'));
      } catch (e) {
        console.warn(e);
        toast(t('error.unsupported') + ': ' + file.name);
      }
    }
    NC.tools.refresh();
  }

  /* ---------- dialogs ---------- */
  function openDialog(contentBuilder, opts) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'dialog' + (opts && opts.wide ? ' wide' : '');
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    contentBuilder(dialog, () => overlay.remove());
    return overlay;
  }

  function openExportDialog() {
    if (NC.exporter.isExporting()) return;
    openDialog((dialog, close) => {
      dialog.innerHTML =
        '<h2>' + t('export.title') + '</h2>' +
        '<div class="dialog-body">' +
        '<div class="tool-field"><label>' + t('export.resolution') + '</label>' +
        '<select class="tool-select" id="exp-res">' +
        '<option value="480">480p</option><option value="720" selected>720p (HD)</option><option value="1080">1080p (Full HD)</option>' +
        '</select></div>' +
        '<div class="tool-field"><label>' + t('export.quality') + '</label>' +
        '<select class="tool-select" id="exp-q">' +
        '<option value="high">' + t('quality.high') + '</option><option value="medium">' + t('quality.medium') + '</option><option value="low">' + t('quality.low') + '</option>' +
        '</select></div>' +
        '<div class="tool-field"><label>' + t('export.fps') + '</label>' +
        '<select class="tool-select" id="exp-fps">' +
        '<option value="24">24</option><option value="30" selected>30</option><option value="60">60</option>' +
        '</select></div>' +
        '<div class="exp-progress-wrap"><div class="exp-progress"><i id="exp-bar"></i></div><div class="exp-status" id="exp-status"></div></div>' +
        '<div class="tool-hint">' + t('export.note') + '</div>' +
        '</div>' +
        '<div class="dialog-actions">' +
        '<button class="btn btn-ghost" id="exp-cancel">' + t('dialog.cancel') + '</button>' +
        '<button class="btn btn-primary" id="exp-start">' + t('export.start') + '</button>' +
        '</div>';

      const bar = dialog.querySelector('#exp-bar');
      const statusEl = dialog.querySelector('#exp-status');
      let started = false;

      dialog.querySelector('#exp-cancel').addEventListener('click', () => {
        if (started) NC.exporter.cancel();
        close();
      });

      dialog.querySelector('#exp-start').addEventListener('click', async () => {
        if (started) return;
        started = true;
        const res = dialog.querySelector('#exp-res').value;
        const quality = dialog.querySelector('#exp-q').value;
        const fps = parseInt(dialog.querySelector('#exp-fps').value, 10) || 30;
        dialog.querySelector('#exp-start').disabled = true;
        toast(t('toast.exportStarted'));

        NC.exporter.onProgress((ev) => {
          if (ev.type === 'progress') {
            bar.style.width = Math.round(ev.value * 100) + '%';
            statusEl.textContent = ev.message + ' ' + Math.round(ev.value * 100) + '%';
          } else if (ev.type === 'status') {
            statusEl.textContent = ev.message;
          } else if (ev.type === 'done') {
            bar.style.width = '100%';
            statusEl.textContent = t('export.done');
            const a = document.createElement('a');
            a.href = ev.url;
            a.download = ev.fileName;
            a.className = 'btn btn-primary exp-download';
            a.textContent = '⬇ ' + t('export.download') + ' (' + (ev.size / 1048576).toFixed(1) + ' MB)';
            statusEl.appendChild(document.createElement('br'));
            statusEl.appendChild(a);
            started = false;
            dialog.querySelector('#exp-start').disabled = false;
          } else if (ev.type === 'error') {
            statusEl.textContent = t('export.error') + ' — ' + (ev.message || '');
            started = false;
            dialog.querySelector('#exp-start').disabled = false;
          }
        });

        await NC.exporter.start({ resolution: res, quality, fps });
      });
    });
  }

  function openProjectsDialog() {
    openDialog(async (dialog, close) => {
      dialog.innerHTML = '<h2>' + t('projects.title') + '</h2><div class="dialog-body" id="proj-list"></div>' +
        '<div class="dialog-actions"><button class="btn btn-ghost" id="proj-close">' + t('dialog.close') + '</button>' +
        '<button class="btn btn-primary" id="proj-new">＋ ' + t('top.new') + '</button></div>';
      dialog.querySelector('#proj-close').addEventListener('click', close);
      dialog.querySelector('#proj-new').addEventListener('click', () => {
        close();
        openNewProjectDialog();
      });
      const list = dialog.querySelector('#proj-list');
      const projects = await NC.store.listProjects();
      if (!projects.length) {
        list.innerHTML = '<div class="tool-empty">' + t('projects.empty') + '</div>';
        return;
      }
      projects.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'proj-row';
        const date = new Date(p.updatedAt || Date.now());
        row.innerHTML =
          '<div class="proj-info"><b>' + esc(p.name || t('top.untitled')) + '</b><span>' +
          t('projects.updated') + ': ' + date.toLocaleString() + '</span></div>' +
          '<div class="proj-btns"><button class="btn btn-primary btn-sm" data-act="open">' + t('projects.open') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="del">🗑</button></div>';
        row.querySelector('[data-act="open"]').addEventListener('click', async () => {
          await NC.store.loadProject(p.id);
          NC.engine.computePreviewSize();
          NC.engine.seek(0);
          close();
          toast(t('projects.open'));
        });
        row.querySelector('[data-act="del"]').addEventListener('click', async () => {
          if (confirm(t('dialog.confirmDelete'))) {
            await NC.store.deleteProject(p.id);
            row.remove();
            toast(t('toast.deleted'));
          }
        });
        list.appendChild(row);
      });
    }, { wide: true });
  }

  function openNewProjectDialog() {
    openDialog((dialog, close) => {
      dialog.innerHTML =
        '<h2>' + t('dialog.newTitle') + '</h2>' +
        '<div class="dialog-body"><div class="tool-field"><label>' + t('dialog.name') + '</label>' +
        '<input class="tool-input" id="np-name" value="' + esc(t('top.untitled')) + '"></div></div>' +
        '<div class="dialog-actions"><button class="btn btn-ghost" id="np-cancel">' + t('dialog.cancel') + '</button>' +
        '<button class="btn btn-primary" id="np-create">' + t('dialog.create') + '</button></div>';
      dialog.querySelector('#np-cancel').addEventListener('click', close);
      dialog.querySelector('#np-create').addEventListener('click', () => {
        const name = dialog.querySelector('#np-name').value.trim() || t('top.untitled');
        NC.store.createProject(name);
        NC.engine.computePreviewSize();
        NC.engine.seek(0);
        close();
        toast(t('dialog.create') + ' ✓');
      });
    });
  }

  function openSettingsDialog() {
    openDialog((dialog, close) => {
      dialog.innerHTML =
        '<h2>' + t('top.settings') + '</h2>' +
        '<div class="dialog-body">' +
        '<div class="tool-field"><label>' + t('settings.language') + '</label>' +
        '<div class="lang-pick">' +
        '<button class="btn btn-toggle' + (NC.i18n.getLang() === 'bn' ? ' active' : '') + '" data-lang="bn">বাংলা</button>' +
        '<button class="btn btn-toggle' + (NC.i18n.getLang() === 'en' ? ' active' : '') + '" data-lang="en">English</button>' +
        '</div></div>' +
        '<div class="tool-field"><label>' + t('shortcuts.title') + '</label>' +
        '<div class="tool-hint">⌨ ' + t('shortcuts.play') + '<br>⌨ ' + t('shortcuts.split') + '<br>⌨ ' + t('shortcuts.delete') +
        '<br>⌨ ' + t('shortcuts.undo') + '<br>⌨ ' + t('shortcuts.redo') + '</div></div>' +
        '<div class="tool-field"><label>' + t('about.title') + '</label><div class="tool-hint">' + t('about.text') + '</div></div>' +
        '</div>' +
        '<div class="dialog-actions"><button class="btn btn-primary" id="set-close">' + t('dialog.close') + '</button></div>';
      dialog.querySelector('#set-close').addEventListener('click', close);
      dialog.querySelectorAll('[data-lang]').forEach((b) => {
        b.addEventListener('click', () => {
          NC.i18n.setLang(b.dataset.lang);
          close();
          toast(t('toast.copiedLang'));
        });
      });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ---------- transport ---------- */
  function updateTransport() {
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      const playing = NC.engine.isPlaying();
      playBtn.textContent = playing ? '⏸' : '▶';
      playBtn.title = playing ? t('transport.pause') : t('transport.play');
    }
  }

  /* ---------- keyboard ---------- */
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') {
        e.preventDefault();
        NC.engine.togglePlay();
      } else if (e.key === 's' || e.key === 'S') {
        NC.store.splitClipAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = NC.store.getSelected();
        if (sel) {
          if (sel.kind === 'clip') NC.store.removeClip(sel.item.id);
          else NC.store.removeItem(sel.kind, sel.item.id);
          toast(t('toast.deleted'));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        NC.store.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        NC.store.redo();
      }
    });
  }

  /* ---------- init ---------- */
  async function init() {
    /* mount hidden inputs */
    document.body.appendChild(fileInput);
    document.body.appendChild(audioInput);
    fileInput.addEventListener('change', () => handleFiles([...fileInput.files], 'media'));
    audioInput.addEventListener('change', () => handleFiles([...audioInput.files], 'audio'));

    /* engine + timeline + tools */
    NC.engine.init(document.getElementById('preview-canvas'));
    NC.timeline.init(document.getElementById('timeline'));
    NC.tools.init(document.getElementById('tool-panel'));

    /* top bar */
    document.getElementById('btn-projects').addEventListener('click', openProjectsDialog);
    document.getElementById('btn-new').addEventListener('click', openNewProjectDialog);
    document.getElementById('btn-undo').addEventListener('click', () => NC.store.undo());
    document.getElementById('btn-redo').addEventListener('click', () => NC.store.redo());
    document.getElementById('btn-export').addEventListener('click', openExportDialog);
    document.getElementById('btn-settings').addEventListener('click', openSettingsDialog);
    document.getElementById('btn-lang').addEventListener('click', () => {
      NC.i18n.toggle();
      toast(t('toast.copiedLang'));
    });

    /* transport */
    document.getElementById('btn-play').addEventListener('click', () => NC.engine.togglePlay());
    document.getElementById('btn-split').addEventListener('click', () => NC.store.splitClipAtPlayhead());
    document.getElementById('btn-start').addEventListener('click', () => NC.engine.seek(0));
    document.getElementById('btn-import').addEventListener('click', pickMedia);

    /* tool tabs */
    document.querySelectorAll('.tool-tab').forEach((tab) => {
      tab.addEventListener('click', () => NC.tools.openTool(tab.dataset.tool));
    });

    /* preview drag: move selected text/sticker */
    const canvas = document.getElementById('preview-canvas');
    let overlayDrag = null;
    canvas.addEventListener('pointerdown', (e) => {
      const sel = NC.store.getSelected();
      if (!sel || (sel.kind !== 'text' && sel.kind !== 'sticker')) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      overlayDrag = { item: sel.item, kind: sel.kind, moved: false };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!overlayDrag) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      overlayDrag.moved = true;
      overlayDrag.item.x = Math.max(0, Math.min(1, x));
      overlayDrag.item.y = Math.max(0, Math.min(1, y));
      NC.engine.requestRender();
    });
    canvas.addEventListener('pointerup', () => {
      if (overlayDrag && overlayDrag.moved) {
        NC.store.snapshot();
        NC.store.saveSoon();
        NC.store.emit('change');
      }
      overlayDrag = null;
    });

    /* store events */
    NC.store.on('toast', toast);
    NC.store.on('playstate', updateTransport);
    NC.store.on('history', () => {
      const u = document.getElementById('btn-undo');
      const r = document.getElementById('btn-redo');
      if (u) u.disabled = !NC.store.canUndo();
      if (r) r.disabled = !NC.store.canRedo();
    });
    NC.store.on('change', () => {
      const nameEl = document.getElementById('project-name');
      if (nameEl) nameEl.textContent = NC.store.state.project.name || t('top.untitled');
    });

    /* drag & drop */
    document.body.addEventListener('dragover', (e) => e.preventDefault());
    document.body.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFiles([...e.dataTransfer.files], 'media');
      }
    });

    bindKeys();

    /* store init (loads last project) */
    await NC.store.init();
    NC.i18n.applyToDom();
    NC.i18n.setLang(NC.i18n.getLang());
    updateTransport();
    NC.tools.openTool('edit');
    const nameEl = document.getElementById('project-name');
    if (nameEl) nameEl.textContent = NC.store.state.project.name || t('top.untitled');

    /* hide loader */
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 600);
    }
  }

  function refreshAll() {
    NC.tools.refresh();
    NC.timeline.refresh();
    const nameEl = document.getElementById('project-name');
    if (nameEl) nameEl.textContent = NC.store.state.project.name || t('top.untitled');
  }

  NC.app = {
    init,
    toast,
    pickMedia,
    pickAudio,
    openExportDialog,
    refreshAll,
  };

  document.addEventListener('DOMContentLoaded', init);
})();

'use client';

import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Props = { site: string; onChanged: () => Promise<void> | void };

function languageFor(file: string) {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  if (['html', 'htm'].includes(ext)) return html();
  if (ext === 'css') return css();
  if (['js', 'mjs', 'json', 'jsx'].includes(ext)) return javascript();
  if (['md', 'markdown'].includes(ext)) return markdown();
  return null;
}

function iconFor(file: string) {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  if (['html', 'htm'].includes(ext)) return '🌐';
  if (ext === 'css') return '🎨';
  if (['js', 'mjs', 'json'].includes(ext)) return '⚙️';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return '🖼';
  return '📄';
}

export default function Editor({ site, onChanged }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [binary, setBinary] = useState(false);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('');

  const dirty = text !== original;

  const loadFiles = useCallback(async () => {
    const res = await fetch(`/api/files?site=${encodeURIComponent(site)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    setFiles(data.files || []);
    return data.files as string[];
  }, [site]);

  const openFile = useCallback(
    async (path: string) => {
      setLoading(true);
      setMessage(null);
      const res = await fetch(
        `/api/files?site=${encodeURIComponent(site)}&file=${encodeURIComponent(path)}`,
        { cache: 'no-store' },
      );
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setMessage(data.error || 'ফাইল খোলা গেল না');
        return;
      }
      setCurrent(path);
      if (data.text === null) {
        setBinary(true);
        setText('');
        setOriginal('');
      } else {
        setBinary(false);
        setText(data.text);
        setOriginal(data.text);
      }
    },
    [site],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await loadFiles();
      if (!alive) return;
      const first =
        list.find((f) => f === 'index.html') ??
        list.find((f) => f.endsWith('/index.html')) ??
        list.find((f) => f.endsWith('.html')) ??
        list[0];
      if (first) openFile(first);
      else setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadFiles, openFile]);

  async function save() {
    if (!current || binary) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/files', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ site, file: current, content: text }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || 'সেভ ব্যর্থ');
      return;
    }
    setOriginal(text);
    setMessage('সেভ হয়েছে ✓');
    await onChanged();
    setTimeout(() => setMessage(null), 2000);
  }

  // Ctrl/Cmd + S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  async function removeFile(path: string) {
    if (!confirm(`"${path}" ফাইলটি মুছে ফেলবেন?`)) return;
    const res = await fetch(
      `/api/files?site=${encodeURIComponent(site)}&file=${encodeURIComponent(path)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMessage(d.error || 'ডিলিট ব্যর্থ');
      return;
    }
    const list = await loadFiles();
    await onChanged();
    if (current === path) {
      setCurrent(null);
      setText('');
      setOriginal('');
      if (list[0]) openFile(list[0]);
    }
  }

  async function createFile(e: React.FormEvent) {
    e.preventDefault();
    const path = newPath.trim().replace(/^\/+/, '');
    if (!path) return;
    const res = await fetch('/api/files', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ site, file: path, content: '' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || 'ফাইল বানানো গেল না');
      return;
    }
    setNewPath('');
    setCreating(false);
    await loadFiles();
    await onChanged();
    openFile(path);
  }

  async function renameFile(path: string) {
    const to = prompt('নতুন নাম / পাথ:', path);
    if (!to || to === path) return;
    const resGet = await fetch(
      `/api/files?site=${encodeURIComponent(site)}&file=${encodeURIComponent(path)}`,
      { cache: 'no-store' },
    );
    const data = await resGet.json().catch(() => ({}));
    if (data.text === null) {
      setMessage('বাইনারি ফাইল রিনেম এখান থেকে সম্ভব নয়');
      return;
    }
    const put = await fetch('/api/files', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ site, file: to, content: data.text }),
    });
    if (!put.ok) {
      setMessage('রিনেম ব্যর্থ');
      return;
    }
    await fetch(
      `/api/files?site=${encodeURIComponent(site)}&file=${encodeURIComponent(path)}`,
      { method: 'DELETE' },
    );
    await loadFiles();
    await onChanged();
    openFile(to);
  }

  const shown = useMemo(
    () => (filter ? files.filter((f) => f.toLowerCase().includes(filter.toLowerCase())) : files),
    [files, filter],
  );

  const extensions = useMemo(() => {
    if (!current) return [];
    const lang = languageFor(current);
    return lang ? [lang] : [];
  }, [current]);

  return (
    <div className="card overflow-hidden">
      {/* টুলবার */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-[#8b98a5]">ফাইল ম্যানেজার</span>
          {current && (
            <>
              <span className="text-[#3a4a5e]">/</span>
              <span className="truncate font-mono text-[#c8d3df]">{current}</span>
              {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffcf8a]" title="সেভ হয়নি" />}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-[#8b98a5]">{message}</span>}
          {current && !binary && (
            <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
              {saving ? 'সেভ হচ্ছে…' : 'সেভ (⌘S)'}
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[250px_1fr]">
        {/* ফাইল ট্রি */}
        <div className="border-b border-line md:border-b-0 md:border-r">
          <div className="border-b border-line p-2">
            <input
              className="input py-1.5 text-xs"
              placeholder="ফাইল খুঁজুন…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="max-h-[420px] overflow-auto p-1.5">
            {shown.length === 0 && (
              <p className="px-2 py-3 text-xs text-[#5b6b7d]">কোনো ফাইল নেই</p>
            )}
            {shown.map((f) => (
              <div
                key={f}
                className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${
                  current === f ? 'bg-[#16202d]' : 'hover:bg-[#121b26]'
                }`}
              >
                <button
                  onClick={() => openFile(f)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left font-mono text-[#c8d3df]"
                  title={f}
                >
                  <span>{iconFor(f)}</span>
                  <span className="truncate">{f}</span>
                </button>
                <button
                  onClick={() => renameFile(f)}
                  className="hidden px-1 text-[#5b6b7d] hover:text-[#e6edf3] group-hover:block"
                  title="রিনেম"
                >
                  ✎
                </button>
                <button
                  onClick={() => removeFile(f)}
                  className="hidden px-1 text-[#5b6b7d] hover:text-[#ff8a9b] group-hover:block"
                  title="ডিলিট"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-line p-2">
            {creating ? (
              <form onSubmit={createFile} className="flex gap-1">
                <input
                  autoFocus
                  className="input py-1.5 font-mono text-xs"
                  placeholder="about.html"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onBlur={() => !newPath && setCreating(false)}
                />
                <button className="btn-primary px-2 py-1 text-xs">+</button>
              </form>
            ) : (
              <button className="btn-ghost w-full py-1.5 text-xs" onClick={() => setCreating(true)}>
                + নতুন ফাইল
              </button>
            )}
          </div>
        </div>

        {/* কোড এরিয়া */}
        <div className="min-h-[420px] min-w-0">
          {loading && <p className="p-6 text-sm text-[#5b6b7d]">লোড হচ্ছে…</p>}
          {!loading && !current && (
            <p className="p-6 text-sm text-[#5b6b7d]">বাঁ দিক থেকে একটি ফাইল বেছে নিন।</p>
          )}
          {!loading && current && binary && (
            <div className="p-6 text-sm text-[#8b98a5]">
              এটি একটি বাইনারি ফাইল — এডিটর এখানে দেখানো হয় না।
              <div className="mt-3">
                <button className="btn-danger" onClick={() => removeFile(current)}>
                  ফাইল ডিলিট
                </button>
              </div>
            </div>
          )}
          {!loading && current && !binary && (
            <CodeMirror
              value={text}
              height="420px"
              theme={oneDark}
              extensions={extensions}
              onChange={(v) => setText(v)}
              basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: true }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

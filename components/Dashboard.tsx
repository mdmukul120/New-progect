'use client';

import { useMemo, useState } from 'react';
import type { Site } from '@/lib/store';
import Editor from './Editor';
import Uploader from './Uploader';

type Props = {
  initialSites: Site[];
  rootDomain: string;
  defaultSite: string;
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'এইমাত্র';
  if (m < 60) return `${m} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ঘণ্টা আগে`;
  const d = Math.floor(h / 24);
  return `${d} দিন আগে`;
}

export default function Dashboard({ initialSites, rootDomain, defaultSite }: Props) {
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [active, setActive] = useState<string | null>(initialSites[0]?.name ?? null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const activeSite = useMemo(() => sites.find((s) => s.name === active) ?? null, [sites, active]);

  async function refresh() {
    const res = await fetch('/api/sites', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setSites(data.sites);
    }
  }

  async function createSite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName.trim().toLowerCase() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'সাইট বানানো গেল না');
      return;
    }
    setNewName('');
    await refresh();
    setActive(data.site.name);
    setUploadOpen(true);
  }

  async function deleteSite(name: string) {
    if (!confirm(`"${name}" সাইটটি এবং এর সব ফাইল মুছে ফেলবেন?`)) return;
    setBusy(true);
    await fetch(`/api/sites?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
    setBusy(false);
    await refresh();
    if (active === name) setActive(null);
    setUploadOpen(false);
  }

  function liveUrl(name: string) {
    if (rootDomain) return `https://${name}.${rootDomain}`;
    if (defaultSite === name) return window.location.origin;
    return `${window.location.origin}/s${''}`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
      {/* সাইট লিস্ট */}
      <aside className="space-y-4">
        <form onSubmit={createSite} className="card p-4">
          <label className="label" htmlFor="site-name">
            নতুন সাইট
          </label>
          <div className="flex gap-2">
            <input
              id="site-name"
              className="input font-mono"
              placeholder="my-portfolio"
              value={newName}
              onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())}
              maxLength={40}
            />
            <button className="btn-primary px-3" disabled={busy || !newName}>
              +
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#5b6b7d]">
            ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন। এটি হবে আপনার সাবডোমেইন।
          </p>
          {error && <p className="mt-2 text-xs text-[#ff8a9b]">{error}</p>}
        </form>

        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#8b98a5]">
            সাইট ({sites.length})
          </div>
          {sites.length === 0 && (
            <p className="px-4 py-6 text-sm text-[#5b6b7d]">এখনো কোনো সাইট নেই। উপরে নাম দিয়ে বানান।</p>
          )}
          <ul>
            {sites.map((s) => (
              <li key={s.name}>
                <button
                  onClick={() => setActive(s.name)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors ${
                    active === s.name ? 'bg-[#16202d] text-[#e6edf3]' : 'text-[#c8d3df] hover:bg-[#121b26]'
                  }`}
                >
                  <span className="truncate font-mono">{s.name}</span>
                  <span className="shrink-0 text-[11px] text-[#5b6b7d]">{s.fileCount} ফাইল</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* মূল প্যানেল */}
      <section className="min-w-0 space-y-4">
        {!activeSite && (
          <div className="card grid place-items-center p-16 text-center">
            <div>
              <div className="text-3xl">🗂</div>
              <p className="mt-3 text-sm text-[#8b98a5]">
                বাঁ দিক থেকে একটি সাইট বেছে নিন, অথবা নতুন সাইট বানান।
              </p>
            </div>
          </div>
        )}

        {activeSite && (
          <>
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-mono text-lg font-semibold">{activeSite.name}</h2>
                  <p className="mt-1 text-xs text-[#8b98a5]">
                    {activeSite.fileCount} ফাইল · {fmtBytes(activeSite.bytes)} · আপডেট {timeAgo(activeSite.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => setUploadOpen(true)}>
                    জিপ / ফাইল আপলোড
                  </button>
                  {activeSite.indexFile && (
                    <a className="btn-ghost" href={liveUrl(activeSite.name)} target="_blank" rel="noreferrer">
                      লাইভ দেখুন ↗
                    </a>
                  )}
                  <button className="btn-danger" onClick={() => deleteSite(activeSite.name)}>
                    সাইট ডিলিট
                  </button>
                </div>
              </div>
              {!activeSite.indexFile && activeSite.fileCount > 0 && (
                <p className="mt-3 rounded-lg border border-[#3a2f1f] bg-[#241f13] px-3 py-2 text-xs text-[#ffcf8a]">
                  কোনো index.html পাওয়া যায়নি — সাইট খুললে 404 দেখাবে। ফাইল ম্যানেজার থেকে নতুন{' '}
                  <code>index.html</code> বানান।
                </p>
              )}
              {activeSite.fileCount === 0 && (
                <p className="mt-3 rounded-lg border border-line bg-[#0d141d] px-3 py-2 text-xs text-[#8b98a5]">
                  সাইট খালি। “জিপ / ফাইল আপলোড” চেপে HTML ফাইল বা জিপ দিন।
                </p>
              )}
            </div>

            <Editor site={activeSite.name} onChanged={refresh} />
          </>
        )}
      </section>

      {uploadOpen && activeSite && (
        <Uploader
          site={activeSite.name}
          onClose={() => setUploadOpen(false)}
          onDone={async () => {
            setUploadOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

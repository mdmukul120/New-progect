'use client';

import { unzipSync } from 'fflate';
import { useRef, useState } from 'react';

type Props = { site: string; onClose: () => void; onDone: () => void };

type Out = { path: string; content: string; encoding: 'utf8' | 'base64' };

const TEXT_EXT = [
  'html', 'htm', 'css', 'js', 'mjs', 'json', 'md', 'txt', 'svg', 'xml',
  'webmanifest', 'yml', 'yaml',
];
const MAX_FILE = 1 * 1024 * 1024;

function isText(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXT.includes(ext);
}

function toBase64(bytes: Uint8Array) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** jszip-এর মতো ফোল্ডার-র‍্যাপার বাদ দেওয়া: সব ফাইলের কমন প্রিফিক্স */
function stripCommonRoot(paths: string[]): string {
  if (paths.length < 2) return '';
  const first = paths[0].split('/');
  let common = '';
  for (let i = 0; i < first.length - 1; i++) {
    const seg = first[i];
    if (paths.every((p) => p.split('/')[i] === seg)) common += seg + '/';
    else break;
  }
  return common;
}

export default function Uploader({ site, onClose, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>('ফাইল বাছুন — জিপ ফাইলও চলবে');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    setSkipped([]);
    setProgress(5);

    try {
      const out: Out[] = [];
      const notes: string[] = [];

      for (const file of Array.from(list)) {
        const isZip =
          file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';

        if (!isZip) {
          if (file.size > MAX_FILE) {
            notes.push(`${file.name} — ১ MB-এর বেশি, বাদ`);
            continue;
          }
          const name = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          const path = name.replace(/\\/g, '/');
          if (isText(path)) {
            out.push({ path, content: await file.text(), encoding: 'utf8' });
          } else {
            const buf = new Uint8Array(await file.arrayBuffer());
            out.push({ path, content: toBase64(buf), encoding: 'base64' });
          }
          continue;
        }

        setStatus(`${file.name} খোলা হচ্ছে…`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        setProgress(20);
        const entries = unzipSync(bytes, {
          filter: (f) => !f.name.endsWith('/') && !f.name.startsWith('__MACOSX/') && !f.name.includes('/__MACOSX/'),
        });
        setProgress(45);

        const paths = Object.keys(entries);
        const strip = stripCommonRoot(paths);

        for (const [rawPath, data] of Object.entries(entries)) {
          const p = strip && rawPath.startsWith(strip) ? rawPath.slice(strip.length) : rawPath;
          if (!p) continue;
          const base = p.split('/').pop() || p;
          if (base.startsWith('.')) continue; // .DS_Store ইত্যাদি
          if (data.byteLength > MAX_FILE) {
            notes.push(`${p} — ১ MB-এর বেশি, বাদ`);
            continue;
          }
          if (isText(p)) {
            out.push({ path: p, content: new TextDecoder().decode(data), encoding: 'utf8' });
          } else {
            out.push({ path: p, content: toBase64(data), encoding: 'base64' });
          }
        }
      }

      if (!out.length) {
        setStatus('কোনো ব্যবহারযোগ্য ফাইল পাওয়া যায়নি');
        setSkipped(notes);
        setBusy(false);
        return;
      }

      setStatus(`${out.length}টি ফাইল আপলোড হচ্ছে…`);
      setProgress(60);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ site, files: out, replace: true }),
      });
      const data = await res.json().catch(() => ({}));
      setProgress(100);

      if (!res.ok) {
        setStatus(data.error || 'আপলোড ব্যর্থ');
        setBusy(false);
        return;
      }

      const sk = (data.skipped || []).map((s: { path: string; reason: string }) => `${s.path} — ${s.reason}`);
      setSkipped([...notes, ...sk]);
      setStatus(`✅ ${data.count}টি ফাইল আপলোড হয়েছে`);
      setTimeout(onDone, 900);
    } catch (e) {
      setStatus(`ত্রুটি: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="card w-full max-w-lg p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">ফাইল আপলোড</h3>
            <p className="mt-1 text-xs text-[#8b98a5]">
              সাইট <span className="font-mono text-[#c8d3df]">{site}</span> — আগের ফাইলগুলো প্রতিস্থাপিত হবে
            </p>
          </div>
          <button onClick={onClose} className="text-[#8b98a5] hover:text-[#e6edf3]" disabled={busy}>
            ✕
          </button>
        </div>

        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) handleFiles(e.dataTransfer.files);
          }}
          className="cursor-pointer rounded-xl border-2 border-dashed border-line bg-[#0d141d] px-6 py-10 text-center transition-colors hover:border-[#2f415e]"
        >
          <div className="text-2xl">📦</div>
          <p className="mt-2 text-sm text-[#c8d3df]">জিপ ফাইল এখানে ফেলুন, অথবা ক্লিক করুন</p>
          <p className="mt-1 text-[11px] text-[#5b6b7d]">
            .zip · .html · .css · .js · ছবি — প্রতিটি ফাইল সর্বোচ্চ ১ MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.html,.htm,.css,.js,.json,.svg,.png,.jpg,.jpeg,.webp,.gif,.ico,.txt,.md"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#16202d]">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#8b98a5]">{status}</p>
        </div>

        {skipped.length > 0 && (
          <div className="mt-3 max-h-32 overflow-auto rounded-lg border border-[#3a2f1f] bg-[#241f13] p-3 text-[11px] leading-5 text-[#ffcf8a]">
            {skipped.map((s) => (
              <div key={s}>• {s}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { store, isValidSiteName, normalizeFilePath } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_FILES = 400;
const MAX_BYTES = 1 * 1024 * 1024; // প্রতি ফাইল

type Incoming = { path: string; content: string; encoding?: 'utf8' | 'base64' };

/**
 * ব্রাউজারেই unzip করা ফাইলগুলো এখানে আসে (JSON অ্যারে, base64)।
 * বড় ফাইল হলে ১ MB-তে সীমাবদ্ধ রাখা হয়েছে।
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch (r) {
    return r as Response;
  }

  const body = (await req.json().catch(() => null)) as
    | { site?: string; files?: Incoming[]; replace?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: 'ভুল রিকোয়েস্ট' }, { status: 400 });

  const site = (body.site || '').toLowerCase();
  if (!isValidSiteName(site)) return NextResponse.json({ error: 'অবৈধ সাইট' }, { status: 400 });

  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) return NextResponse.json({ error: 'কোনো ফাইল নেই' }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `একবারে সর্বোচ্চ ${MAX_FILES}টি ফাইল` }, { status: 400 });
  }

  const driver = store();
  if (!(await driver.get(site))) return NextResponse.json({ error: 'সাইট নেই' }, { status: 404 });

  if (body.replace) {
    const existing = await driver.listFiles(site);
    for (const f of existing) {
      try {
        await driver.deleteFile(site, f);
      } catch {}
    }
  }

  const written: string[] = [];
  const skipped: { path: string; reason: string }[] = [];

  for (const f of files) {
    const norm = normalizeFilePath(f.path || '');
    if (!norm) {
      skipped.push({ path: f.path, reason: 'অবৈধ পাথ' });
      continue;
    }
    const buf =
      f.encoding === 'base64' ? Buffer.from(f.content, 'base64') : Buffer.from(f.content, 'utf8');
    if (buf.byteLength > MAX_BYTES) {
      skipped.push({ path: norm, reason: '১ MB-এর বেশি' });
      continue;
    }
    try {
      await driver.writeFile(site, norm, buf);
      written.push(norm);
    } catch (e) {
      const m = (e as Error).message || 'সেভ ব্যর্থ';
      skipped.push({
        path: norm,
        reason: /EROFS|read-only file system/i.test(m)
          ? 'হোস্টের ডিস্ক read-only — Supabase স্টোরেজ দরকার'
          : m,
      });
    }
  }

  await driver.afterChange(site);
  return NextResponse.json({ ok: true, written, skipped, count: written.length });
}

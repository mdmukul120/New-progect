import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  store,
  normalizeFilePath,
  isValidSiteName,
  isTextFile,
  mimeFor,
  friendlyStorageError,
} from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch (r) {
    return r as Response;
  }
  const params = new URL(req.url).searchParams;
  const site = (params.get('site') || '').toLowerCase();
  const file = params.get('file');
  if (!isValidSiteName(site)) return NextResponse.json({ error: 'অবৈধ সাইট' }, { status: 400 });

  const driver = store();
  if (!(await driver.get(site))) return NextResponse.json({ error: 'সাইট নেই' }, { status: 404 });

  if (!file) {
    const files = await driver.listFiles(site);
    return NextResponse.json({ files });
  }

  const norm = normalizeFilePath(file);
  if (!norm) return NextResponse.json({ error: 'অবৈধ পাথ' }, { status: 400 });
  const buf = await driver.readFile(site, norm);
  if (!buf) return NextResponse.json({ error: 'ফাইল নেই' }, { status: 404 });

  return NextResponse.json({
    file: norm,
    text: isTextFile(norm) ? buf.toString('utf8') : null,
    size: buf.byteLength,
    mime: mimeFor(norm),
  });
}

export async function PUT(req: NextRequest) {
  try {
    await requireAuth();
  } catch (r) {
    return r as Response;
  }
  const body = (await req.json().catch(() => null)) as
    | { site?: string; file?: string; content?: string }
    | null;
  if (!body) return NextResponse.json({ error: 'ভুল রিকোয়েস্ট' }, { status: 400 });

  const site = (body.site || '').toLowerCase();
  if (!isValidSiteName(site)) return NextResponse.json({ error: 'অবৈধ সাইট' }, { status: 400 });
  const norm = normalizeFilePath(body.file || '');
  if (!norm) return NextResponse.json({ error: 'অবৈধ ফাইল পাথ' }, { status: 400 });
  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'কনটেন্ট নেই' }, { status: 400 });
  }

  const driver = store();
  if (!(await driver.get(site))) return NextResponse.json({ error: 'সাইট নেই' }, { status: 404 });

  try {
    await driver.writeFile(site, norm, body.content);
  } catch (e) {
    return NextResponse.json({ error: friendlyStorageError(e as Error) }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}


export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
  } catch (r) {
    return r as Response;
  }
  const params = new URL(req.url).searchParams;
  const site = (params.get('site') || '').toLowerCase();
  const norm = normalizeFilePath(params.get('file') || '');
  if (!isValidSiteName(site) || !norm) {
    return NextResponse.json({ error: 'অবৈধ রিকোয়েস্ট' }, { status: 400 });
  }
  await store().deleteFile(site, norm);
  return NextResponse.json({ ok: true });
}

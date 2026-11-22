import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { store, isValidSiteName, LIMITS } from '@/lib/store';

export const runtime = 'nodejs';

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireAuth();
  } catch (r) {
    return r as Response;
  }
  const sites = await store().list();
  return NextResponse.json({ sites, limits: LIMITS });
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch (r) {
    return r as Response;
  }
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || '').trim().toLowerCase();
  if (!isValidSiteName(name)) {
    return fail('নামে শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও হাইফেন চলবে (৩-৪০ অক্ষর, শুরু/শেষে হাইফেন নয়)।');
  }
  const driver = store();
  if (await driver.get(name)) return fail('এই নামে সাইট আগেই আছে');
  const site = await driver.create(name);
  return NextResponse.json({ site }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
  } catch (r) {
    return r as Response;
  }
  const name = (new URL(req.url).searchParams.get('name') || '').toLowerCase();
  if (!isValidSiteName(name)) return fail('অবৈধ সাইট নাম');
  await store().remove(name);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { checkPassword, createSession, destroySession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({ password: '' }))) as { password?: string };
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD সেট করা নেই — .env ফাইলে দিন।' },
      { status: 500 },
    );
  }
  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: 'পাসওয়ার্ড ভুল' }, { status: 401 });
  }
  await createSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

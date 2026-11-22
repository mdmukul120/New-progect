import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'sitehub_session';
const MAX_AGE = 60 * 60 * 24 * 7; // ৭ দিন

function secret(): string {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || 'dev-only-insecure-secret';
}

function sign(value: string): string {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function createSession() {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `admin.${expires}`;
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const idx = raw.lastIndexOf('.');
  if (idx < 0) return false;
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const [, expires] = payload.split('.');
  return Number(expires) > Date.now();
}

/** মিউটেটিং API রুটের জন্য — না থাকলে ৪০১ ছোড়ে */
export async function requireAuth() {
  if (!(await isAuthed())) {
    throw new Response(JSON.stringify({ error: 'লগইন প্রয়োজন' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
}

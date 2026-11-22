import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-ভিত্তিক রাউটিং
 *
 * 1. প্ল্যাটফর্ম হোস্ট (localhost, *.vercel.app)  → প্যানেল + /s/<site> প্রিভিউ
 * 2. কারেন্ট ডেভেলপমেন্ট ডোমেইন (VERCEL_URL)      → পুরো অ্যাপ (প্যানেল সহ)
 * 3. PREFERRED_SITE হোস্ট                          → সব রিকোয়েস্ট ওই সাইটে
 * 4. ROOT_DOMAIN-এর সাবডোমেইন                      → সেই নামের সাইট
 * 5. অন্য যেকোনো ডোমেইন                            → পুরো অ্যাপ (একক-ডোমেইন মোড)
 */

export const config = {
  matcher: ['/((?!_next/|favicon|robots.txt).*)'],
};

const ADMIN_PREFIXES = ['/admin', '/login', '/api/'];
const BLOCKED_ON_SITE_HOST = ['/api/', '/admin'];

function isPlatformHost(host: string): boolean {
  const deploymentHost = (process.env.VERCEL_URL || '').toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.e2b.app') ||
    (!!deploymentHost && host === deploymentHost)
  );
}

/** ডিভাইসে আগে থেকে থাকা লিংক (/admin, /login) যাতে সাইট-হোস্টেও কাজ করে */
function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const pathname = req.nextUrl.pathname;

  // ১. প্ল্যাটফর্ম হোস্ট → সব খোলা
  if (isPlatformHost(host)) return NextResponse.next();

  // ২, ৫. প্যানেল পাথ আগে দিন (একক-ডোমেইন মোডে প্যানেল ব্যবহারের একমাত্র পথ)
  if (isAdminPath(pathname)) return NextResponse.next();

  const root = (process.env.ROOT_DOMAIN || '').toLowerCase().trim();
  const preferred = (process.env.PREFERRED_SITE || '').toLowerCase().trim();

  // ৩. নির্দিষ্ট সাইট হোস্ট
  if (preferred) {
    return serveSite(req, preferred);
  }

  // ৪. wildcard সাবডোমেইন (ROOT_DOMAIN সেট থাকলে)
  if (root && host.endsWith(`.${root}`) && host !== `www.${root}`) {
    const sub = host.slice(0, -(root.length + 1));
    if (sub && !sub.includes('.')) return serveSite(req, sub);
  }

  // ৫. অন্য ডোমেইন → পুরো অ্যাপ (প্যানেল সহ), শুধু /api/admin বন্ধ নয়
  if (BLOCKED_ON_SITE_HOST.some((p) => pathname.startsWith(p))) {
    return new NextResponse(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  return NextResponse.next();
}

function serveSite(req: NextRequest, site: string) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-site-path', req.nextUrl.pathname);
  requestHeaders.set('x-site-name', site);

  const url = req.nextUrl.clone();
  url.pathname = '/s';
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

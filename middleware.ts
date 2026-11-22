import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-ভিত্তিক রাউটিং:
 *  - প্ল্যাটফর্ম হোস্ট (localhost, *.vercel.app) → প্যানেল + /s/<site> প্রিভিউ
 *  - অন্য যেকোনো হোস্ট (hello.sites.xyz, মুকুল.পাতা.বাংলা) → /s সাইট সার্ভার
 *  - সাইট হোস্টে /api/* পুরোপুরি বন্ধ
 */
export const config = {
  matcher: ['/((?!_next/|favicon|robots.txt).*)'],
};

function isPlatformHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.e2b.app')
  );
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();

  if (isPlatformHost(host)) return NextResponse.next();

  // সাইট হোস্টে অ্যাডমিন API বন্ধ
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-site-path', req.nextUrl.pathname);

  const url = req.nextUrl.clone();
  url.pathname = '/s';
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

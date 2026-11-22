/**
 * হোস্ট হেডার থেকে দেয়া সাইট বের করা।
 *
 *  ROOT_DOMAIN=sites.xyz  →  hello.sites.xyz = "hello"
 *  ROOT_DOMAIN ফাঁকা      →  সব রিকোয়েস্ট DEFAULT_SITE-এ (একক-domain মোড)
 */
export function siteFromHost(hostHeader: string | null): string | null {
  const host = (hostHeader || '').split(':')[0].toLowerCase();
  const root = (process.env.ROOT_DOMAIN || '').toLowerCase().trim();
  const fallback = (process.env.DEFAULT_SITE || '').toLowerCase().trim() || null;

  if (!root) return fallback;
  if (!host) return fallback;

  // প্ল্যাটফর্মের নিজের হোস্ট (.vercel.app, localhost) → ডিফল্ট সাইট
  if (host === 'localhost' || host.endsWith('.vercel.app') || host.endsWith('.e2b.app')) {
    return fallback;
  }
  if (host === root || host === `www.${root}`) return fallback;

  if (host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1));
    if (!sub || sub.includes('.') || sub === 'www') return fallback;
    return sub;
  }
  // অন্য ডোমেইন (যেমন মুকুল.পাতা.বাংলা) → ডিফল্ট সাইট
  return fallback;
}

export function isAdminHost(hostHeader: string | null): boolean {
  const host = (hostHeader || '').split(':')[0].toLowerCase();
  return host === 'localhost' || host.endsWith('.vercel.app') || host.endsWith('.e2b.app');
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { siteFromHost } from '@/lib/sites';
import { store, mimeFor, normalizeFilePath, isValidSiteName } from '@/lib/store';

export const runtime = 'nodejs';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'SAMEORIGIN',
};

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

function notFound(message: string, status = 404) {
  const html = `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${status === 404 ? '404' : 'অনুমতি নেই'} — SiteHub</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f14;color:#e6edf3;
font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,"Noto Sans Bengali",sans-serif}
.box{text-align:center;padding:32px;max-width:520px}
h1{font-size:48px;margin:0;color:#3ddc97;font-weight:800;letter-spacing:-2px}
p{color:#8b98a5;margin:10px 0 0;line-height:1.7}
code{background:#111823;padding:2px 8px;border-radius:6px;color:#e6edf3}
</style></head><body><div class="box">
<h1>${status === 404 ? '404' : '401'}</h1><p>${message}</p>
<p style="margin-top:18px;font-size:12px;color:#41505f">SiteHub</p>
</div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
  });
}

/**
 * সাইট সার্ভার।
 *  - wildcard হোস্ট:      Host: hello.sites.xyz,  path: /about.html
 *  - প্ল্যাটফর্ম প্রিভিউ:  Host: localhost:3000,  path: /s/hello/about.html
 */
export async function GET(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const originalPath = req.headers.get('x-site-path') || req.nextUrl.pathname;

  let siteName: string | null = null;
  let filePath = '/';

  const preview = originalPath.match(/^\/s\/([a-z0-9][a-z0-9-]{0,39})(\/.*)?$/);

  const forced = (req.headers.get('x-site-name') || '').toLowerCase();

  if (isPlatformHost(host) && preview) {
    siteName = preview[1];
    filePath = preview[2] || '/';
  } else if (forced) {
    siteName = forced;
    filePath = originalPath;
  } else {
    siteName = siteFromHost(host);
    filePath = originalPath;
  }

  if (!siteName || !isValidSiteName(siteName)) {
    return notFound('এই ঠিকানায় কোনো সাইট কনফিগার করা নেই।');
  }

  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    filePath = '/';
  }
  if (filePath === '/' || filePath === '') filePath = '/index.html';

  const driver = store();
  const site = await driver.get(siteName);
  if (!site) return notFound(`"${siteName}" নামে কোনো সাইট নেই।`);

  const norm = normalizeFilePath(filePath);
  const candidates: string[] = [];
  if (norm) {
    candidates.push(norm);
    candidates.push(`${norm}/index.html`);
    if (!norm.includes('.')) candidates.push(`${norm}.html`);
  }
  if (site.indexFile && (filePath === '/index.html' || filePath === '/')) {
    candidates.push(site.indexFile);
  }

  const inPreview = isPlatformHost(host) && !!preview;

  for (const candidate of candidates) {
    const buf = await driver.readFile(siteName, candidate);
    if (buf) {
      const type = mimeFor(candidate);
      const body =
        inPreview && type.startsWith('text/html')
          ? injectBaseHref(buf.toString('utf8'), `/s/${siteName}/`)
          : null;
      return new NextResponse(body ?? new Uint8Array(buf), {
        status: 200,
        headers: {
          'content-type': type,
          'cache-control': 'public, max-age=60, stale-while-revalidate=300',
          ...SECURITY_HEADERS,
        },
      });
    }
  }

  // SPA fallback — index.html থাকলে সেখানেই পাঠাই
  if (site.indexFile) {
    const buf = await driver.readFile(siteName, site.indexFile);
    if (buf) {
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=60',
          ...SECURITY_HEADERS,
        },
      });
    }
  }

  return notFound(`"${filePath}" ফাইলটি এই সাইটে নেই।`);
}

/**
 * প্ল্যাটফর্ম প্রিভিউ (/s/<site>/...) এ relative লিংক কাজ করানোর জন্য
 * <base href> ইনজেক্ট করে। রুট ডোমেইনে (wildcard) কিছু বদলানো হয় না।
 */
function injectBaseHref(html: string, base: string): string {
  const tag = `<base href="${base}">`;
  if (/<base\s/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${tag}`);
  return tag + html;
}

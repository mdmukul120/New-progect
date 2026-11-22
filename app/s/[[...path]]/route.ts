import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { store, mimeFor, normalizeFilePath, isValidSiteName } from '@/lib/store';

export const runtime = 'nodejs';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'SAMEORIGIN',
};

function notFound(message: string) {
  const html = `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 — SiteHub</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f14;color:#e6edf3;
font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,"Noto Sans Bengali",sans-serif}
.box{text-align:center;padding:32px;max-width:520px}
h1{font-size:48px;margin:0;color:#3ddc97;font-weight:800;letter-spacing:-2px}
p{color:#8b98a5;margin:10px 0 0;line-height:1.7}
</style></head><body><div class="box"><h1>404</h1><p>${message}</p>
<p style="margin-top:18px;font-size:12px;color:#41505f">SiteHub</p></div></body></html>`;
  return new NextResponse(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
  });
}

/** প্ল্যাটফর্ম প্রিভিউতে relative লিংক কাজ করানোর জন্য <base href> */
function injectBaseHref(html: string, base: string): string {
  if (/<base\s/i.test(html)) return html;
  const tag = `<base href="${base}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${tag}`);
  return tag + html;
}

/**
 * সাইট সার্ভার — সব হোস্টেই একই নিয়ম: /s/<site>/<path>
 * উদাহরণ: /s/portfolio/  ·  /s/portfolio/style.css  ·  /s/portfolio/about.html
 */
export async function GET(req: NextRequest) {
  const segments = (req.nextUrl.pathname.match(/^\/s(?:\/(.*))?$/) || [])[1] || '';
  const parts = segments.split('/');
  const siteName = (parts.shift() || '').toLowerCase();

  if (!siteName || !isValidSiteName(siteName)) {
    return notFound('সাইটের নাম দেওয়া হয়নি।');
  }

  let filePath = '/' + parts.join('/');
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

  for (const candidate of candidates) {
    const buf = await driver.readFile(siteName, candidate);
    if (buf) {
      const type = mimeFor(candidate);
      const body =
        type.startsWith('text/html') ? injectBaseHref(buf.toString('utf8'), `/s/${siteName}/`) : null;
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

  return notFound(`"${filePath}" ফাইলটি এই সাইটে নেই।`);
}

export const config = {
  runtime: 'edge',
};

const TARGETS = {
  serverfn: 'https://www.hamyra.xyz/_serverFn',
  edge: 'https://edge.hamyra.xyz',
  apihamyra: 'https://api.hamyra.xyz',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Range, x-tsr-serverFn, x-tsr-redirect',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges, x-tsr-redirect',
  'Access-Control-Max-Age': '86400',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const reqUrl = new URL(req.url);
  const targetKey = reqUrl.searchParams.get('__target') || 'serverfn';
  const subPath = reqUrl.searchParams.get('__path') || '';

  const base = TARGETS[targetKey];
  if (!base) {
    return new Response(JSON.stringify({ error: 'Unknown proxy target' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Forward all original query parameters except internal __target and __path
  const forwardParams = new URLSearchParams();
  for (const [k, v] of reqUrl.searchParams.entries()) {
    if (k !== '__target' && k !== '__path') {
      forwardParams.append(k, v);
    }
  }

  const cleanSubPath = subPath.replace(/^\/+/, '');
  const upstreamUrlStr =
    `${base}${cleanSubPath ? '/' + cleanSubPath : ''}` +
    (forwardParams.toString() ? `?${forwardParams.toString()}` : '');

  const forwardHeaders = new Headers();
  const passThroughHeaders = [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'range',
    'user-agent',
    'x-tsr-serverfn',
    'x-tsr-redirect',
  ];

  for (const h of passThroughHeaders) {
    const val = req.headers.get(h);
    if (val) forwardHeaders.set(h, val);
  }

  forwardHeaders.set('Origin', 'https://www.hamyra.xyz');
  forwardHeaders.set('Referer', 'https://www.hamyra.xyz/');

  const init = {
    method: req.method,
    headers: forwardHeaders,
    redirect: 'follow',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
  }

  try {
    const upstreamRes = await fetch(upstreamUrlStr, init);
    const outHeaders = new Headers(upstreamRes.headers);

    // Strip hop-by-hop or conflicting security headers
    outHeaders.delete('content-encoding');
    outHeaders.delete('content-security-policy');
    outHeaders.delete('x-frame-options');
    outHeaders.delete('strict-transport-security');

    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      outHeaders.set(k, v);
    }

    // Cache public GET serverFn / live-tv discovery responses briefly at Vercel Edge for instant speed
    if (req.method === 'GET' && upstreamRes.status === 200 && targetKey === 'serverfn') {
      outHeaders.set('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=120');
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Upstream fetch failed' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    );
  }
}

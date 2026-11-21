import { Impit } from 'impit';

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

const browserClient = new Impit({
  browser: 'chrome',
  timeout: 25000,
  followRedirects: true,
});

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);

  // Support BOTH direct Vercel rewrite path preservation (`/_edge/...`, `/_apihamyra/...`, `/_serverFn/...`)
  // AND explicit query parameters (`?__target=edge&__path=...`) from `reqUrl.searchParams` or `req.query`.
  let targetKey = reqUrl.searchParams.get('__target') || (typeof req.query?.__target === 'string' ? req.query.__target : '');
  let rawSubPath = reqUrl.searchParams.get('__path') || (typeof req.query?.__path === 'string' ? req.query.__path : '');

  if (reqUrl.pathname.startsWith('/_edge/') || reqUrl.pathname === '/_edge') {
    targetKey = 'edge';
    rawSubPath = reqUrl.pathname.slice('/_edge'.length).replace(/^\/+/, '');
  } else if (reqUrl.pathname.startsWith('/_apihamyra/') || reqUrl.pathname === '/_apihamyra') {
    targetKey = 'apihamyra';
    rawSubPath = reqUrl.pathname.slice('/_apihamyra'.length).replace(/^\/+/, '');
  } else if (reqUrl.pathname.startsWith('/_serverFn/') || reqUrl.pathname === '/_serverFn') {
    targetKey = 'serverfn';
    rawSubPath = reqUrl.pathname.slice('/_serverFn'.length).replace(/^\/+/, '');
  }

  if (!targetKey) {
    targetKey = 'serverfn';
  }

  const base = TARGETS[targetKey];
  if (!base) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unknown proxy target' }));
    return;
  }

  // Forward all original query parameters except internal __target / __path / path (injected by Vercel rewrite)
  const forwardParams = new URLSearchParams();
  for (const [k, v] of reqUrl.searchParams.entries()) {
    if (k !== '__target' && k !== '__path' && !(k === 'path' && v === rawSubPath)) {
      forwardParams.append(k, v);
    }
  }

  const cleanSubPath = rawSubPath.replace(/^\/+/, '');
  const upstreamUrlStr =
    `${base}${cleanSubPath ? '/' + cleanSubPath : ''}` +
    (forwardParams.toString() ? `?${forwardParams.toString()}` : '');

  const forwardHeaders = {
    Origin: 'https://www.hamyra.xyz',
    Referer: 'https://www.hamyra.xyz/',
  };

  if (targetKey === 'serverfn') {
    forwardHeaders['x-tsr-serverFn'] = 'true';
  }

  const passThroughHeaders = [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'range',
    'x-tsr-serverfn',
    'x-tsr-redirect',
  ];

  for (const h of passThroughHeaders) {
    const val = req.headers[h];
    if (typeof val === 'string' && val) {
      forwardHeaders[h] = val;
    }
  }

  let bodyBuf;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length > 0) {
      bodyBuf = Buffer.concat(chunks);
    }
  }

  try {
    const upstreamRes = await browserClient.fetch(upstreamUrlStr, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyBuf,
    });

    res.statusCode = upstreamRes.status;

    const skipHeaders = new Set([
      'content-encoding',
      'transfer-encoding',
      'connection',
      'keep-alive',
      'content-security-policy',
      'x-frame-options',
      'strict-transport-security',
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-expose-headers',
    ]);

    upstreamRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!skipHeaders.has(lower)) {
        res.setHeader(key, value);
      }
    });

    if (req.method === 'GET' && upstreamRes.status === 200 && targetKey === 'serverfn') {
      res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=120');
    }

    const arrayBuf = await upstreamRes.arrayBuffer();
    const outBuffer = Buffer.from(arrayBuf);
    res.setHeader('Content-Length', String(outBuffer.length));
    res.end(outBuffer);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Upstream fetch failed',
      })
    );
  }
}

/**
 * tools/dev-bridge.mjs
 *
 * Serves the PHP application when the host has no `php` binary available
 * (for example inside a browser sandbox). It boots PHP-WASM once and
 * dispatches each HTTP request to the real front controller
 * (`public/index.php`), so behaviour is identical to production.
 *
 *   npm run dev            # → http://0.0.0.0:8080
 *   PORT=9000 npm run dev
 *
 * Production hosts should use Apache/Nginx + PHP-FPM (see README); this file
 * is a development convenience only and is never shipped to the web root.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNodeRuntime, useHostFilesystem } from '@php-wasm/node';
import { PHP, FileLockManagerInMemory } from '@php-wasm/universal';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCROOT = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const runtime = await loadNodeRuntime('8.3', {
  fileLockManager: new FileLockManagerInMemory(),
  emscriptenOptions: {
    processId: 1,
    ENV: { ...process.env, TERM: 'xterm', PATH: process.env.PATH || '' },
  },
});
const php = new PHP(runtime);
useHostFilesystem(php);

/* ------------------------------------------------------------ helpers */
function phpString(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function toPhp(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(toPhp).join(',') + ']';
  if (typeof value === 'object') {
    return '[' + Object.entries(value).map(([k, v]) => phpString(k) + '=>' + toPhp(v)).join(',') + ']';
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return phpString(value);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

/* ------------------------------------------------------------- server */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = url.pathname;
  }

  // 1) static assets straight from /public
  const candidate = path.join(DOCROOT, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (pathname !== '/' && candidate.startsWith(DOCROOT) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(candidate).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(candidate).pipe(res);
    return;
  }

  // 2) everything else → PHP front controller
  let body = '';
  for await (const chunk of req) body += chunk;

  const serverVars = {
    REQUEST_METHOD: req.method,
    REQUEST_URI: req.url,
    QUERY_STRING: url.search.slice(1),
    SCRIPT_NAME: '/index.php',
    SCRIPT_FILENAME: path.join(DOCROOT, 'index.php'),
    DOCUMENT_ROOT: DOCROOT,
    SERVER_PROTOCOL: 'HTTP/1.1',
    SERVER_SOFTWARE: 'mlbd-dev-bridge',
    REMOTE_ADDR: req.socket.remoteAddress || '127.0.0.1',
    HTTP_USER_AGENT: req.headers['user-agent'] || 'dev-bridge',
    HTTP_ACCEPT: req.headers.accept || 'text/html',
    HTTP_REFERER: req.headers.referer || '',
    HTTP_HOST: req.headers.host || `localhost:${PORT}`,
    CONTENT_TYPE: req.headers['content-type'] || '',
    CONTENT_LENGTH: req.headers['content-length'] || '',
    HTTPS: 'off',
  };

  const getVars = Object.fromEntries(url.searchParams.entries());
  const postVars = {};
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.includes('application/x-www-form-urlencoded')) {
    for (const [k, v] of new URLSearchParams(body)) postVars[k] = v;
  }

  const script = `<?php
$_SERVER = ${toPhp(serverVars)};
$_GET = ${toPhp(getVars)};
$_POST = ${toPhp(postVars)};
$_COOKIE = ${toPhp(parseCookies(req.headers.cookie))};
$_REQUEST = array_merge($_GET, $_POST);
require ${phpString(path.join(DOCROOT, 'index.php'))};
`;

  const tmpFile = '/tmp/_mlbd_req_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.php';
  php.writeFile(tmpFile, script);

  try {
    const result = await php.run({
      scriptPath: tmpFile,
      relativeUri: req.url,
      method: req.method,
      headers: { ...req.headers, host: req.headers.host || `localhost:${PORT}` },
      body,
    });
    const text = typeof result === 'string' ? result : (result.text ?? '');

    const headers = {};
    for (const [k, v] of Object.entries(result.headers || {})) {
      headers[String(k).toLowerCase()] = Array.isArray(v) ? String(v[0]) : String(v);
    }
    let status = Number(result.httpStatusCode) || 200;
    if (headers.status) {
      const match = String(headers.status).match(/(\d{3})/);
      if (match) status = Number(match[1]);
    }
    delete headers.status;
    delete headers['content-length'];
    delete headers['transfer-encoding'];

    res.writeHead(status, headers);
    res.end(text);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Dev bridge error:\n' + message);
    console.error(message);
  } finally {
    try {
      php.unlink(tmpFile);
    } catch {
      /* ignore */
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MovieLinkBD dev server → http://${HOST}:${PORT}`);
});

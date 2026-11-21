import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as acorn from 'acorn';
import { Impit } from 'impit';

const execFileAsync = promisify(execFile);

const impitClient = new Impit({
  browser: 'chrome',
  timeout: 30000,
  followRedirects: true,
});

const UPSTREAM_ORIGIN = 'https://www.hamyra.xyz';
const SNAPSHOT_HTML_PATH = path.resolve(process.cwd(), 'upstream/index.html');
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const LOGOS_DIR = path.join(DIST_DIR, 'logos');

const STATIC_ROOT_FILES = [
  '/favicon.png',
  '/hamyra-logo.jpg',
  '/hamyra-logo.png',
  '/hamyra-logo.webp',
  '/hamyra-icon-512.png',
  '/icon-android.png',
  '/og-image.jpg',
  '/site.webmanifest',
  '/robots.txt',
];

const KNOWN_AD_DOMAINS = [
  'effectivecpmnetwork.com',
  'dischargeconceiteffort.com',
];

async function fetchWithRetry(url, options = {}, retries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await impitClient.fetch(url, {
        ...options,
        headers: {
          Referer: `${UPSTREAM_ORIGIN}/`,
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }
  throw lastErr;
}

async function checkCorsNeed(testUrl) {
  try {
    const res = await impitClient.fetch(testUrl, {
      method: 'GET',
      headers: {
        Origin: 'https://hamyra-adfree-fast.vercel.app',
        Referer: 'https://hamyra-adfree-fast.vercel.app/',
        Accept: 'application/json',
      },
    });
    const acao = (res.headers.get('access-control-allow-origin') || '').trim();
    console.log(`[CORS Probe] ${testUrl} -> HTTP ${res.status}, ACAO="${acao}"`);
    if (res.status === 403 || !acao || (acao !== '*' && !acao.includes('vercel.app'))) {
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[CORS Probe] Warning on ${testUrl}: ${err.message}`);
    return false;
  }
}

function parseTopLevelFunctions(code) {
  const ast = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
  const funcs = [];
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      funcs.push(node);
    } else if (
      (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') &&
      node.declaration &&
      node.declaration.type === 'FunctionDeclaration' &&
      node.declaration.id
    ) {
      funcs.push(node.declaration);
    }
  }
  return { ast, funcs };
}

function replaceFunctionBodyBySignature(code, sigRegex, newFnGenerator, label) {
  let funcs;
  try {
    ({ funcs } = parseTopLevelFunctions(code));
  } catch (err) {
    console.error(`  [ast-error] Acorn failed before patching ${label}: ${err.message}`);
    throw err;
  }

  for (const fnNode of funcs) {
    const originalFn = code.slice(fnNode.start, fnNode.end);
    const match = sigRegex.exec(originalFn);
    if (match && match.index === 0) {
      const replacementFn = newFnGenerator(match, originalFn, fnNode);
      const updated = code.slice(0, fnNode.start) + replacementFn + code.slice(fnNode.end);
      console.log(`  [patched] ${label} [${fnNode.id.name}] (${originalFn.length} -> ${replacementFn.length} chars)`);
      return { code: updated, patched: true };
    }
  }

  console.warn(`  [patch-skip] Could not find FunctionDeclaration matching ${label}`);
  return { code, patched: false };
}

function replaceHydrateRootWithCreateRoot(code) {
  const ast = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });

  let foundCall = null;
  function walk(node) {
    if (!node || typeof node !== 'object' || foundCall) return;
    if (
      node.type === 'CallExpression' &&
      node.callee &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.property &&
      node.callee.property.name === 'hydrateRoot' &&
      node.arguments &&
      node.arguments.length >= 2 &&
      node.arguments[0].type === 'Identifier' &&
      node.arguments[0].name === 'document'
    ) {
      foundCall = node;
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc') continue;
      const val = node[key];
      if (Array.isArray(val)) {
        for (const item of val) walk(item);
      } else if (val && typeof val.type === 'string') {
        walk(val);
      }
    }
  }
  walk(ast);

  if (!foundCall) {
    console.warn('  [patch-skip] Could not find hydrateRoot(document, ...) CallExpression');
    return code;
  }

  const reactDomObj = code.slice(foundCall.callee.object.start, foundCall.callee.object.end);
  const elementArg = foundCall.arguments[1];
  const elementExpr = code.slice(elementArg.start, elementArg.end);
  const replacement = `${reactDomObj}.createRoot(document.getElementById("app")||document.body).render(${elementExpr})`;
  console.log(`  [patched] AST switched ${reactDomObj}.hydrateRoot(document, ...) -> createRoot(#app).render(...)`);
  return code.slice(0, foundCall.start) + replacement + code.slice(foundCall.end);
}

function patchEntryChunk(rawCode) {
  let code = rawCode;

  // Log the tail of entry chunk for full build visibility
  console.log('[Entry Tail Preview (last 900 chars)]:');
  console.log(code.slice(-900));

  // 1. Unlock Af() & mA() & pA() (Ad-unlock state, 1-hour timer, popup tab)
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{if\(typeof window>"u"\)return!0;try\{const [A-Za-z0-9_$]+=window\.localStorage\.getItem\([A-Za-z0-9_$]+\);if\(![A-Za-z0-9_$]+\)return!1;/,
    (m) => `function ${m[1]}(){return!0}`,
    'AdUnlock check Af() -> always unlocked (!0)'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{if\(typeof window>"u"\)return 0;try\{const [A-Za-z0-9_$]+=window\.localStorage\.getItem\([A-Za-z0-9_$]+\);if\(![A-Za-z0-9_$]+\)return 0;/,
    (m) => `function ${m[1]}(){return 864e5}`,
    'AdUnlock remaining time mA() -> 24h (864e5)'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{const [A-Za-z0-9_$]+=Date\.now\(\);try\{window\.localStorage\.setItem\(/,
    (m) => `function ${m[1]}(){return null}`,
    'Popup ad opener pA() -> null'
  ));

  // 2. Unlock modal Cf({label, onClose, onUnlocked}) -> immediately call onUnlocked & render nothing
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\{label:[A-Za-z0-9_$]+="content",onClose:[A-Za-z0-9_$]+,onUnlocked:([A-Za-z0-9_$]+)\}\)\{/,
    (m) => `function ${m[1]}({onUnlocked:${m[2]}}){return ${m[2]}?.(),null}`,
    'AdUnlock modal Cf() -> instant unlock & null'
  ));

  // 3. Video / Live-TV / Episode gate wrapper gA({children, label, fill}) -> render children directly!
  const jsxMatch = code.match(/([A-Za-z0-9_$]+)\.jsxs\("header"/);
  const jsxIdent = jsxMatch ? jsxMatch[1] : 'g';

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\{children:([A-Za-z0-9_$]+),label:[A-Za-z0-9_$]+="content",fill:([A-Za-z0-9_$]+)=!1\}\)\{/,
    (m) =>
      `function ${m[1]}({children:${m[2]},fill:${m[3]}=!1}){return ${jsxIdent}.jsx("div",{className:${m[3]}?"relative h-full":"relative",children:${m[2]}})}`,
    'Stream/Video AdGate wrapper gA() -> direct children'
  ));

  // 4. Download unlock context provider T8({children, label="download"}) -> always execute immediately!
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\{children:([A-Za-z0-9_$]+),label:[A-Za-z0-9_$]+="download"\}\)\{/,
    (m, orig) => {
      const ctxMatch = orig.match(/([A-Za-z0-9_$]+)\.Provider/);
      const ctxName = ctxMatch ? ctxMatch[1] : null;
      if (!ctxName) return orig;
      return `function ${m[1]}({children:${m[2]}}){return ${jsxIdent}.jsx(${ctxName}.Provider,{value:{requireUnlock:a=>a()},children:${m[2]}})}`;
    },
    'Download UnlockProvider T8() -> instant pass-through'
  ));

  // 5. Neutralize Banner Ad iframe generator CA() and Banner Ad component
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\([A-Za-z0-9_$,]+\)\{const [A-Za-z0-9_$]+="<\\\/script>"/,
    (m) => `function ${m[1]}(){return""}`,
    'Banner Ad HTML builder CA() -> empty string'
  ));

  // Any component taking {adKey:...} in entry chunk -> return null
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\{adKey:[^}]+\}\)\{/,
    (m) => `function ${m[1]}(){return null}`,
    'Inline Banner Ad component ({adKey}) -> null'
  ));

  // 6. Remove Cloudflare Turnstile 4,000ms bottleneck (hw() and V5())
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{if\([A-Za-z0-9_$]+\|\|typeof window>"u"\)return;[A-Za-z0-9_$]+=!0;const [A-Za-z0-9_$]+=\(\)=>\{if\(!window\.turnstile\)/,
    (m) => `function ${m[1]}(){}`,
    'Cloudflare Turnstile widget loader hw() -> no-op'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\([A-Za-z0-9_$]+=4e3\)\{return typeof window>"u"\?Promise\.resolve\(null\):/,
    (m) => `function ${m[1]}(){return Promise.resolve(null)}`,
    'Cloudflare Turnstile 4s wait V5() -> instant Promise.resolve(null)'
  ));

  // 7. Remove Anti-DevTools debugger loop H3(), fetch lock AN(), and right-click/F12 blocker a5()
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{const\[[A-Za-z0-9_$,]+\]=[A-Za-z0-9_$]+\.useState\(!1\);return [A-Za-z0-9_$]+\.useEffect\(\(\)=>\{[\s\S]{0,450}?debugger;/,
    (m) => `function ${m[1]}(){return null}`,
    'Anti-DevTools 400ms debugger loop & modal H3() -> null'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{if\(typeof window>"u"\)return;const [A-Za-z0-9_$]+=window\.fetch;window\.__hamyraFetchWrapped/,
    (m) => `function ${m[1]}(){}`,
    'DevTools fetch blocker AN() -> no-op'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{[A-Za-z0-9_$]+\.useEffect\(\(\)=>\{const [A-Za-z0-9_$]+=[A-Za-z0-9_$]+=>[A-Za-z0-9_$]+\.preventDefault\(\),[A-Za-z0-9_$]+=[A-Za-z0-9_$]+=>\{const [A-Za-z0-9_$]+=[A-Za-z0-9_$]+\.key\.toLowerCase\(\);if\([A-Za-z0-9_$]+==="f12"\)/,
    (m) => `function ${m[1]}(){}`,
    'Right-click & F12/Ctrl+Shift+I blocker a5() -> no-op'
  ));

  // 8. Remove analytics & navguard beacons u5(), Gd(), iN()
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\([A-Za-z0-9_$,]+\)\{if\(typeof window>"u"\)return;const [A-Za-z0-9_$]+=\([A-Za-z0-9_$]+\|\|"\/"\)\.split\("#"\)\[0\]\.slice\(0,300\);/,
    (m) => `function ${m[1]}(){}`,
    'Pageview analytics beacon u5() -> no-op'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\([A-Za-z0-9_$,={}]+\)\{if\([A-Za-z0-9_$]+>=[A-Za-z0-9_$]+\)return;[A-Za-z0-9_$]+\+=1;const [A-Za-z0-9_$]+=\{path:location\.pathname/,
    (m) => `function ${m[1]}(){}`,
    'Navguard telemetry Gd() -> no-op'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{if\([A-Za-z0-9_$]+\|\|typeof window>"u"\|\|typeof document>"u"\)return;[A-Za-z0-9_$]+=!0;const [A-Za-z0-9_$]+=[A-Za-z0-9_$]+=>\{[A-Za-z0-9_$]+\.isTrusted/,
    (m) => `function ${m[1]}(){}`,
    'Navguard global listeners iN() -> no-op'
  ));

  // 9. Speed up splash screen fallback in kN shellComponent (900ms -> 150ms) and dispatch hide immediately on mount
  code = code.replace(/setTimeout\(kill,\s*900\)/g, 'setTimeout(kill,120)');

  // 10. Scrub hardcoded ad URLs as defense-in-depth
  code = code.replace(
    /https:\/\/www\.effectivecpmnetwork\.com\/[^\s"'`]+/g,
    'about:blank'
  );
  code = code.replace(
    /https:\/\/dischargeconceiteffort\.com\/[^\s"'`]+/g,
    'about:blank'
  );

  // 11. Universal SPA client mount on #app (zero SSR hydration mismatch on ANY route!)
  // Replace kN({children:t}) shellComponent (which previously rendered <html><head><body>) with a Fragment
  // rendering HeadContent (sk) + children inside <div id="app"></div> (React 19 hoists <title>/<meta>/<link> to <head>!)
  const headContentMatch = code.match(/function\s+[A-Za-z0-9_$]+\(\{children:[A-Za-z0-9_$]+\}\)\{return\s+[A-Za-z0-9_$]+\.jsxs\("html",\{[^}]*children:\[[A-Za-z0-9_$]+\.jsxs\("head",\{children:\[[A-Za-z0-9_$]+\.jsx\(([A-Za-z0-9_$]+),\{\}\)/);
  const headCompIdent = headContentMatch ? headContentMatch[1] : null;

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\{children:([A-Za-z0-9_$]+)\}\)\{return\s+[A-Za-z0-9_$]+\.jsxs\("html",\{lang:"en",className:"dark",/,
    (m) => {
      if (headCompIdent) {
        return `function ${m[1]}({children:${m[2]}}){return ${jsxIdent}.jsxs(${jsxIdent}.Fragment,{children:[${jsxIdent}.jsx(${headCompIdent},{}),${m[2]}]})} `;
      }
      return `function ${m[1]}({children:${m[2]}}){return ${m[2]}}`;
    },
    'Root shellComponent kN() -> SPA Fragment with React 19 HeadContent'
  ));

  // Make Z2(router) seamlessly support pure SPA client boot when !window.$_TSR:
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /async function\s+([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+)\)\{const ([A-Za-z0-9_$]+)=window\.\$_TSR,/,
    (m, orig) => {
      const fnName = m[1];
      const routerVar = m[2];
      const guard = `if(!window.$_TSR){await ${routerVar}.load();const _sp=document.getElementById("hamyra-splash");if(_sp){_sp.style.opacity="0";_sp.style.pointerEvents="none";setTimeout(()=>{_sp.style.display="none"},220)}return ${routerVar}}`;
      const bracePos = orig.indexOf('{');
      return `async function ${fnName}(${routerVar}){${guard}${orig.slice(bracePos + 1)}`;
    },
    'Universal SPA boot guard in Z2(router) when !window.$_TSR'
  ));

  // Switch hydrateRoot(document, ...) -> createRoot(document.getElementById("app") || document.body).render(...)
  code = replaceHydrateRootWithCreateRoot(code);

  return code;
}

function patchSubChunk(filename, rawCode) {
  let code = rawCode;
  let modified = false;

  // 1. Patch ads-*.js completely (Adsterra Social Bar + ad keys)
  if (/^ads-[A-Za-z0-9_-]+\.js$/.test(filename)) {
    // Keep exact export names, replace keys with empty strings and social bar injector with no-op!
    const exportMatch = code.match(/export\{([^}]+)\}/);
    if (exportMatch) {
      const specs = exportMatch[1].split(',').map((s) => s.trim());
      const decls = [];
      const outSpecs = [];
      specs.forEach((spec, idx) => {
        // e.g. "s as A" or "o as i" or "A"
        const parts = spec.split(/\s+as\s+/);
        const exportedName = (parts[1] || parts[0]).trim();
        const localName = `_adStub${idx}`;
        if (exportedName === 'i') {
          decls.push(`function ${localName}(){}`);
        } else {
          decls.push(`const ${localName}=""`);
        }
        outSpecs.push(`${localName} as ${exportedName}`);
      });
      code = `${decls.join(';')};export{${outSpecs.join(',')}};\n`;
      modified = true;
      console.log(`  [patched] Neutralized Adsterra Social Bar & keys in ${filename}`);
    }
  }

  // 2. Patch cricket-*.js local Adsterra iframe component I({adKey:...}) and sidebar ad z()
  if (/^cricket-[A-Za-z0-9_-]+\.js$/.test(filename)) {
    const r1 = replaceFunctionBodyBySignature(
      code,
      /function\s+([A-Za-z0-9_$]+)\(\{adKey:[^}]+\}\)\{/,
      (m) => `function ${m[1]}(){return null}`,
      `${filename}: local Adsterra iframe component -> null`
    );
    if (r1.patched) {
      code = r1.code;
      modified = true;
    }
    const r2 = replaceFunctionBodyBySignature(
      code,
      /function\s+([A-Za-z0-9_$]+)\(\)\{const\[[A-Za-z0-9_$,]+\]=[A-Za-z0-9_$]+\.useState\(null\);[A-Za-z0-9_$]+\.useEffect\(\(\)=>\{const [A-Za-z0-9_$]+=window\.matchMedia\("\(min-width: 1024px\)"\)/,
      (m) => `function ${m[1]}(){return null}`,
      `${filename}: Cricket sidebar ad box z() -> null`
    );
    if (r2.patched) {
      code = r2.code;
      modified = true;
    }
  }

  // 3. Any other chunk containing dischargeconceiteffort.com or effectivecpmnetwork.com
  for (const domain of KNOWN_AD_DOMAINS) {
    if (code.includes(domain)) {
      const r = replaceFunctionBodyBySignature(
        code,
        /function\s+([A-Za-z0-9_$]+)\(\{adKey:[^}]+\}\)\{/,
        (m) => `function ${m[1]}(){return null}`,
        `${filename}: adKey component -> null`
      );
      code = r.code;
      code = code.replace(new RegExp(`https?:\\/\\/(?:www\\.)?${domain.replace('.', '\\.')}[^"'\\s\`]*`, 'g'), 'about:blank');
      modified = true;
      console.log(`  [patched] Scrubbed ${domain} from ${filename}`);
    }
  }

  return { code, modified };
}

function discoverAssetReferences(content) {
  const foundAssets = new Set();
  const foundLogos = new Set();

  // Match "assets/foo-bar.js" or "/assets/foo-bar.css" or "./foo-bar.js"
  const assetRe1 = /(?:\/?assets\/|\bimport\s*\(\s*["']\.\/|\bfrom\s*["']\.\/)([A-Za-z0-9_.-]+\.(?:js|css|wasm|json|svg|png|webp|woff2?))/g;
  let m;
  while ((m = assetRe1.exec(content)) !== null) {
    foundAssets.add(m[1]);
  }

  // Also match plain "./ChunkName-hash.js" strings inside __vite__mapDeps or dynamic imports
  const assetRe2 = /["']\.\/([A-Za-z0-9_.-]+\.(?:js|css))["']/g;
  while ((m = assetRe2.exec(content)) !== null) {
    foundAssets.add(m[1]);
  }

  const assetRe3 = /["']\/?assets\/([A-Za-z0-9_.-]+\.(?:js|css))["']/g;
  while ((m = assetRe3.exec(content)) !== null) {
    foundAssets.add(m[1]);
  }

  // Match "/logos/*.png" or "/logos/*.svg" or "/logos/*.webp"
  const logoRe = /["']\/logos\/([A-Za-z0-9_.-]+\.(?:png|jpg|jpeg|webp|svg))["']/g;
  while ((m = logoRe.exec(content)) !== null) {
    foundLogos.add(m[1]);
  }

  return { foundAssets, foundLogos };
}

async function validateJsSyntax(filePath) {
  await execFileAsync(process.execPath, ['--check', filePath]);
}

function buildCleanIndexHtml({ entryJs, entryCss, preloadChunks }) {
  const preloadTags = preloadChunks
    .slice(0, 12)
    .map((chunk) => `  <link rel="modulepreload" href="/assets/${chunk}" />`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Hamyra — Watch Movies, Bangla Natok, Web Series &amp; Live TV Free (Ad-Free HD)</title>
  <meta name="description" content="Stream and download free HD movies, Bangla natok, K-drama, web series, anime, live cricket &amp; 100+ TV channels instantly — 100% ad-free, zero popups, no signup." />
  <meta name="theme-color" content="#070b16" />
  <meta name="application-name" content="Hamyra" />
  <meta name="apple-mobile-web-app-title" content="Hamyra" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta property="og:site_name" content="Hamyra" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Hamyra — Fast Ad-Free Movies, Web Series, Live TV &amp; Downloads" />
  <meta property="og:description" content="Free HD streaming &amp; direct downloads — movies, Bangla natok, K-Drama, web series, anime, live cricket and 100+ TV channels. Zero ads, zero popups." />
  <meta property="og:image" content="/og-image.jpg" />

  <!-- High-Speed DNS & TLS Preconnects -->
  <link rel="preconnect" href="https://edge.hamyra.xyz" crossorigin />
  <link rel="preconnect" href="https://api.hamyra.xyz" crossorigin />
  <link rel="preconnect" href="https://api.themoviedb.org" crossorigin />
  <link rel="preconnect" href="https://image.tmdb.org" crossorigin />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="dns-prefetch" href="https://cmos.raphsm4.dev" />
  <link rel="dns-prefetch" href="https://stela.raphsm4.dev" />
  <link rel="dns-prefetch" href="https://px.talkoraai.com" />
  <link rel="dns-prefetch" href="https://streambd-proxy.aininjaibrahim.workers.dev" />

  <link rel="icon" type="image/png" href="/favicon.png" sizes="any" />
  <link rel="icon" type="image/webp" href="/hamyra-logo.webp" sizes="any" />
  <link rel="apple-touch-icon" sizes="512x512" href="/hamyra-icon-512.png" />
  <link rel="manifest" href="/site.webmanifest" />

  <link rel="preload" as="image" href="/hamyra-logo.jpg" />
  <link rel="stylesheet" href="/assets/${entryCss}" data-precedence="default" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" data-precedence="default" />
  <link rel="modulepreload" href="/assets/${entryJs}" />
${preloadTags}

  <style>
    html, body {
      background-color: #070b16;
      color: #f8fafc;
    }
    /* Instant ad-slot suppression & layout cleanup */
    [id^="container-f8f096"],
    [class*="container-f8f096"],
    iframe[src*="effectivecpmnetwork"],
    iframe[src*="dischargeconceiteffort"],
    #cf-turnstile-host {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      pointer-events: none !important;
    }
    #hamyra-splash {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #070b16;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 14px;
      transition: opacity 0.2s ease-out;
    }
    #hamyra-splash.hidden {
      opacity: 0;
      pointer-events: none;
    }
    #hamyra-splash img {
      width: 84px;
      height: 84px;
      border-radius: 22px;
      box-shadow: 0 0 38px -6px rgba(34, 211, 238, 0.6);
    }
    #hamyra-splash .brand {
      font-family: 'Space Grotesk', system-ui, sans-serif;
      font-weight: 900;
      letter-spacing: -0.03em;
      font-size: 26px;
      color: #fff;
    }
  </style>
  <script>
    // Pre-seed permanent ad-free unlock timestamp & block unsolicited ad popups
    (function () {
      try {
        localStorage.setItem('hamyra_ad_unlock_at', String(Date.now() + 315360000000));
      } catch (e) {}
      var origOpen = window.open;
      if (typeof origOpen === 'function') {
        window.open = function (url, target, features) {
          var s = String(url || '');
          if (
            s.indexOf('effectivecpmnetwork') !== -1 ||
            s.indexOf('dischargeconceiteffort') !== -1 ||
            s.indexOf('adsterra') !== -1
          ) {
            return null;
          }
          return origOpen.call(window, url, target, features);
        };
      }
    })();
  </script>
</head>
<body>
  <div id="hamyra-splash">
    <img src="/hamyra-logo.jpg" alt="Hamyra" />
    <div class="brand">Hamyra</div>
  </div>
  <div id="app"></div>
  <script>
    (function () {
      var kill = function () {
        var s = document.getElementById('hamyra-splash');
        if (!s) return;
        s.style.opacity = '0';
        s.style.pointerEvents = 'none';
        setTimeout(function () { if (s) s.style.display = 'none'; }, 240);
      };
      window.addEventListener('hamyra-hide-splash', kill, { once: true });
      setTimeout(kill, 650);
    })();
  </script>
  <script type="module" src="/assets/${entryJs}"></script>
</body>
</html>
`;
}

async function main() {
  console.log('=== Building Fast Ad-Free Hamyra Bundle ===');
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await fs.mkdir(LOGOS_DIR, { recursive: true });

  // 1. Fetch upstream homepage HTML to auto-discover live entry JS & CSS hashes (with snapshot fallback)
  let upstreamHtml = '';
  try {
    console.log(`Fetching upstream HTML from ${UPSTREAM_ORIGIN}/ via Impit Chrome TLS...`);
    const htmlRes = await fetchWithRetry(`${UPSTREAM_ORIGIN}/`, {}, 2);
    if (htmlRes) {
      upstreamHtml = await htmlRes.text();
      console.log(`Fetched live upstream HTML (${upstreamHtml.length} chars)`);
    }
  } catch (err) {
    console.warn(`[warn] Live HTML fetch returned ${err.message}; falling back to bundled upstream/index.html snapshot`);
  }

  if (!upstreamHtml || !upstreamHtml.includes('/assets/index-')) {
    upstreamHtml = await fs.readFile(SNAPSHOT_HTML_PATH, 'utf8');
    console.log(`Loaded bundled snapshot upstream/index.html (${upstreamHtml.length} chars)`);
  }

  const entryJsMatch = upstreamHtml.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  const entryCssMatch = upstreamHtml.match(/\/assets\/(styles-[A-Za-z0-9_-]+\.css)/);
  if (!entryJsMatch || !entryCssMatch) {
    throw new Error('Could not locate entry JS or CSS in upstream HTML');
  }
  const entryJs = entryJsMatch[1];
  const entryCss = entryCssMatch[1];
  console.log(`Discovered Entry JS: ${entryJs}`);
  console.log(`Discovered Entry CSS: ${entryCss}`);

  // Collect initial modulepreloads from HTML
  const initialPreloads = [];
  for (const m of upstreamHtml.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+)"/g)) {
    if (m[1] !== entryJs) initialPreloads.push(m[1]);
  }

  // 2. Probe upstream APIs for CORS behavior from non-hamyra Origin
  const needEdgeProxy = await checkCorsNeed('https://edge.hamyra.xyz/bongo/sports');
  const needApiHamyraProxy = await checkCorsNeed('https://api.hamyra.xyz/mlbd/list?page=1');
  console.log(`CORS Proxy needed -> edge.hamyra.xyz: ${needEdgeProxy}, api.hamyra.xyz: ${needApiHamyraProxy}`);

  // 3. BFS Crawl & Download all JS/CSS assets + logos
  const assetQueue = [entryJs, entryCss, ...initialPreloads];
  const downloadedAssets = new Set();
  const logoQueue = new Set();

  // Concurrency worker pool for fast downloading
  async function processAsset(assetName) {
    if (downloadedAssets.has(assetName)) return;
    downloadedAssets.add(assetName);

    const url = `${UPSTREAM_ORIGIN}/assets/${assetName}`;
    const res = await fetchWithRetry(url);
    if (!res) {
      console.warn(`  [warn] Asset 404: ${url}`);
      return;
    }

    const isText = /\.(js|css|json|svg)$/i.test(assetName);
    if (!isText) {
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(path.join(ASSETS_DIR, assetName), buf);
      return;
    }

    let text = await res.text();
    const { foundAssets, foundLogos } = discoverAssetReferences(text);
    for (const a of foundAssets) {
      if (!downloadedAssets.has(a)) assetQueue.push(a);
    }
    for (const l of foundLogos) {
      logoQueue.add(l);
    }

    if (assetName.endsWith('.js')) {
      if (assetName === entryJs) {
        console.log(`Patching main entry bundle ${assetName}...`);
        text = patchEntryChunk(text);
      } else {
        const patched = patchSubChunk(assetName, text);
        text = patched.code;
      }

      // For CORS-restricted edge.hamyra.xyz JSON endpoints, route through our fast serverless proxy using a full origin URL
      // (`location.origin + "/api/edge"`) via AST StringLiteral/TemplateElement awareness so string quotes/templates never break
      // and `new URL(...)` always receives a valid absolute URL!
      // Direct media/binary/HLS endpoints (/bongo/hls, /bongo/live, /tmdb/hls, /tmdb/seg, /mlbd/stream, /download/apk)
      // stay on direct `https://edge.hamyra.xyz/...` so <video>/<a>/hls.js stream at full CDN speed!
      if (needEdgeProxy) {
        // Protect direct high-bandwidth media endpoints built via `${var}/bongo/hls` etc.
        text = text.replace(
          /`\$\{([A-Za-z0-9_$]+)\}\/(bongo\/hls|bongo\/live|tmdb\/hls|tmdb\/seg|mlbd\/stream|download\/apk)/g,
          '`https://edge.hamyra.xyz/$2'
        );
        // Replace standalone string literal "https://edge.hamyra.xyz" -> runtime full-origin expression
        text = text.replace(
          /"https:\/\/edge\.hamyra\.xyz"/g,
          '(typeof location<"u"?location.origin+"/api/edge":"https://edge.hamyra.xyz")'
        );
        // Replace quoted non-media prefixes "https://edge.hamyra.xyz/<path>"
        text = text.replace(
          /"https:\/\/edge\.hamyra\.xyz\/(?!bongo\/hls|bongo\/live|tmdb\/hls|tmdb\/seg|mlbd\/stream|download\/apk)([^"]*)"/g,
          '((typeof location<"u"?location.origin+"/api/edge":"https://edge.hamyra.xyz")+"/$1")'
        );
        // Replace template literal non-media prefixes `https://edge.hamyra.xyz/<path>`
        text = text.replace(
          /`https:\/\/edge\.hamyra\.xyz\/(?!bongo\/hls|bongo\/live|tmdb\/hls|tmdb\/seg|mlbd\/stream|download\/apk)/g,
          '`${typeof location<"u"?location.origin+"/api/edge":"https://edge.hamyra.xyz"}/'
        );
      }
      if (needApiHamyraProxy) {
        text = text.replace(
          /"https:\/\/api\.hamyra\.xyz"/g,
          '(typeof location<"u"?location.origin+"/api/apihamyra":"https://api.hamyra.xyz")'
        );
      }
    }

    const outPath = path.join(ASSETS_DIR, assetName);
    await fs.writeFile(outPath, text, 'utf8');

    if (assetName.endsWith('.js')) {
      await validateJsSyntax(outPath);
    }
  }

  while (assetQueue.length > 0) {
    const batch = [];
    while (assetQueue.length > 0 && batch.length < 12) {
      const next = assetQueue.shift();
      if (!downloadedAssets.has(next)) {
        batch.push(next);
      }
    }
    if (batch.length > 0) {
      await Promise.all(batch.map((name) => processAsset(name)));
    }
  }

  console.log(`Downloaded, patched & syntax-verified ${downloadedAssets.size} assets.`);

  // 4. Download static root files & discovered /logos/*.png (gracefully skipping any transient 403/404)
  await Promise.all(
    STATIC_ROOT_FILES.map(async (relPath) => {
      try {
        const res = await fetchWithRetry(`${UPSTREAM_ORIGIN}${relPath}`, {}, 2);
        if (!res) return;
        const outPath = path.join(DIST_DIR, relPath.replace(/^\//, ''));
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        if (relPath.endsWith('.webmanifest')) {
          const manifestText = await res.text();
          await fs.writeFile(outPath, manifestText, 'utf8');
        } else {
          const buf = Buffer.from(await res.arrayBuffer());
          await fs.writeFile(outPath, buf);
        }
      } catch (err) {
        console.warn(`  [warn] Optional root static file skipped (${relPath}): ${err.message}`);
      }
    })
  );

  await Promise.all(
    Array.from(logoQueue).map(async (logoName) => {
      try {
        const res = await fetchWithRetry(`${UPSTREAM_ORIGIN}/logos/${logoName}`, {}, 2);
        if (!res) return;
        const buf = Buffer.from(await res.arrayBuffer());
        await fs.writeFile(path.join(LOGOS_DIR, logoName), buf);
      } catch (err) {
        console.warn(`  [warn] Optional logo skipped (${logoName}): ${err.message}`);
      }
    })
  );
  console.log(`Downloaded ${STATIC_ROOT_FILES.length} root static files and ${logoQueue.size} channel logos.`);

  // 5. Verify zero residual ad-network URLs across all JS files
  const jsFiles = (await fs.readdir(ASSETS_DIR)).filter((f) => f.endsWith('.js'));
  for (const jf of jsFiles) {
    const content = await fs.readFile(path.join(ASSETS_DIR, jf), 'utf8');
    for (const domain of KNOWN_AD_DOMAINS) {
      if (content.includes(domain)) {
        throw new Error(`Build verification failed: ad domain "${domain}" still present in ${jf}`);
      }
    }
  }
  console.log(`Verified 0 ad-network domains across all ${jsFiles.length} JS bundles.`);

  // 6. Generate clean, fast SPA dist/index.html
  const cleanHtml = buildCleanIndexHtml({
    entryJs,
    entryCss,
    preloadChunks: initialPreloads,
  });
  await fs.writeFile(path.join(DIST_DIR, 'index.html'), cleanHtml, 'utf8');
  console.log('Generated clean ad-free dist/index.html');
  console.log('=== Build Completed Successfully! ===');
}

main().catch((err) => {
  console.error('BUILD FAILED:', err);
  process.exit(1);
});

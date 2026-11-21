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
const PROD_ORIGIN = 'https://mukul-plus08.vercel.app';
const SNAPSHOT_HTML_PATH = path.resolve(process.cwd(), 'upstream/index.html');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const LOGOS_DIR = path.join(DIST_DIR, 'logos');

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
        Origin: PROD_ORIGIN,
        Referer: `${PROD_ORIGIN}/`,
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
    console.warn(`[CORS Probe] Warning on ${testUrl}: ${err.message} (defaulting to proxy=true)`);
    return true;
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
      return { code: updated, patched: true, fnName: fnNode.id.name };
    }
  }

  console.warn(`  [patch-skip] Could not find FunctionDeclaration matching ${label}`);
  return { code, patched: false, fnName: null };
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

/**
 * Rebrand UI text & convert Cyan/Teal/Blue accents into Mukul Plus Electric Lime across JS chunks.
 * Never touches API keys, storage keys (`hamyra:continue-watching`, `hamyra:my-list`), or proxy origins.
 */
function applyBrandAndLimeThemeToJs(rawCode) {
  let code = rawCode;

  // 1. Brand identity replacements (safe UI strings, titles, eyebrows, filenames)
  code = code.replace(/Fresh · HamyraBD/g, 'Fresh · Mukul Plus');
  code = code.replace(/Watch · HamyraBD/g, 'Watch · Mukul Plus');
  code = code.replace(/Download · HamyraBD/g, 'Download · Mukul Plus');
  code = code.replace(/HamyraBD/g, 'Mukul Plus');
  code = code.replace(/https:\/\/www\.hamyra\.xyz\/og-image\.jpg/g, `${PROD_ORIGIN}/og-image.jpg`);
  code = code.replace(/`https:\/\/www\.hamyra\.xyz\//g, `\`${PROD_ORIGIN}/`);
  code = code.replace(/"https:\/\/www\.hamyra\.xyz\/"/g, `"${PROD_ORIGIN}/"`);
  code = code.replace(/"https:\/\/www\.hamyra\.xyz\/(movies|series|live-tv|privacy|terms|sports|cricket|cricket\/videos|turkish|video-downloader|downloads|app)"/g, `"${PROD_ORIGIN}/$1"`);
  code = code.replace(/const ([A-Za-z0-9_$]+)="https:\/\/www\.hamyra\.xyz",([A-Za-z0-9_$]+)="Hamyra"/g, `const $1="${PROD_ORIGIN}",$2="Mukul Plus"`);
  code = code.replace(/\b([A-Za-z0-9_$]+)="Hamyra",/g, '$1="Mukul Plus",');
  code = code.replace(/On Hamyra\b/g, 'On Mukul Plus');
  code = code.replace(/Hamyra lets you/g, 'Mukul Plus lets you');
  code = code.replace(/Hamyra is a/g, 'Mukul Plus is a');
  code = code.replace(/Hamyra streams/g, 'Mukul Plus streams');
  code = code.replace(/\$\{[A-Za-z0-9_$]+\}-তে/g, 'Mukul Plus-এ');
  code = code.replace(/\| Hamyra`/g, '| Mukul Plus`');
  code = code.replace(/\| Hamyra"/g, '| Mukul Plus"');
  code = code.replace(/— Hamyra`/g, '— Mukul Plus`');
  code = code.replace(/— Hamyra"/g, '— Mukul Plus"');
  code = code.replace(/Hamyra —/g, 'Mukul Plus —');
  code = code.replace(/on Hamyra/g, 'on Mukul Plus');
  code = code.replace(/How Hamyra /g, 'How Mukul Plus ');
  code = code.replace(/Terms for using Hamyra/g, 'Terms for using Mukul Plus');
  code = code.replace(/Free from Hamyra/g, 'Free from Mukul Plus');
  code = code.replace(/Hamyra HD/g, 'Mukul Plus HD');
  code = code.replace(/in HD on Hamyra/g, 'in HD on Mukul Plus');
  code = code.replace(/Hamyra-তে/g, 'Mukul Plus-এ');
  code = code.replace(/\| \$\{[A-Za-z0-9_$]+\}`/g, '| Mukul Plus`');
  code = code.replace(/children:"Hamyra"/g, 'children:"Mukul Plus"');
  code = code.replace(/Watch together on Hamyra/g, 'Watch together on Mukul Plus');
  code = code.replace(/\["Hamyra",/g, '["MukulPlus",');
  code = code.replace(/\/hamyra-logo\.(jpg|png|webp)/g, '/mukul-logo.$1');
  code = code.replace(/\/hamyra-icon-512\.png/g, '/mukul-icon-512.png');
  code = code.replace(/alt:"Hamyra"/g, 'alt:"Mukul Plus"');

  // 2. Color & Accent replacements: Cyan / Teal -> Mukul Plus Electric Lime (#a3e635 / lime-*)
  code = code.replace(/#22D3EE|#22d3ee|#2ad5e5/g, '#a3e635');
  code = code.replace(/rgba\(34,\s*211,\s*238,/g, 'rgba(163,230,53,');
  code = code.replace(/rgba\(45,\s*212,\s*191,/g, 'rgba(163,230,53,');
  code = code.replace(/rgba\(59,\s*130,\s*246,/g, 'rgba(132,204,22,');
  code = code.replace(/from-\[#0c3b3b\] via-\[#0a2029\] to-\[#0b1020\]/g, 'from-[#142409] via-[#0c1606] to-[#070905]');
  code = code.replace(/bg-\[#07141a\]\/92/g, 'bg-[#070905]/92');
  code = code.replace(/bg-\[#0b0f18\]/g, 'bg-[#0d1209]');
  code = code.replace(/ring-\[#0b0e16\]/g, 'ring-[#070905]');

  // Featured banner & button gradients -> crisp Lime + Black ink
  code = code.replace(
    /from-cyan-400 to-blue-500 text-white/g,
    'from-[#bef264] to-[#84cc16] text-[#070b02]'
  );
  code = code.replace(
    /from-cyan-400 to-blue-600 text-white/g,
    'from-[#bef264] to-[#84cc16] text-[#070b02]'
  );
  code = code.replace(
    /from-cyan-500 to-indigo-500/g,
    'from-[#a3e635] to-[#65a30d]'
  );
  code = code.replace(
    /from-emerald-400 to-cyan-500/g,
    'from-[#bef264] to-[#84cc16]'
  );
  code = code.replace(/text-cyan-300|text-cyan-400/g, 'text-[#a3e635]');
  code = code.replace(/bg-cyan-300|bg-cyan-400/g, 'bg-[#a3e635]');
  code = code.replace(/bg-cyan-400\/20/g, 'bg-[#a3e635]/20');
  code = code.replace(/bg-fuchsia-500\/20/g, 'bg-[#65a30d]/18');
  code = code.replace(/border-cyan-500\/50/g, 'border-[#a3e635]/50');
  code = code.replace(/rgba\(168,85,247,0\.22\)/g, 'rgba(101,163,13,0.18)');

  return code;
}

function patchEntryChunk(rawCode) {
  let code = rawCode;

  const jsxMatch = code.match(/([A-Za-z0-9_$]+)\.jsxs\("header"/);
  const jsxIdent = jsxMatch ? jsxMatch[1] : 'g';

  // Extract React namespace identifier (`k` in `k.useState(...)`)
  const reactMatch = code.match(/function\s+[A-Za-z0-9_$]+\(\)\{const\[[A-Za-z0-9_$,]+\]=([A-Za-z0-9_$]+)\.useState\(!1\);return/);
  const reactIdent = reactMatch ? reactMatch[1] : 'k';

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

  // 3. Video / Live-TV / Episode gate wrapper gA({children, label, fill}) -> render children directly
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\{children:([A-Za-z0-9_$]+),label:[A-Za-z0-9_$]+="content",fill:([A-Za-z0-9_$]+)=!1\}\)\{/,
    (m) =>
      `function ${m[1]}({children:${m[2]},fill:${m[3]}=!1}){return ${jsxIdent}.jsx("div",{className:${m[3]}?"relative h-full":"relative",children:${m[2]}})}`,
    'Stream/Video AdGate wrapper gA() -> direct children'
  ));

  // 4. Download unlock context provider T8({children, label="download"}) -> always execute immediately
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

  // 9. ZERO-LAG OPTIMIZATION: Kill WebGL2 30fps full-screen shader canvas U3() and hero pixel-readback z3()
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{[\s\S]*?liquid-bg-active/,
    (m) => `function ${m[1]}(){return null}`,
    'Zero-Lag: WebGL2 30fps full-screen shader loop U3() -> null'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\([A-Za-z0-9_$]+\)\{return new Promise\([A-Za-z0-9_$]+=>\{if\(typeof document>"u"\|\|![A-Za-z0-9_$]+\)return [A-Za-z0-9_$]+\([A-Za-z0-9_$]+\);const [A-Za-z0-9_$]+=new Image;/,
    (m) => `function ${m[1]}(){return Promise.resolve([.64,.9,.21])}`,
    'Zero-Lag: Hero canvas getImageData pixel readback z3() -> instant lime tint'
  ));

  // 10. DECLUTTER: Remove floating Feedback popup button F3() and SEO filler component NA({heading, paragraphs})
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{const\[[A-Za-z0-9_$,]+\]=[A-Za-z0-9_$]+\.useState\(!1\);return [A-Za-z0-9_$]+\.jsxs\([A-Za-z0-9_$]+\.Fragment,\{children:\[[A-Za-z0-9_$]+\.jsxs\("button",\{onClick:\(\)=>[A-Za-z0-9_$]+\(!0\),"aria-label":"Send feedback"/,
    (m) => `function ${m[1]}(){return null}`,
    'Declutter: Floating Feedback button & modal F3() -> null'
  ));

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\{heading:[A-Za-z0-9_$]+,paragraphs:[A-Za-z0-9_$]+\}\)\{return [A-Za-z0-9_$]+\.jsx\("section",\{className:"mx-auto max-w-\[1400px\] px-4 pb-14 pt-4/,
    (m) => `function ${m[1]}(){return null}`,
    'Declutter: Bottom SEO text filler block NA() -> null'
  ));

  // 11. REDESIGN HEADER kA() — Mukul Plus branding + Lime/White Theme Switcher + remove "Get App" & "AI Picks" clutter
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\{pinned:([A-Za-z0-9_$]+)=!0\}=\{\}\)\{/,
    (m, orig) => {
      const fnName = m[1];
      // Extract identifiers used inside original kA() so everything stays 100% bound to the exact bundle symbols
      const locHookM = orig.match(/([A-Za-z0-9_$]+)\(\{select:[A-Za-z0-9_$]+=>[A-Za-z0-9_$]+\.location\.pathname\}\)/);
      const linkCompM = orig.match(/\[([A-Za-z0-9_$]+)\.jsxs\(([A-Za-z0-9_$]+),\{to:"\/"/);
      const navArrM = orig.match(/([A-Za-z0-9_$]+)\.map\([A-Za-z0-9_$]+=>\{const [A-Za-z0-9_$]+=[A-Za-z0-9_$]+===[A-Za-z0-9_$]+\.matchPath/);
      const searchIconM = orig.match(/aria-label":"Search"[\s\S]{0,180}?children:[A-Za-z0-9_$]+\.jsx\(([A-Za-z0-9_$]+),/);
      const menuIconM = orig.match(/aria-label":"Open menu"[\s\S]{0,180}?children:[A-Za-z0-9_$]+\.jsx\(([A-Za-z0-9_$]+),/);
      const closeIconM = orig.match(/aria-label":"Close menu"[\s\S]{0,180}?children:[A-Za-z0-9_$]+\.jsx\(([A-Za-z0-9_$]+),/);

      if (!locHookM || !linkCompM || !navArrM || !searchIconM || !menuIconM || !closeIconM) {
        console.warn('  [warn] Could not extract all inner identifiers of kA(), keeping original header');
        return orig;
      }

      const locHook = locHookM[1];
      const LinkComp = linkCompM[2];
      const navArr = navArrM[1];
      const SearchIcon = searchIconM[1];
      const MenuIcon = menuIconM[1];
      const CloseIcon = closeIconM[1];

      // Inline crisp SVG Sun & Moon icons so zero external icon dependency is needed
      const sunSvg = `${jsxIdent}.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",className:"h-4 w-4",children:[${jsxIdent}.jsx("circle",{cx:"12",cy:"12",r:"4"}),${jsxIdent}.jsx("path",{d:"M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"})]})`;
      const moonSvg = `${jsxIdent}.jsx("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",className:"h-4 w-4",children:${jsxIdent}.jsx("path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"})})`;

      return `function ${fnName}({pinned:t=!0}={}){` +
        `const[a,i]=${reactIdent}.useState(!1),[s,l]=${reactIdent}.useState(!1),` +
        `[_th,_setTh]=${reactIdent}.useState(()=>typeof document<"u"&&document.documentElement.classList.contains("light")?"light":"dark"),` +
        `u=${locHook}({select:d=>d.location.pathname}),` +
        `_nav=${navArr}.filter(d=>d.to!=="/ai-recommendation"&&d.to!=="/app"),` +
        `_toggle=()=>{const n=_th==="dark"?"light":"dark";_setTh(n);if(typeof window<"u"&&window.__setMukulTheme)window.__setMukulTheme(n);};` +
        `${reactIdent}.useEffect(()=>{i(!1)},[u]);` +
        `${reactIdent}.useEffect(()=>{const d=()=>l(window.scrollY>8);return d(),window.addEventListener("scroll",d,{passive:!0}),()=>window.removeEventListener("scroll",d)},[]);` +
        `${reactIdent}.useEffect(()=>{const h=e=>{if(e?.detail)_setTh(e.detail)};return window.addEventListener("mukul-theme-change",h),()=>window.removeEventListener("mukul-theme-change",h)},[]);` +
        `${reactIdent}.useEffect(()=>{if(!a){document.body.style.overflow="";return}return document.body.style.overflow="hidden",()=>{document.body.style.overflow=""}},[a]);` +
        `return ${jsxIdent}.jsxs("header",{className:\`\${t?"sticky":"relative"} top-0 z-50\`,children:[` +
          `${jsxIdent}.jsx("div",{className:\`transition-colors duration-200 border-b \${s?"bg-[#070905]/92 backdrop-blur-md border-[#a3e635]/15 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.65)]":"bg-transparent border-transparent"}\`,children:` +
            `${jsxIdent}.jsxs("div",{className:"flex h-16 sm:h-18 items-center justify-between px-4 sm:px-6 lg:px-[50px]",children:[` +
              `${jsxIdent}.jsxs(${LinkComp},{to:"/",className:"flex items-center gap-2.5 shrink-0 group",children:[` +
                `${jsxIdent}.jsx("img",{src:"/mukul-logo.jpg",alt:"Mukul Plus",className:"h-9 w-9 sm:h-10 sm:w-10 rounded-xl shadow-[var(--shadow-glow)] object-cover ring-1 ring-[#a3e635]/30 transition group-hover:ring-[#a3e635]/70"}),` +
                `${jsxIdent}.jsxs("span",{className:"mukul-brand-title font-display text-lg sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-1.5",style:{letterSpacing:"-0.03em"},children:["Mukul",${jsxIdent}.jsx("span",{className:"mukul-plus-pill",children:"PLUS"})]})` +
              `]}),` +
              `${jsxIdent}.jsx("nav",{className:"hidden xl:flex shrink-0 items-center gap-1",children:_nav.map(d=>{const h=d.matchPath==="/"?u==="/":u===d.matchPath||u.startsWith(d.matchPath+"/");return ${jsxIdent}.jsxs(${LinkComp},{to:d.to,params:"params"in d?d.params:void 0,className:\`relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition \${h?"text-[#a3e635]":"text-muted-foreground hover:text-white"}\`,children:[d.label,h&&${jsxIdent}.jsx("span",{className:"absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[#a3e635] shadow-[0_0_10px_rgba(163,230,53,0.75)]"})]},d.label)})}),` +
              `${jsxIdent}.jsxs("div",{className:"flex items-center gap-2",children:[` +
                `${jsxIdent}.jsxs("button",{type:"button",onClick:_toggle,"aria-label":_th==="dark"?"Switch to Light Theme":"Switch to Dark Theme",title:_th==="dark"?"Light Theme (White & Lime)":"Dark Theme (Lime & Black)",className:"mukul-theme-btn",children:[_th==="dark"?${sunSvg}:${moonSvg},${jsxIdent}.jsx("span",{className:"hidden sm:inline",children:_th==="dark"?"Light":"Dark"})]}),` +
                `${jsxIdent}.jsx(${LinkComp},{to:"/search","aria-label":"Search",search:{q:void 0},className:"grid h-10 w-10 place-items-center rounded-full text-white/85 transition hover:bg-[#a3e635]/10 hover:text-[#a3e635]",children:${jsxIdent}.jsx(${SearchIcon},{className:"h-5 w-5"})}),` +
                `${jsxIdent}.jsx("button",{onClick:()=>i(!0),"aria-label":"Open menu",className:"xl:hidden grid h-10 w-10 place-items-center rounded-full text-white/85 transition hover:text-[#a3e635]",children:${jsxIdent}.jsx(${MenuIcon},{className:"h-6 w-6"})})` +
              `]})` +
            `]})` +
          `}),` +
          `a&&${jsxIdent}.jsxs(${jsxIdent}.Fragment,{children:[` +
            `${jsxIdent}.jsx("div",{className:"fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm xl:hidden",onClick:()=>i(!1)}),` +
            `${jsxIdent}.jsxs("div",{className:"fixed top-0 left-0 z-[100] h-screen w-[86vw] max-w-[340px] bg-[#0a0e07]/96 backdrop-blur-xl border-r border-[#a3e635]/15 shadow-2xl xl:hidden",children:[` +
              `${jsxIdent}.jsxs("div",{className:"flex h-16 items-center justify-between px-4 border-b border-[#a3e635]/15",children:[` +
                `${jsxIdent}.jsxs("div",{className:"flex items-center gap-2",children:[` +
                  `${jsxIdent}.jsx("img",{src:"/mukul-logo.jpg",alt:"Mukul Plus",className:"h-8 w-8 rounded-lg object-cover ring-1 ring-[#a3e635]/30"}),` +
                  `${jsxIdent}.jsxs("span",{className:"mukul-brand-title font-black text-lg tracking-tight text-white flex items-center gap-1.5",children:["MUKUL",${jsxIdent}.jsx("span",{className:"mukul-plus-pill",children:"PLUS"})]})` +
                `]}),` +
                `${jsxIdent}.jsx("button",{onClick:()=>i(!1),"aria-label":"Close menu",className:"grid h-9 w-9 place-items-center rounded-full glass",children:${jsxIdent}.jsx(${CloseIcon},{className:"h-5 w-5"})})` +
              `]}),` +
              `${jsxIdent}.jsxs("div",{className:"h-[calc(100vh-64px)] overflow-y-auto p-4 space-y-3",children:[` +
                `${jsxIdent}.jsxs("button",{type:"button",onClick:_toggle,className:"w-full flex items-center justify-between rounded-2xl px-4 py-3.5 text-xs font-bold uppercase tracking-wider border border-[#a3e635]/30 bg-[#a3e635]/12 text-[#a3e635]",children:[${jsxIdent}.jsxs("span",{className:"flex items-center gap-2",children:[_th==="dark"?${sunSvg}:${moonSvg},_th==="dark"?"Switch to White & Lime":"Switch to Black & Lime"]}),${jsxIdent}.jsx("span",{className:"rounded-full bg-[#a3e635] px-2 py-0.5 text-[10px] font-black text-[#070b02]",children:_th==="dark"?"DARK":"LIGHT"})]}),` +
                `${jsxIdent}.jsx("nav",{className:"space-y-2",children:_nav.map(d=>{const h=d.matchPath==="/"?u==="/":u===d.matchPath||u.startsWith(d.matchPath+"/");return ${jsxIdent}.jsx(${LinkComp},{to:d.to,params:"params"in d?d.params:void 0,className:\`flex items-center rounded-2xl px-4 py-3.5 text-xs font-bold uppercase tracking-wide transition \${h?"bg-[#a3e635] text-[#070b02]":"glass hover:bg-[#a3e635]/12"}\`,children:d.label},d.label)})})` +
              `]})` +
            `]})` +
          `]})` +
        `]})} `;
    },
    'Redesigned Header kA() -> Mukul Plus + Dual-Theme Switcher + Decluttered Nav'
  ));

  // 12. REDESIGN FOOTER e5() — Clean Mukul Plus footer without @hamyrabd social links or Get App bloat
  ({ code } = replaceFunctionBodyBySignature(
    code,
    /function\s+([A-Za-z0-9_$]+)\(\)\{return [A-Za-z0-9_$]+\.jsxs\("footer",\{className:"mt-16 border-t/,
    (m) => {
      return `function ${m[1]}(){const _cols=[` +
        `{title:"Watch",links:[{label:"Movies",href:"/movies"},{label:"Web Series",href:"/series"},{label:"Bangla Natok",href:"/category/drama"},{label:"Live TV",href:"/live-tv"}]},` +
        `{title:"Sports & Downloads",links:[{label:"Live Sports",href:"/sports"},{label:"Live Cricket",href:"/cricket"},{label:"Direct Downloads",href:"/downloads"}]},` +
        `{title:"Popular Platforms",links:[{label:"Chorki",href:"/provider/chorki"},{label:"Hoichoi",href:"/provider/hoichoi"},{label:"Netflix",href:"/provider/8"},{label:"Disney+",href:"/provider/337"}]},` +
        `{title:"Mukul Plus",links:[{label:"Home",href:"/"},{label:"Search Catalog",href:"/search"},{label:"Privacy",href:"/privacy"},{label:"Terms",href:"/terms"}]}` +
      `];return ${jsxIdent}.jsxs("footer",{className:"mt-14 border-t border-border bg-surface/60",children:[` +
        `${jsxIdent}.jsxs("div",{className:"mx-auto grid max-w-[1400px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.5fr_repeat(4,1fr)] lg:px-10",children:[` +
          `${jsxIdent}.jsxs("div",{children:[` +
            `${jsxIdent}.jsxs("a",{href:"/",className:"inline-flex items-center gap-2.5",children:[` +
              `${jsxIdent}.jsx("img",{src:"/mukul-logo.jpg",alt:"Mukul Plus",className:"h-9 w-9 rounded-xl object-cover ring-1 ring-[#a3e635]/30"}),` +
              `${jsxIdent}.jsxs("span",{className:"mukul-brand-title font-display text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-1.5",children:["Mukul",${jsxIdent}.jsx("span",{className:"mukul-plus-pill",children:"PLUS"})]})` +
            `]}),` +
            `${jsxIdent}.jsx("p",{className:"mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground",children:"Fast, lag-free HD movies, Bangla natok, web series, K-Drama, anime, live sports & 100+ TV channels — zero ads, instant playback."})` +
          `]}),` +
          `_cols.map(t=>${jsxIdent}.jsxs("nav",{"aria-label":t.title,children:[` +
            `${jsxIdent}.jsx("div",{className:"text-xs font-bold uppercase tracking-widest text-neon",children:t.title}),` +
            `${jsxIdent}.jsx("ul",{className:"mt-3 space-y-2 text-sm",children:t.links.map(a=>${jsxIdent}.jsx("li",{children:${jsxIdent}.jsx("a",{href:a.href,className:"text-foreground/80 transition hover:text-neon",children:a.label})},a.href))})` +
          `]},t.title))` +
        `]}),` +
        `${jsxIdent}.jsx("div",{className:"border-t border-border",children:${jsxIdent}.jsxs("div",{className:"mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10",children:[` +
          `${jsxIdent}.jsxs("span",{children:["© ",new Date().getFullYear()," Mukul Plus. Built for smooth HD streaming."]}),` +
          `${jsxIdent}.jsx("span",{children:"Mukul Plus indexes publicly available streams and hosts no media files."})` +
        `]})})` +
      `]})}`;
    },
    'Redesigned Clean Footer e5() -> Mukul Plus'
  ));

  // 13. Update Live TV watermark badge ("Hamyra" -> "Mukul+") and remove unneeded streambd-proxy heartbeat ping
  code = code.replace(
    /children:"Hamyra"\}\)\]\}\)\}\)\(\)\]\}/g,
    'children:"Mukul+"})]})})()]}'
  );
  code = code.replace(
    /fetch\("https:\/\/streambd-proxy\.aininjaibrahim\.workers\.dev\/\?ping=1"\)\.catch\(\(\)=>\{\}\)/g,
    'void 0'
  );

  // 14. Mobile bottom navigation active pill -> Electric Lime + Black ink
  code = code.replace(
    /bg-white\/20 text-white":"text-white\/55 hover:bg-white\/5 hover:text-white"/g,
    'bg-[#a3e635] text-[#070b02] shadow-[0_0_16px_rgba(163,230,53,0.45)]":"text-white/65 hover:bg-white/10 hover:text-white"'
  );
  code = code.replace(
    /bg-\[#0e0e10\]\/45/g,
    'bg-[#0a0e07]/90'
  );

  // 15. Hero primary Play button -> Signature Lime CTA
  code = code.replace(
    /rounded-full bg-white text-black px-7 sm:px-8 py-3 sm:py-3\.5 text-sm sm:text-base font-black shadow-\[0_10px_30px_-8px_rgba\(255,255,255,0\.45\)\]/g,
    'rounded-full bg-[#a3e635] text-[#070b02] px-7 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-black shadow-[0_10px_30px_-8px_rgba(163,230,53,0.55)]'
  );

  // Redirect `/live-tv/$ch` links on Homepage Top Channels directly to `/live-tv?ch=...` or via beforeLoad
  code = code.replace(
    /validateSearch:([A-Za-z0-9_$]+)=>\(\{s:typeof \1\.s=="number"\?\1\.s:void 0,cat:typeof \1\.cat=="string"\?\1\.cat:void 0,sport:typeof \1\.sport=="string"\?\1\.sport:void 0\}\),loader:async\(\{params:([A-Za-z0-9_$]+)\}\)=>\{try\{return await ([A-Za-z0-9_$]+)\(\2\.ch\)\}catch\{return null\}\}/,
    (m) => {
      const boMatch = code.match(/beforeLoad:\(\)=>\{throw ([A-Za-z0-9_$]+)\(\{to:"\/",replace:!0\}\)\}/);
      if (!boMatch) return m;
      const redirectFn = boMatch[1];
      console.log(`  [patched] Added instant beforeLoad redirect on /live-tv/$ch -> /live-tv?ch=$ch`);
      return `beforeLoad:({params:_p,search:_s})=>{throw ${redirectFn}({to:"/live-tv",search:{ch:_p.ch,s:_s?.s,cat:_s?.cat,sport:_s?.sport},replace:!0})},${m}`;
    }
  );

  // 16. Speed up splash screen fallback
  code = code.replace(/setTimeout\(kill,\s*900\)/g, 'setTimeout(kill,120)');

  // 17. Scrub hardcoded ad URLs
  code = code.replace(/https:\/\/www\.effectivecpmnetwork\.com\/[^\s"'`]+/g, 'about:blank');
  code = code.replace(/https:\/\/dischargeconceiteffort\.com\/[^\s"'`]+/g, 'about:blank');

  // 18. Universal SPA client mount on #app
  const headContentMatch = code.match(
    /function\s+[A-Za-z0-9_$]+\(\{children:[A-Za-z0-9_$]+\}\)\{return\s+[A-Za-z0-9_$]+\.jsxs\("html",\{[^}]*children:\[[A-Za-z0-9_$]+\.jsxs\("head",\{children:\[[A-Za-z0-9_$]+\.jsx\(([A-Za-z0-9_$]+),\{\}\)/
  );
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

  ({ code } = replaceFunctionBodyBySignature(
    code,
    /async function\s+([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+)\)\{const ([A-Za-z0-9_$]+)=window\.\$_TSR,/,
    (m, orig) => {
      const fnName = m[1];
      const routerVar = m[2];
      const guard = `if(!window.$_TSR){await ${routerVar}.load();const _sp=document.getElementById("mukul-splash");if(_sp){_sp.style.opacity="0";_sp.style.pointerEvents="none";setTimeout(()=>{_sp.style.display="none"},180)}return ${routerVar}}`;
      const bracePos = orig.indexOf('{');
      return `async function ${fnName}(${routerVar}){${guard}${orig.slice(bracePos + 1)}`;
    },
    'Universal SPA boot guard in Z2(router) when !window.$_TSR'
  ));

  code = replaceHydrateRootWithCreateRoot(code);

  // Apply global Mukul Plus brand + Lime theme palette
  code = applyBrandAndLimeThemeToJs(code);

  return code;
}

function patchSubChunk(filename, rawCode) {
  let code = rawCode;
  let modified = false;

  // 1. Patch ads-*.js completely (Adsterra Social Bar + ad keys)
  if (/^ads-[A-Za-z0-9_-]+\.js$/.test(filename)) {
    const exportMatch = code.match(/export\{([^}]+)\}/);
    if (exportMatch) {
      const specs = exportMatch[1].split(',').map((s) => s.trim());
      const decls = [];
      const outSpecs = [];
      specs.forEach((spec, idx) => {
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
      return { code, modified };
    }
  }

  // 2. Patch homepage chunk (`index-*.js` other than entry) -> remove "About Hamyra" & "Frequently Asked Questions" clutter via AST
  if (/^index-[A-Za-z0-9_-]+\.js$/.test(filename) && code.includes('Frequently Asked Questions')) {
    try {
      const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
      const removeSpans = [];
      function walkHome(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'ArrayExpression' && Array.isArray(node.elements)) {
          for (let idx = 0; idx < node.elements.length; idx++) {
            const el = node.elements[idx];
            if (!el) continue;
            const snippet = code.slice(el.start, el.end);
            if (
              el.type === 'CallExpression' &&
              el.arguments?.[0]?.type === 'Literal' &&
              el.arguments[0].value === 'section' &&
              snippet.includes('max-w-[900px]') &&
              (snippet.includes('children:"About ') || snippet.includes('children:"Frequently Asked Questions"'))
            ) {
              // Remove leading comma from previous element or trailing comma if first
              const prevEnd = idx > 0 && node.elements[idx - 1] ? node.elements[idx - 1].end : el.start;
              removeSpans.push([prevEnd, el.end]);
            }
          }
        }
        for (const k of Object.keys(node)) {
          if (k === 'start' || k === 'end' || k === 'loc') continue;
          const v = node[k];
          if (Array.isArray(v)) {
            for (const item of v) walkHome(item);
          } else if (v && typeof v.type === 'string') {
            walkHome(v);
          }
        }
      }
      walkHome(ast);
      if (removeSpans.length > 0) {
        removeSpans.sort((a, b) => b[0] - a[0]);
        for (const [s, e] of removeSpans) {
          code = code.slice(0, s) + code.slice(e);
        }
        // Verify AST parses cleanly after slicing
        acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
        modified = true;
        console.log(`  [patched] AST decluttered ${removeSpans.length} Homepage filler section(s) in ${filename}`);
      }
    } catch (e) {
      console.warn(`  [warn] Skipped Homepage filler AST removal in ${filename}: ${e.message}`);
    }
  }

  // 3. Patch MlbdRail-*.js red eyebrow -> lime neon eyebrow
  if (/^MlbdRail-[A-Za-z0-9_-]+\.js$/.test(filename)) {
    code = code.replace(/text-red-400/g, 'text-neon');
    code = code.replace(/bg-red-500/g, 'bg-neon');
    modified = true;
  }

  // 3b. Redirect `/live-tv/$ch` (`live-tv_._ch-*.js`) to `/live-tv?ch=$ch` so deep links like
  // `/live-tv/t-sports` load the working `/live-tv` route directly instead of upstream's broken `N8` copy!
  if (/^live-tv_\._ch-[A-Za-z0-9_-]+\.js$/.test(filename)) {
    const navMatch = code.match(/from"\.\/(index-[A-Za-z0-9_-]+\.js)"/);
    if (navMatch) {
      const entryFile = navMatch[1];
      const paramMatch = code.match(/import\{([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\s+as\s+[A-Za-z0-9_$]+,\s*[A-Za-z0-9_$]+\s+as\s+[A-Za-z0-9_$]+\}from/);
      if (paramMatch) {
        const routeExport = paramMatch[1];
        code =
          `import{${routeExport} as s,B as uNav,r as R}from"./${entryFile}";` +
          `function u(){const{ch:e}=s.useParams(),{s:t,cat:a,sport:o}=s.useSearch(),nav=uNav();` +
          `return R.useEffect(()=>{nav({to:"/live-tv",replace:!0,search:{ch:e,s:t,cat:a,sport:o}})},[e,t,a,o,nav]),null}` +
          `export{u as component};\n`;
        modified = true;
        console.log(`  [patched] Redirected ${filename} (/live-tv/$ch) -> /live-tv?ch=$ch`);
        return { code, modified };
      }
    }
  }

  // 4. Patch cricket-*.js local Adsterra iframe component & sidebar ad box
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

  // 5. Scrub residual ad domains in any chunk
  for (const domain of KNOWN_AD_DOMAINS) {
    if (code.includes(domain)) {
      const r = replaceFunctionBodyBySignature(
        code,
        /function\s+([A-Za-z0-9_$]+)\(\{adKey:[^}]+\}\)\{/,
        (m) => `function ${m[1]}(){return null}`,
        `${filename}: adKey component -> null`
      );
      code = r.code;
      code = code.replace(
        new RegExp(`https?:\\/\\/(?:www\\.)?${domain.replace('.', '\\.')}[^"'\\s\`]*`, 'g'),
        'about:blank'
      );
      modified = true;
      console.log(`  [patched] Scrubbed ${domain} from ${filename}`);
    }
  }

  // 6. Apply Mukul Plus brand & Lime palette across every sub-chunk
  const branded = applyBrandAndLimeThemeToJs(code);
  if (branded !== code) {
    code = branded;
    modified = true;
  }

  return { code, modified };
}

function patchStylesheet(rawCss, mukulThemeCss) {
  let css = rawCss;
  // Replace hardcoded cyan/teal hexes & glows in upstream Tailwind CSS with Electric Lime
  css = css.replace(/#2ad5e5|#22d3ee|#06b6d4/gi, '#a3e635');
  css = css.replace(/rgba\(42,\s*213,\s*229,/g, 'rgba(163,230,53,');
  css = css.replace(/rgba\(34,\s*211,\s*238,/g, 'rgba(163,230,53,');
  css = css.replace(/rgba\(56,\s*189,\s*248,/g, 'rgba(132,204,22,');
  // Append Mukul Plus Dual-Theme (Dark Lime/Black + Light White/Lime) & Zero-Lag rules at the end of CSS
  return `${css}\n\n${mukulThemeCss}\n`;
}

function discoverAssetReferences(content) {
  const foundAssets = new Set();
  const foundLogos = new Set();

  const assetRe1 =
    /(?:\/?assets\/|\bimport\s*\(\s*["']\.\/|\bfrom\s*["']\.\/)([A-Za-z0-9_.-]+\.(?:js|css|wasm|json|svg|png|webp|woff2?))/g;
  let m;
  while ((m = assetRe1.exec(content)) !== null) {
    foundAssets.add(m[1]);
  }

  const assetRe2 = /["']\.\/([A-Za-z0-9_.-]+\.(?:js|css))["']/g;
  while ((m = assetRe2.exec(content)) !== null) {
    foundAssets.add(m[1]);
  }

  const assetRe3 = /["']\/?assets\/([A-Za-z0-9_.-]+\.(?:js|css))["']/g;
  while ((m = assetRe3.exec(content)) !== null) {
    foundAssets.add(m[1]);
  }

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
    .slice(0, 10)
    .map((chunk) => `  <link rel="modulepreload" href="/assets/${chunk}" />`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Mukul Plus — Watch Free HD Movies, Bangla Natok, Web Series &amp; Live TV</title>
  <meta name="description" content="Stream and download free HD movies, Bangla natok, K-drama, web series, anime, live cricket &amp; 100+ TV channels on Mukul Plus — responsive, lag-free, zero ads." />
  <meta id="mukul-theme-meta" name="theme-color" content="#070905" />
  <meta name="application-name" content="Mukul Plus" />
  <meta name="apple-mobile-web-app-title" content="Mukul Plus" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta property="og:site_name" content="Mukul Plus" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${PROD_ORIGIN}" />
  <meta property="og:title" content="Mukul Plus — Fast HD Movies, Web Series, Live TV &amp; Downloads" />
  <meta property="og:description" content="Lag-free HD streaming &amp; direct downloads — movies, Bangla natok, K-Drama, web series, anime, live sports and 100+ TV channels on Mukul Plus." />
  <meta property="og:image" content="${PROD_ORIGIN}/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Mukul Plus — Free HD Streaming &amp; Downloads" />
  <meta name="twitter:image" content="${PROD_ORIGIN}/og-image.jpg" />

  <!-- Instant No-FOUC Dual Theme Boot (Dark: Lime & Black | Light: White & Lime) -->
  <script>
    (function () {
      function applyTheme(mode) {
        var root = document.documentElement;
        var isLight = mode === 'light';
        root.classList.toggle('light', isLight);
        root.classList.toggle('dark', !isLight);
        root.dataset.theme = isLight ? 'light' : 'dark';
        var meta = document.getElementById('mukul-theme-meta');
        if (meta) meta.setAttribute('content', isLight ? '#ffffff' : '#070905');
      }
      var saved = 'dark';
      try {
        saved = localStorage.getItem('mukul_theme') || 'dark';
      } catch (e) {}
      applyTheme(saved);
      window.__setMukulTheme = function (next) {
        var mode = next === 'light' ? 'light' : 'dark';
        try {
          localStorage.setItem('mukul_theme', mode);
        } catch (e) {}
        applyTheme(mode);
        try {
          window.dispatchEvent(new CustomEvent('mukul-theme-change', { detail: mode }));
        } catch (e) {}
      };
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

  <!-- High-Speed DNS & TLS Preconnects -->
  <link rel="preconnect" href="https://api.themoviedb.org" crossorigin />
  <link rel="preconnect" href="https://image.tmdb.org" crossorigin />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="dns-prefetch" href="https://edge.hamyra.xyz" />
  <link rel="dns-prefetch" href="https://cmos.raphsm4.dev" />
  <link rel="dns-prefetch" href="https://stela.raphsm4.dev" />
  <link rel="dns-prefetch" href="https://px.talkoraai.com" />

  <link rel="icon" type="image/png" href="/favicon.png" sizes="any" />
  <link rel="icon" type="image/webp" href="/mukul-logo.webp" sizes="any" />
  <link rel="apple-touch-icon" sizes="512x512" href="/mukul-icon-512.png" />
  <link rel="manifest" href="/site.webmanifest" />

  <link rel="preload" as="image" href="/mukul-logo.jpg" />
  <link rel="stylesheet" href="/assets/${entryCss}" data-precedence="default" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" data-precedence="default" />
  <link rel="modulepreload" href="/assets/${entryJs}" />
${preloadTags}

  <style>
    html.dark, html.dark body {
      background-color: #070905;
      color: #f4f7f0;
    }
    html.light, html.light body {
      background-color: #ffffff;
      color: #0c1308;
    }
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
    #mukul-splash {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #070905;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 14px;
      transition: opacity 0.18s ease-out;
    }
    html.light #mukul-splash {
      background: #ffffff;
    }
    #mukul-splash img {
      width: 82px;
      height: 82px;
      border-radius: 22px;
      box-shadow: 0 0 36px -6px rgba(163, 230, 53, 0.55);
    }
    #mukul-splash .brand {
      font-family: 'Space Grotesk', system-ui, sans-serif;
      font-weight: 900;
      letter-spacing: -0.03em;
      font-size: 25px;
      color: #f4f7f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    html.light #mukul-splash .brand {
      color: #0f1a06;
    }
    #mukul-splash .brand span {
      background: linear-gradient(135deg, #bef264, #84cc16);
      color: #070b02;
      font-size: 12px;
      padding: 3px 9px;
      border-radius: 999px;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div id="mukul-splash">
    <img src="/mukul-logo.jpg" alt="Mukul Plus" />
    <div class="brand">MUKUL <span>PLUS</span></div>
  </div>
  <div id="app"></div>
  <script>
    (function () {
      var kill = function () {
        var s = document.getElementById('mukul-splash');
        if (!s) return;
        s.style.opacity = '0';
        s.style.pointerEvents = 'none';
        setTimeout(function () { if (s) s.style.display = 'none'; }, 200);
      };
      window.addEventListener('hamyra-hide-splash', kill, { once: true });
      setTimeout(kill, 500);
    })();
  </script>
  <script type="module" src="/assets/${entryJs}"></script>
</body>
</html>
`;
}

async function main() {
  console.log('=== Building Mukul Plus (Dual-Theme Lime/Black & White/Lime, Lag-Free) ===');
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await fs.mkdir(LOGOS_DIR, { recursive: true });

  const mukulThemeCss = await fs.readFile(path.join(PUBLIC_DIR, 'mukul-theme.css'), 'utf8');

  // 1. Discover upstream HTML (live fetch with bundled snapshot fallback)
  let upstreamHtml = '';
  try {
    console.log(`Fetching upstream HTML from ${UPSTREAM_ORIGIN}/ via Impit Chrome TLS...`);
    const htmlRes = await fetchWithRetry(`${UPSTREAM_ORIGIN}/`, {}, 2);
    if (htmlRes) {
      upstreamHtml = await htmlRes.text();
      console.log(`Fetched live upstream HTML (${upstreamHtml.length} chars)`);
    }
  } catch (err) {
    console.warn(`[warn] Live HTML fetch unavailable (${err.message}); using bundled upstream/index.html snapshot`);
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

  const initialPreloads = [];
  for (const m of upstreamHtml.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+)"/g)) {
    if (m[1] !== entryJs) initialPreloads.push(m[1]);
  }

  // 2. Probe upstream APIs for CORS behavior (default to true if sandbox blocks direct egress)
  const needEdgeProxy = await checkCorsNeed('https://edge.hamyra.xyz/bongo/sports');
  const needApiHamyraProxy = await checkCorsNeed('https://api.hamyra.xyz/mlbd/list?page=1');
  const needTmdbHlsProxy = await checkCorsNeed('https://edge.hamyra.xyz/tmdb/hls');
  console.log(
    `CORS Proxy config -> /_edge: ${needEdgeProxy}, /_apihamyra: ${needApiHamyraProxy}, edge/tmdb/hls: ${needTmdbHlsProxy}`
  );

  // 3. Crawl & Download all JS/CSS assets + channel logos
  const assetQueue = [entryJs, entryCss, ...initialPreloads];
  const downloadedAssets = new Set();
  const logoQueue = new Set();

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

    if (assetName.endsWith('.css')) {
      text = patchStylesheet(text, mukulThemeCss);
    } else if (assetName.endsWith('.js')) {
      if (assetName === entryJs) {
        console.log(`Patching main entry bundle ${assetName}...`);
        text = patchEntryChunk(text);
      } else {
        const patched = patchSubChunk(assetName, text);
        text = patched.code;
      }

      // Route CORS-restricted JSON API calls via `/_edge` and `/_apihamyra` (non-`/api/` prefixes so Vercel's
      // filesystem `/api/*` router never shadows our `vercel.json` rewrites!), while keeping high-bandwidth
      // direct media/video/HLS segments (`bongo/hls`, `bongo/live`, `tmdb/seg`, `mlbd/stream`, `download/apk`) direct!
      if (needEdgeProxy) {
        const directMediaPattern = needTmdbHlsProxy
          ? 'bongo\\/hls|bongo\\/live|tmdb\\/seg|mlbd\\/stream|download\\/apk'
          : 'bongo\\/hls|bongo\\/live|tmdb\\/hls|tmdb\\/seg|mlbd\\/stream|download\\/apk';

        text = text.replace(
          new RegExp(`\`\\$\\{([A-Za-z0-9_$]+)\\}\\/(${directMediaPattern})`, 'g'),
          '`https://edge.hamyra.xyz/$2'
        );
        text = text.replace(
          /"https:\/\/edge\.hamyra\.xyz"/g,
          '(typeof location<"u"?location.origin+"/_edge":"https://edge.hamyra.xyz")'
        );
        text = text.replace(
          new RegExp(`"https:\\/\\/edge\\.hamyra\\.xyz\\/(?!${directMediaPattern})([^"]*)"`, 'g'),
          '((typeof location<"u"?location.origin+"/_edge":"https://edge.hamyra.xyz")+"/$1")'
        );
        text = text.replace(
          new RegExp(`\`https:\\/\\/edge\\.hamyra\\.xyz\\/(?!${directMediaPattern})`, 'g'),
          '`${typeof location<"u"?location.origin+"/_edge":"https://edge.hamyra.xyz"}/'
        );
      }

      if (needApiHamyraProxy) {
        // Keep `/mlbd/hls/mp4` direct for `<video>` streaming while proxying JSON API calls through `/_apihamyra`
        text = text.replace(
          /"https:\/\/api\.hamyra\.xyz"/g,
          '(typeof location<"u"?location.origin+"/_apihamyra":"https://api.hamyra.xyz")'
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

  // 4. Download channel logos
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

  // 5. Copy custom Mukul Plus brand icons & OG image from `public/` into `dist/`
  const publicFiles = await fs.readdir(PUBLIC_DIR);
  for (const file of publicFiles) {
    if (file === 'mukul-theme.css') continue;
    await fs.copyFile(path.join(PUBLIC_DIR, file), path.join(DIST_DIR, file));
  }

  // 6. Generate Mukul Plus PWA `site.webmanifest` and `robots.txt`
  const manifestJson = JSON.stringify(
    {
      name: 'Mukul Plus — HD Movies, Series & Live TV',
      short_name: 'Mukul Plus',
      description: 'Lag-free HD movies, Bangla natok, web series, live sports & direct downloads.',
      start_url: '/',
      display: 'standalone',
      background_color: '#070905',
      theme_color: '#a3e635',
      icons: [
        { src: '/favicon.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/mukul-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    null,
    2
  );
  await fs.writeFile(path.join(DIST_DIR, 'site.webmanifest'), manifestJson, 'utf8');
  await fs.writeFile(path.join(DIST_DIR, 'robots.txt'), `User-agent: *\nAllow: /\n`, 'utf8');

  // 7. Verify zero residual ad-network URLs across all JS files
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

  // 8. Generate Mukul Plus SPA `dist/index.html`
  const cleanHtml = buildCleanIndexHtml({
    entryJs,
    entryCss,
    preloadChunks: initialPreloads,
  });
  await fs.writeFile(path.join(DIST_DIR, 'index.html'), cleanHtml, 'utf8');
  console.log('Generated Mukul Plus Dual-Theme dist/index.html');
  console.log('=== Mukul Plus Build Completed Successfully! ===');
}

main().catch((err) => {
  console.error('BUILD FAILED:', err);
  process.exit(1);
});

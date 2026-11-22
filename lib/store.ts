/**
 * SiteHub storage layer.
 *
 * দুটো ড্রাইভার:
 *  - local   : ফাইল সিস্টেমে (ডেভেলপমেন্ট / VPS / cPanel-এ unzip করে চালালে)
 *  - supabase: Supabase Storage-এ (Vercel-এর read-only ফাইল সিস্টেমের জন্য)
 *
 * সব ফাংশন async — অ্যাপের বাকি অংশ দুই ড্রাইভারেই একই কোডে চলে।
 */
import path from 'node:path';

export type Site = {
  name: string;
  createdAt: string;
  updatedAt: string;
  indexFile: string | null;
  fileCount: number;
  bytes: number;
};

const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const MAX_SITES = 20;
const MAX_FILES_PER_SITE = 400;
const MAX_FILE_BYTES = 1024 * 1024; // 1 MiB / file

export function isValidSiteName(name: string): boolean {
  if (!NAME_RE.test(name)) return false;
  if (name.startsWith('-') || name.endsWith('-')) return false;
  return name !== 'www';
}

export function normalizeFilePath(input: string): string | null {
  const cleaned = input
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/{2,}/g, '/')
    .trim();
  if (!cleaned || cleaned.length > 300) return null;
  if (cleaned.startsWith('/') || cleaned.endsWith('/')) return null;
  const parts = cleaned.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;
  if (parts.some((p) => p.startsWith('__'))) return null; // internal namespace
  return cleaned;
}

export function assertFileSize(size: number) {
  if (size > MAX_FILE_BYTES) {
    throw new Error(`ফাইলটি বড় (${(size / 1024 / 1024).toFixed(2)} MB)। সর্বোচ্চ ১ MB।`);
  }
}

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  wasm: 'application/wasm',
  pdf: 'application/pdf',
  xml: 'application/xml; charset=utf-8',
  webmanifest: 'application/manifest+json',
};

export function mimeFor(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

export function isTextFile(file: string): boolean {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return ['html', 'htm', 'css', 'js', 'mjs', 'json', 'md', 'txt', 'svg', 'xml', 'webmanifest', 'yml', 'yaml'].includes(ext);
}

export interface Driver {
  list(): Promise<Site[]>;
  get(name: string): Promise<Site | null>;
  create(name: string): Promise<Site>;
  remove(name: string): Promise<void>;
  touch(name: string): Promise<void>;

  readFile(site: string, file: string): Promise<Buffer | null>;
  writeFile(site: string, file: string, data: Buffer | string): Promise<void>;
  deleteFile(site: string, file: string): Promise<void>;
  listFiles(site: string): Promise<string[]>;
  /** ফাইল ও সাইট ডিলিট করে site-এর মেটাডাটা রিফ্রেশ করে */
  afterChange(site: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* local ড্রাইভার                                                      */
/* ------------------------------------------------------------------ */

function localDriver(): Driver {
  const fs = require('node:fs/promises') as typeof import('node:fs/promises');
  const root = path.resolve(process.env.DATA_DIR || '.data');
  const sitesDir = path.join(root, 'sites');
  const metaDir = path.join(root, 'meta');

  const siteDir = (name: string) => path.join(sitesDir, name);
  const metaFile = (name: string) => path.join(metaDir, `${name}.json`);

  const safeJoin = (name: string, file: string) => {
    const norm = normalizeFilePath(file);
    if (!norm) throw new Error('অবৈধ ফাইল পাথ');
    const abs = path.join(siteDir(name), norm);
    if (!abs.startsWith(siteDir(name) + path.sep)) throw new Error('অবৈধ ফাইল পাথ');
    return abs;
  };

  async function walk(dir: string, prefix = ''): Promise<string[]> {
    let out: string[] = [];
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) out = out.concat(await walk(path.join(dir, e.name), rel));
      else if (e.isFile()) out.push(rel);
    }
    return out.sort();
  }

  async function readMeta(name: string): Promise<Site | null> {
    try {
      const raw = await fs.readFile(metaFile(name), 'utf8');
      return JSON.parse(raw) as Site;
    } catch {
      return null;
    }
  }

  async function buildMeta(name: string, prev?: Site | null): Promise<Site> {
    const files = await walk(siteDir(name));
    let bytes = 0;
    for (const f of files) {
      try {
        const st = await fs.stat(path.join(siteDir(name), f));
        bytes += st.size;
      } catch {}
    }
    const index =
      files.find((f) => f === 'index.html') ??
      files.find((f) => f.endsWith('/index.html')) ??
      files.find((f) => f.endsWith('.html')) ??
      null;
    const now = new Date().toISOString();
    const meta: Site = {
      name,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      indexFile: index,
      fileCount: files.length,
      bytes,
    };
    await fs.mkdir(metaDir, { recursive: true });
    await fs.writeFile(metaFile(name), JSON.stringify(meta, null, 2));
    return meta;
  }

  return {
    async list() {
      try {
        const entries = await fs.readdir(sitesDir, { withFileTypes: true });
        const metas = await Promise.all(
          entries.filter((e) => e.isDirectory()).map((e) => readMeta(e.name)),
        );
        return metas
          .filter((m): m is Site => !!m)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } catch {
        return [];
      }
    },
    get: readMeta,
    async create(name) {
      const existing = await this.list();
      if (existing.length >= MAX_SITES) throw new Error(`সর্বোচ্চ ${MAX_SITES}টি সাইট রাখা যাবে।`);
      await fs.mkdir(siteDir(name), { recursive: true });
      return buildMeta(name);
    },
    async remove(name) {
      await fs.rm(siteDir(name), { recursive: true, force: true });
      await fs.rm(metaFile(name), { force: true });
    },
    async touch(name) {
      await buildMeta(name, await readMeta(name));
    },
    async readFile(site, file) {
      try {
        return await fs.readFile(safeJoin(site, file));
      } catch {
        return null;
      }
    },
    async writeFile(site, file, data) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      assertFileSize(buf.byteLength);
      const abs = safeJoin(site, file);
      const files = await walk(siteDir(site));
      if (files.length >= MAX_FILES_PER_SITE && !files.includes(file)) {
        throw new Error(`সাইটে সর্বোচ্চ ${MAX_FILES_PER_SITE}টি ফাইল রাখা যাবে।`);
      }
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buf);
      await buildMeta(site, await readMeta(site));
    },
    async deleteFile(site, file) {
      await fs.rm(safeJoin(site, file), { force: true });
      await buildMeta(site, await readMeta(site));
    },
    async listFiles(site) {
      return walk(siteDir(site));
    },
    async afterChange(site) {
      await buildMeta(site, await readMeta(site));
    },
  };
}

/* ------------------------------------------------------------------ */
/* supabase ড্রাইভার                                                   */
/* ------------------------------------------------------------------ */

function supabaseDriver(): Driver {
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || 'sitehub';
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY সেট করা নেই');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const metaPath = (name: string) => `__meta/${name}.json`;
  const filePath = (name: string, file: string) => `sites/${name}/${file}`;

  async function readMeta(name: string): Promise<Site | null> {
    const { data, error } = await db.storage.from(bucket).download(metaPath(name));
    if (error || !data) return null;
    try {
      return JSON.parse(await data.text()) as Site;
    } catch {
      return null;
    }
  }

  async function listFiles(name: string): Promise<string[]> {
    const out: string[] = [];
    async function walk(prefix: string) {
      const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
      if (error || !data) return;
      for (const item of data) {
        const full = `${prefix}/${item.name}`;
        if (item.id === null) await walk(full); // folder
        else out.push(full.replace(`sites/${name}/`, ''));
      }
    }
    await walk(`sites/${name}`);
    return out.sort();
  }

  async function buildMeta(name: string, prev?: Site | null): Promise<Site> {
    const files = await listFiles(name);
    let bytes = 0;
    for (const f of files) {
      const { data } = await db.storage.from(bucket).list(`sites/${name}/${f.split('/').slice(0, -1).join('/')}`, {
        search: f.split('/').pop(),
      });
      bytes += data?.[0]?.metadata?.size ?? 0;
    }
    const index =
      files.find((f) => f === 'index.html') ??
      files.find((f) => f.endsWith('/index.html')) ??
      files.find((f) => f.endsWith('.html')) ??
      null;
    const now = new Date().toISOString();
    const meta: Site = {
      name,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      indexFile: index,
      fileCount: files.length,
      bytes,
    };
    await db.storage.from(bucket).upload(metaPath(name), JSON.stringify(meta), {
      contentType: 'application/json',
      upsert: true,
    });
    return meta;
  }

  return {
    async list() {
      const { data, error } = await db.storage.from(bucket).list('__meta', { limit: 1000 });
      if (error || !data) return [];
      const sites = await Promise.all(
        data.filter((d) => d.name.endsWith('.json')).map((d) => readMeta(d.name.replace(/\.json$/, ''))),
      );
      return sites.filter((s): s is Site => !!s).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    get: readMeta,
    async create(name) {
      const existing = await this.list();
      if (existing.length >= MAX_SITES) throw new Error(`সর্বোচ্চ ${MAX_SITES}টি সাইট রাখা যাবে।`);
      return buildMeta(name);
    },
    async remove(name) {
      const files = await listFiles(name);
      if (files.length) {
        await db.storage.from(bucket).remove(files.map((f) => filePath(name, f)));
      }
      await db.storage.from(bucket).remove([metaPath(name)]);
    },
    async touch(name) {
      await buildMeta(name, await readMeta(name));
    },
    async readFile(site, file) {
      const norm = normalizeFilePath(file);
      if (!norm) return null;
      const { data, error } = await db.storage.from(bucket).download(filePath(site, norm));
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },
    async writeFile(site, file, data) {
      const norm = normalizeFilePath(file);
      if (!norm) throw new Error('অবৈধ ফাইল পাথ');
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      assertFileSize(buf.byteLength);
      const files = await listFiles(site);
      if (files.length >= MAX_FILES_PER_SITE && !files.includes(norm)) {
        throw new Error(`সাইটে সর্বোচ্চ ${MAX_FILES_PER_SITE}টি ফাইল রাখা যাবে।`);
      }
      const { error } = await db.storage.from(bucket).upload(filePath(site, norm), buf, {
        contentType: mimeFor(norm),
        upsert: true,
      });
      if (error) throw new Error(error.message);
      await buildMeta(site, await readMeta(site));
    },
    async deleteFile(site, file) {
      const norm = normalizeFilePath(file);
      if (!norm) throw new Error('অবৈধ ফাইল পাথ');
      await db.storage.from(bucket).remove([filePath(site, norm)]);
      await buildMeta(site, await readMeta(site));
    },
    listFiles,
    async afterChange(site) {
      await buildMeta(site, await readMeta(site));
    },
  };
}

let cached: Driver | null = null;

export function store(): Driver {
  if (cached) return cached;
  cached = (process.env.STORAGE_DRIVER || 'local').toLowerCase() === 'supabase'
    ? supabaseDriver()
    : localDriver();
  return cached;
}

export function friendlyStorageError(e: Error): string {
  const msg = e?.message || 'সেভ ব্যর্থ';
  if (/EROFS|read-only file system|ENOENT: no such file|permission denied/i.test(msg)) {
    return 'এই হোস্টে লোকাল ডিস্ক read-only — Supabase স্টোরেজ সেট করুন (STORAGE_DRIVER=supabase)।';
  }
  return msg;
}

export const LIMITS = {
  maxSites: MAX_SITES,
  maxFilesPerSite: MAX_FILES_PER_SITE,
  maxFileBytes: MAX_FILE_BYTES,
};

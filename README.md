# MovieLinkBD — ad-free movie & series index

A complete rebuild of the MovieLinkBD gateway (`pzpn8a.movielinkbd.at`) as a clean,
**100% ad-free**, premium-looking PHP application with a documented JSON API on top of
a real database (SQLite by default, MySQL ready).

| | |
|---|---|
| **Stack** | PHP 8.2+ (no framework, no Composer), SQLite / MySQL, vanilla CSS/JS |
| **Frontend** | Custom dark-luxe design system, ~0 external requests |
| **Data** | 108 real titles harvested from the live homepage, 24 genres, 12 collections, 17 OTT platforms, ~1 000 episodes |
| **API** | 17 documented JSON endpoints (`/api`) with rate limiting + request log |
| **Admin** | Session login, title CRUD, endpoint browser, runtime settings |
| **Ads** | Removed entirely: no Adsterra/Monetag/AdSense/Ezoic, no popunders, no click-jacking |

---

## 1. What was wrong with the old page

The captured homepage (`home.html`, 470 KB) contained:

| Problem | Where | Fixed by |
|---|---|---|
| 4 different ad networks injected at runtime (Monetag meta + runtime, Adsterra `atOptions`, `mlbd-adopen.php` popunder beacons, DoubleClick pre-roll probe) | lines 2800–3841, 5319, 7176 | removed — `templates/` contains no ad markup at all, enforced by `php bin/console.php check` |
| Click-hijacking: `data-mlbd-click-ad` on every poster, `#mlbd-display-ads-v20-runtime` rewrote links | 166 cards | every link is a plain first-party `<a href>` |
| Tracker/redirect hack: iOS visitors force-redirected to `movielinkbd.tv` | line 4 | removed |
| Google Tag Manager + Cloudflare beacon | head | removed (CSP blocks third-party scripts) |
| 2 × 700 KB inline `<style>` blocks + 4 duplicated CSS variables sets | 5 K–200 K | replaced by one 18 KB stylesheet |
| Duplicate `data-18` / `data-pin` attributes, nested `<div class="movie-card">` closures | cards | server-rendered, valid markup |
| `noindex, nofollow` on the entire site | meta robots | per-page robots, sitemaps + robots.txt |
| `/continue/{key}` links that only worked with ads enabled | 5 links | `/continue/{key}` is now a real route |
| 6 separate ad “slots” holding empty space | layout | replaced by real content rails |

`php bin/console.php check` scans the templates for ad markers on every run.

---

## 2. Quick start

```bash
git clone <repo> && cd New-progect
cp .env.example .env                 # edit APP_URL / admin password

php bin/console.php migrate --seed   # creates the DB + imports the catalogue
php bin/console.php check            # environment / ad / DB self-test
php bin/smoke-test.php http://localhost:8080   # 62 end-to-end assertions
php -S 0.0.0.0:8080 -t public public/router.php
# open http://localhost:8080
```

No PHP on the machine? A PHP-WASM dev server is included:

```bash
npm install
npm run dev      # http://0.0.0.0:8080
```

**Admin panel:** `/admin` → the first login uses `ADMIN_USERNAME` / `ADMIN_PASSWORD`
from `.env` and stores a bcrypt hash in the `settings` table. Change it immediately:

```bash
php bin/console.php admin:password 'a-strong-passphrase'
```

---

## 3. Project layout

```
public/                  ← web root (point Apache/Nginx here)
  index.php              front controller
  router.php             PHP built-in server router
  assets/css/app.css     design system (18 KB)
  assets/css/admin.css   admin panel styles
  assets/js/app.js       UI: lazy posters, search suggest, drawer, notices
src/
  bootstrap.php          autoloader + error handling
  View.php               PHP template renderer
  Core/                  App, Router, Request, Response, Database, Config, Env,
                         RateLimiter
  Repository/            Title, Genre, Collection, Ott, Notice, Setting, Endpoint
  Controller/            Web, Api, Admin, Sitemap
templates/               layouts/, partials/, pages/, admin/, errors/
config/                  app.php, database.php, site.php, navigation.php
database/
  schema.sqlite.sql      SQLite DDL
  schema.mysql.sql       MySQL/MariaDB DDL
  seed.php               generated catalogue (108 titles)
  endpoints.php          API registry (single source of truth)
bin/console.php          migrate / seed / check / routes / admin:password
tools/                   build_seed.py (harvester), dev-bridge.mjs (PHP-WASM)
```

---

## 4. Routes

**Pages** — `/`, `/page/{n}`, `/type/{movies|series}`, `/anime`, `/drama`,
`/southIndian`, `/adult18plus`, `/language/{slug}`, `/genre/{slug}`,
`/collections`, `/collection/{slug}`, `/ott`, `/ott/{slug}`, `/search`,
`/upcoming`, `/latest`, `/ongoing`, `/trending`, `/live`,
`/{type}/{slug}`, `/download/{type}/{slug}`, `/continue/{key}`,
`/sitemap.xml`, `/sitemap-titles.xml`, `/sitemap-taxonomy.xml`,
`/robots.txt`, `/manifest.webmanifest`, `/admin/*`.

**API** — see `/api` (rendered docs) or `/api/index.json`. Envelope:

```json
{ "ok": true, "data": { … }, "meta": { "total": 108, "page": 1 } }
```

| Endpoint | Purpose | Key params |
|---|---|---|
| `GET /api/health.json` | liveness probe | — |
| `GET /api/titles.json` | filtered catalogue | `q,type,language,genre,collection,ott,status,sort,page,per_page,adult` |
| `GET /api/titles/{slug}.json` | full title detail | — |
| `GET /api/home.json` | homepage payload | — |
| `GET /api/search.json` | full-text search | `q` (required) |
| `GET /api/suggest.json` | header autocomplete | `q`, `limit` |
| `GET /api/trending.json` | most viewed | `limit` |
| `GET /api/latest.json` | newest | `limit` |
| `GET /api/upcoming.json` | release calendar | `limit` |
| `GET /api/collection/{slug}.json` | curated collection | `limit` |
| `GET /api/genres.json` | genres + counts | — |
| `GET /api/languages.json` | languages + counts | — |
| `GET /api/ott.json` | platforms + counts | — |
| `GET /api/notices.json` | active notices | — |
| `GET /api/stats.json` | catalogue + traffic stats | — |
| `GET /api/index.json` | machine-readable index | — |
| `GET /api` | human documentation | — |

Rate limit: 90 requests/min/IP (`RATE_LIMIT_PER_MINUTE`), with `X-RateLimit-*`
headers and `429` + `Retry-After` when exceeded. Every API call is logged to
`api_logs` (auto-trimmed to 7 days) and surfaced in the admin dashboard.

---

## 5. Database

SQLite is the default (`DB_DRIVER=sqlite`) and needs zero configuration — the file
`database/movielinkbd.sqlite` is created by `migrate`. To use MySQL:

```ini
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_NAME=movielinkbd
DB_USER=app
DB_PASS=secret
```

then `php bin/console.php migrate --fresh --seed` (it applies
`database/schema.mysql.sql` instead). Tables:

`titles`, `genres`, `title_genres`, `collections`, `collection_items`,
`ott_platforms`, `download_links`, `episodes`, `notices`, `pages`,
`settings`, `api_endpoints`, `api_logs`.

Re-generating the catalogue from the harvested HTML:

```bash
python3 tools/build_seed.py     # reads tools/_titles.json → database/seed.php
php bin/console.php seed
```

---

## 6. Security & privacy

- Prepared statements everywhere (`App\Core\Database`), no string concatenation.
- Output escaped through `e()`; strict CSP, `nosniff`, `SAMEORIGIN`, referrer policy.
- CSRF tokens on every admin POST; bcrypt password hashing; sessions stored in
  `storage/sessions` with `HttpOnly` + `SameSite=Lax` cookies.
- Server-side rate limiter (no Redis needed).
- No cookies for visitors, no analytics, no third-party embeds. The only client
  storage is a local “recently viewed” list that never leaves the browser.

---

## 7. Deployment

**Nginx + PHP-FPM**

```nginx
server {
    listen 443 ssl http2;
    server_name movielinkbd.at;
    root /var/www/movielinkbd/public;   # ← public, never the repo root

    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }
    location ~* \.(css|js|woff2|png|jpg|webp|svg)$ { expires 30d; access_log off; }
}
```

**Apache** — `DocumentRoot /var/www/movielinkbd/public` plus the standard
`mod_rewrite` fallback to `index.php`.

After deploying: `cp .env.example .env`, set `APP_URL`, run
`php bin/console.php migrate --seed`, `chmod -R u+w storage database`.

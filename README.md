# ChinFetcher — Movie & TV Aggregator

Static, zero-build website powered by the ChinFetcher API (`https://chinfetcher.duckdns.org`).

## Deploy on Vercel (drag & drop)

1. Download `chinfetcher-vercel.zip`
2. Go to https://vercel.com/new
3. Drag the zip onto the upload area (or click "Deploy" after dropping)
4. Done — no build step, no environment variables

`index.html` sits at the zip root, so Vercel serves it directly as a static site.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

```
index.html          app shell (hero, browse, search, series, modals)
assets/app.css      design system — dark/light, responsive, skeletons
assets/api.js       API client — cache, retry, CORS relay fallback, parsers
assets/app.js       UI logic — providers, browse, detail, player, favorites
vercel.json         static hosting config (cache headers, clean URLs)
robots.txt
```

## Features

- All 14 providers from `/api/providers`
- Categories via `/api/catalog`, infinite scroll via `/api/posts`
- Multi-provider parallel search via `/api/search`
- Detail pages: quality-grouped servers, sizes, episode lists
- Player: HLS (hls.js), MP4 and embed fallback with source switching
- Favorites (localStorage), dark/light theme, mobile bottom nav
- 90s response cache, retry with backoff, CORS relay fallback

See `api-endpoints.md` for the verified endpoint map.

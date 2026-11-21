# Hamyra — Fast, 100% Ad-Free Streaming & Download Web App

A high-performance, 100% ad-free Vercel deployment of Hamyra featuring instant playback, unlocked direct downloads, live sports, and 100+ live TV channels.

## Key Enhancements Over Upstream

1. **100% Ad-Free & Zero Popups**
   - Permanently bypasses all `"Watch a quick ad to unlock this video / episode / channel / download"` overlays and 1-hour lock timers (`Af`, `mA`, `gA`, `Cf`, `T8`).
   - Completely eliminates `effectivecpmnetwork.com` popup tabs (`pA`).
   - Removes all inline banner ads across Home, Movies, Series, Sports, and Downloads (`CA` & banner ad components).
   - Removes Adsterra Social Bar & sidebar iframe scripts (`dischargeconceiteffort.com` in `ads-*.js` and `cricket-*.js`).

2. **Substantially Faster Load & Playback Startup**
   - Eliminates the **4,000 ms Cloudflare Turnstile timeout bottleneck** (`V5` / `hw`) that otherwise stalls authenticated catalog & download resolution on custom/Vercel domains.
   - Removes the **400 ms `debugger` polling loop** (`H3`), DevTools `window.fetch` wrapper (`AN`), and right-click/keyboard blockers (`a5`).
   - Removes pageview and `__navguard` background telemetry (`u5`, `Gd`, `iN`).
   - Replaces route-fragile SSR document hydration with a clean universal SPA client mount + `Cache-Control: public, max-age=31536000, immutable` on all hashed Vite chunks + DNS/TLS `preconnect` hints.

3. **Full Feature Parity**
   - Movies, Web Series, Bangla Natok, K-Drama, Anime, Multi-Server Picker, Subtitles, Dual-Audio tracks, Direct 480p/720p/1080p/4K Downloads, 100+ Live TV Channels, Live Cricket & Sports Scorecards, AI Movie Picks, Watch Party, Continue Watching, and My List.
   - Edge proxy (`api/proxy.js`) seamlessly handles TanStack `_serverFn` RPCs and CORS headers with low-latency Vercel Edge caching.

## Deployment

Push to GitHub and deploy directly on Vercel (`npm run build` outputs static assets to `dist/` alongside Vercel Edge Functions in `api/proxy.js`).

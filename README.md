# Mukul Plus (`mukul-plus08.vercel.app`)

Fast, responsive, 100% ad-free HD streaming & direct download web platform featuring a custom **Dual-Theme Design System**:
- **Dark Theme (Default)**: Matte Obsidian Black (`#070905`) + Electric Lime (`#a3e635`)
- **Light Theme**: Pure Crisp White (`#ffffff`) + Fresh Lime (`#65a30d` / `#84cc16`)

## Key Enhancements
1. **Complete Rebrand to Mukul Plus**: Custom neon-lime `M+` brand identity, app icons, OpenGraph preview card, PWA manifest, header & footer.
2. **Instant Dual-Theme Switcher**: Zero-FOUC `localStorage` persistence (`mukul_theme`) with one-tap Sun/Moon toggle in desktop header and mobile drawer.
3. **Lag-Free Performance ("ল্যাক মুক্ত")**:
   - Eliminated 30fps full-screen WebGL2 shader canvas loop & canvas `getImageData` readbacks.
   - Disabled continuous hero Ken-Burns repaint zoom animations & added `content-visibility: auto` on off-screen rails.
   - Removed Cloudflare Turnstile 4,000ms waits, anti-DevTools `debugger` loops, and all ad/popup/telemetry scripts.
4. **Decluttered UI**: Stripped ads, floating feedback popups, app-install nags, social clutter, and bottom SEO filler blocks.
5. **Serverless Edge Proxy**: Seamless `/_serverFn/*`, `/_edge/*`, and `/_apihamyra/*` Chrome-TLS proxy via `api/proxy.js`.

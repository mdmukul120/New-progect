<?php
/**
 * Shared layout.  Renders <head>, header, drawer, content and footer.
 *
 * @var string $content
 * @var array<string,mixed> $site
 * @var string $title
 * @var string $description
 * @var string|null $canonical
 * @var string|null $ogImage
 * @var bool|null $noindex
 */
use App\Core\Config;

$pageTitle = $title ?? $site['name'];
$pageDesc = $description ?? $site['description'];
$canonicalUrl = $canonical ?? ($site['url'] . ($_SERVER['REQUEST_URI'] ?? '/'));
$ogImageUrl = $ogImage ?? $site['og_image'];
$noindexFlag = (bool) ($noindex ?? false);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$languages = (array) Config::get('navigation.languages', []);
$genres = (array) Config::get('navigation.genres', []);
$quickLinks = (array) Config::get('navigation.quick_links', []);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= e($pageTitle) ?></title>
<meta name="description" content="<?= e($pageDesc) ?>">
<meta name="robots" content="<?= $noindexFlag ? 'noindex, follow' : 'index, follow, max-image-preview:large' ?>">
<meta name="theme-color" content="#050d14">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="<?= e($canonicalUrl) ?>">

<meta property="og:type" content="website">
<meta property="og:site_name" content="<?= e($site['name']) ?>">
<meta property="og:title" content="<?= e($pageTitle) ?>">
<meta property="og:description" content="<?= e($pageDesc) ?>">
<meta property="og:url" content="<?= e($canonicalUrl) ?>">
<meta property="og:image" content="<?= e($ogImageUrl) ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= e($pageTitle) ?>">
<meta name="twitter:description" content="<?= e($pageDesc) ?>">
<meta name="twitter:image" content="<?= e($ogImageUrl) ?>">

<link rel="icon" href="<?= e($site['logo']) ?>" type="image/png" sizes="any">
<link rel="apple-touch-icon" href="<?= e($site['logo']) ?>">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev" crossorigin>
<link rel="preconnect" href="https://image.tmdb.org" crossorigin>
<link rel="stylesheet" href="<?= e(asset('/assets/css/app.css')) ?>">

<script type="application/ld+json"><?= json_encode([
    '@context' => 'https://schema.org',
    '@graph' => [
        [
            '@type' => 'WebSite',
            '@id' => $site['url'] . '/#website',
            'url' => $site['url'],
            'name' => $site['name'],
            'description' => $site['description'],
            'inLanguage' => 'en',
            'potentialAction' => [
                '@type' => 'SearchAction',
                'target' => ['@type' => 'EntryPoint', 'urlTemplate' => $site['url'] . '/search?q={search_term_string}'],
                'query-input' => 'required name=search_term_string',
            ],
        ],
        [
            '@type' => 'Organization',
            '@id' => $site['url'] . '/#organization',
            'name' => $site['name'],
            'url' => $site['url'],
            'logo' => ['@type' => 'ImageObject', 'url' => $site['logo']],
            'sameAs' => array_values(array_filter((array) $site['social'])),
        ],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <div class="shell header-top">
    <a class="brand" href="/" aria-label="<?= e($site['name']) ?> home">
      <img class="brand-logo" src="<?= e($site['logo']) ?>" alt="" width="42" height="42" fetchpriority="high">
      <span class="brand-text">
        <span class="brand-name">Movie<em>Link</em>BD</span>
        <span class="brand-sub">Ad-free streaming index</span>
      </span>
    </a>

    <nav class="header-nav" aria-label="Primary">
      <a href="/type/movies" class="<?= $path === '/type/movies' ? 'is-active' : '' ?>">Movies</a>
      <a href="/type/series" class="<?= $path === '/type/series' ? 'is-active' : '' ?>">Series</a>
      <a href="/anime" class="<?= $path === '/anime' ? 'is-active' : '' ?>">Anime</a>
      <a href="/drama" class="<?= str_starts_with($path, '/drama') ? 'is-active' : '' ?>">Drama</a>
      <a href="/ongoing" class="<?= $path === '/ongoing' ? 'is-active' : '' ?>">Ongoing</a>
      <a href="/collections" class="<?= str_starts_with($path, '/collection') ? 'is-active' : '' ?>">Collections</a>
    </nav>

    <form class="header-search" action="/search" method="get" role="search" autocomplete="off">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/>
      </svg>
      <label class="hidden" for="searchInput">Search titles</label>
      <input id="searchInput" name="q" type="search" placeholder="Search movies, series, anime…"
             value="<?= e($_GET['q'] ?? '') ?>" aria-controls="searchSuggest">
      <button class="search-go" type="submit">Search</button>
      <div class="suggest" id="searchSuggest" role="listbox" aria-label="Suggestions"></div>
    </form>

    <div class="header-actions">
      <a class="icon-btn" href="/upcoming" title="Upcoming releases" aria-label="Upcoming releases">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>
        </svg>
      </a>
      <a class="icon-btn" href="/api" title="API documentation" aria-label="API documentation">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M9 18l-5-6 5-6M15 6l5 6-5 6"/>
        </svg>
      </a>
      <button class="icon-btn menu-toggle" type="button" data-drawer-toggle aria-expanded="false" aria-controls="drawer" aria-label="Open menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M4 7h16M4 12h16M4 17h16"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="header-chips">
    <div class="shell chips" aria-label="Quick categories">
      <?php foreach ($quickLinks as $link): ?>
        <a class="chip<?= str_contains($link['label'], '18+') ? ' chip-adult' : '' ?><?= $path === $link['href'] ? ' is-active' : '' ?>"
           href="<?= e($link['href']) ?>">
          <?= e($link['label']) ?>
          <?php if (!empty($link['badge'])): ?><span class="chip-badge"><?= e($link['badge']) ?></span><?php endif; ?>
        </a>
      <?php endforeach; ?>
      <?php foreach (array_slice($genres, 0, 8) as $genre): ?>
        <a class="chip<?= $path === '/genre/' . $genre['slug'] ? ' is-active' : '' ?>" href="/genre/<?= e($genre['slug']) ?>"><?= e($genre['label']) ?></a>
      <?php endforeach; ?>
    </div>
  </div>
</header>

<div class="drawer-backdrop" id="drawerBackdrop"></div>
<aside class="drawer" id="drawer" aria-label="Menu">
  <div class="stack">
    <h4>Browse</h4>
    <div class="drawer-links">
      <a href="/">🏠 Home</a>
      <a href="/type/movies">🎬 Movies</a>
      <a href="/type/series">📺 Series &amp; TV</a>
      <a href="/anime">🍥 Anime</a>
      <a href="/drama">🇰🇷 K/J/C Drama</a>
      <a href="/southIndian">🔥 South Indian</a>
      <a href="/ongoing">⏳ Ongoing</a>
      <a href="/upcoming">🗓 Upcoming</a>
      <a href="/trending">🔥 Trending</a>
      <a href="/collections">🗂 Collections</a>
      <a href="/ott">📡 Watch by OTT</a>
      <a href="/api">🧩 API docs</a>
    </div>
  </div>
  <div class="stack">
    <h4>Languages</h4>
    <div class="drawer-links">
      <?php foreach (array_slice($languages, 0, 12) as $language): ?>
        <a href="/language/<?= e($language['slug']) ?>"><?= e($language['label']) ?></a>
      <?php endforeach; ?>
    </div>
  </div>
  <div class="stack">
    <h4>Community</h4>
    <div class="drawer-links">
      <a href="<?= e($site['social']['facebook'] ?? '#') ?>" rel="noopener nofollow" target="_blank">Facebook group</a>
      <a href="<?= e($site['social']['telegram'] ?? '#') ?>" rel="noopener nofollow" target="_blank">Telegram channel</a>
    </div>
  </div>
</aside>

<main id="main">
<?= $content ?>
</main>

<footer class="site-footer">
  <div class="shell">
    <div class="footer-grid footer-grid--5">
      <div class="footer-brand">
        <a class="brand" href="/">
          <img class="brand-logo" src="<?= e($site['logo']) ?>" alt="" width="42" height="42" loading="lazy">
          <span class="brand-text">
            <span class="brand-name">Movie<em>Link</em>BD</span>
            <span class="brand-sub">Ad-free streaming index</span>
          </span>
        </a>
        <p><?= e($site['tagline']) ?> — HEVC 480p theke 4K, one index for everything. No popups, no redirects, no trackers.</p>
        <span class="footer-badge">✅ Always free · 100% ad-free</span>
      </div>

      <div class="footer-col">
        <h4>Browse</h4>
        <a href="/latest">Latest published</a>
        <a href="/trending">Trending now</a>
        <a href="/upcoming">Upcoming releases</a>
        <a href="/ongoing">Ongoing series</a>
        <a href="/collections">Collections</a>
      </div>

      <div class="footer-col">
        <h4>Languages</h4>
        <?php foreach (array_slice($languages, 0, 6) as $language): ?>
          <a href="/language/<?= e($language['slug']) ?>"><?= e($language['label']) ?></a>
        <?php endforeach; ?>
      </div>

      <div class="footer-col">
        <h4>Help &amp; legal</h4>
        <a href="/info/faq">Help &amp; FAQ</a>
        <a href="/info/about">About</a>
        <a href="/info/dmca">DMCA / Takedown</a>
        <a href="/info/privacy">Privacy</a>
      </div>

      <div class="footer-col">
        <h4>Developer</h4>
        <a href="/api">API documentation</a>
        <a href="/api/index.json">Endpoint index (JSON)</a>
        <a href="/api/health.json">Health check</a>
        <a href="/api/stats.json">Live statistics</a>
        <a href="/sitemap.xml">Sitemap</a>
      </div>
    </div>

    <div class="footer-bottom">
      <span><?= e($site['copyright']) ?></span>
      <div class="footer-social">
        <a href="<?= e($site['social']['facebook'] ?? '#') ?>" rel="noopener nofollow" target="_blank" aria-label="Facebook">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.6V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H7.5V14h2.8v8h3.2z"/></svg>
        </a>
        <a href="<?= e($site['social']['telegram'] ?? '#') ?>" rel="noopener nofollow" target="_blank" aria-label="Telegram">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3l-3 14.2c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.3-.5.5-1 .5l.3-4.6L17.9 6c.3-.3 0-.5-.5-.2L7.3 12l-4.4-1.4c-.9-.3-1-.9.2-1.4l17-6.5c.8-.3 1.5.2 1.8 1.6z"/></svg>
        </a>
      </div>
    </div>
  </div>
</footer>

<script src="<?= e(asset('/assets/js/app.js')) ?>" defer></script>
</body>
</html>

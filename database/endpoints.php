<?php
/**
 * Public API registry.  This is the single source of truth for:
 *   - /api            (rendered documentation)
 *   - /api/index.json (machine readable index)
 *   - /admin/endpoints
 *
 * Add a route here and in src/Core/Router.php to publish a new endpoint.
 */

declare(strict_types=1);

return [
    // ------------------------------------------------------------- core
    ['GET', '/api', 'core', 'Human-readable API documentation page', '', '/api'],
    ['GET', '/api/index.json', 'core', 'Machine-readable index of every endpoint, envelope and rate limit', '', '/api/index.json'],
    ['GET', '/api/health.json', 'core', 'Liveness probe: database driver, title count, PHP version', '', '/api/health.json'],

    // -------------------------------------------------------- catalogue
    ['GET', '/api/titles.json', 'catalogue', 'Paginated, filterable catalogue listing',
        'q, type, language, genre, collection, ott, status, sort, page, per_page, adult', '/api/titles.json?per_page=6&sort=views'],
    ['GET', '/api/titles/{slug}.json', 'catalogue', 'Full detail for one title: genres, episodes, downloads, related',
        'slug (path)', '/api/titles/{slug}.json'],
    ['GET', '/api/home.json', 'catalogue', 'Everything the homepage needs in one call (rails, top10, upcoming, ott, notices)',
        'none', '/api/home.json'],
    ['GET', '/api/upcoming.json', 'catalogue', 'Release calendar ordered by release date',
        'limit (default 12, max 50)', '/api/upcoming.json?limit=8'],

    // -------------------------------------------------------- discovery
    ['GET', '/api/search.json', 'discovery', 'Full-text search across titles, language and quality',
        'q (required), type, language, genre, sort, page, per_page', '/api/search.json?q=bigg'],
    ['GET', '/api/suggest.json', 'discovery', 'Tiny payload used by the header search box (min 2 chars)',
        'q (required), limit (default 8)', '/api/suggest.json?q=av'],
    ['GET', '/api/trending.json', 'discovery', 'Most viewed titles this week',
        'limit (default 12, max 50)', '/api/trending.json?limit=10'],
    ['GET', '/api/latest.json', 'discovery', 'Newest published titles',
        'limit (default 12, max 50)', '/api/latest.json?limit=10'],
    ['GET', '/api/collection/{slug}.json', 'discovery', 'Curated collection with its members',
        'slug (path), limit (default 24)', '/api/collection/anime-zone.json'],

    // --------------------------------------------------------- taxonomy
    ['GET', '/api/genres.json', 'taxonomy', 'All genres with title counts', '', '/api/genres.json'],
    ['GET', '/api/languages.json', 'taxonomy', 'Languages with title counts', '', '/api/languages.json'],
    ['GET', '/api/ott.json', 'taxonomy', 'OTT platforms with title counts', '', '/api/ott.json'],
    ['GET', '/api/notices.json', 'taxonomy', 'Active homepage notices', '', '/api/notices.json'],

    // ------------------------------------------------------------- meta
    ['GET', '/api/stats.json', 'meta', 'Catalogue statistics, view totals and 24h API traffic', '', '/api/stats.json'],
];

<?php
/**
 * All public HTML pages.
 *
 * Rendering rules that keep the site ad-free and premium looking:
 *  - only first-party CSS/JS is loaded (assets/), no ad or tracker script;
 *  - every card partial is rendered from the local database;
 *  - long lists use server-side pagination (no infinite ad requests).
 */

declare(strict_types=1);

namespace App\Controller;

use App\Core\App;
use App\Core\Config;
use App\Core\MediaCatalog;
use App\Core\Request;
use App\Core\Response;

final class WebController
{
    public function __construct(private readonly App $app)
    {
    }

    // ------------------------------------------------------------- home
    public function home(Request $request, ?string $page = null): Response
    {
        $titles = $this->app->titles();
        $pageNo = max(1, (int) ($page ?? $request->int('page', 1)));

        $recent = $titles->search(['page' => $pageNo, 'per_page' => 24, 'sort' => 'recent']);
        $rails = [];
        foreach ((array) Config::get('navigation.rails', []) as $key => $rail) {
            $params = (array) ($rail['params'] ?? []);
            $params['adult'] = $params['adult'] ?? 0;
            $result = $titles->search($params);
            $rails[$key] = [
                'title' => (string) ($rail['title'] ?? $key),
                'href' => (string) ($rail['href'] ?? ''),
                'items' => $result['items'],
            ];
        }

        return $this->renderPage('pages/home', [
            'title' => $this->app->settings()->get('meta_title_home', (string) Config::get('site.name') . ' — Free HD Movies, Series & Anime')
                ?: (string) Config::get('site.name'),
            'description' => (string) Config::get('site.description'),
            'recent' => $recent,
            'top10' => $titles->topRated(10),
            'upcomingTitles' => $titles->upcoming(12),
            'rails' => $rails,
            'collections' => $this->app->collections()->all(),
            'ott' => $this->app->ott()->all(),
            'genres' => $this->app->genres()->popular(18),
            'notices' => $this->app->notices()->active(),
            'counts' => $titles->counts(),
            'paginationBase' => '/page/',
            'page' => $pageNo,
            'pages' => $recent['pages'],
            'total' => $recent['total'],
        ]);
    }

    // ------------------------------------------------------- taxonomies
    public function type(Request $request, string $type, ?string $page = null): Response
    {
        $type = $this->normaliseType($type);
        if ($type === null) {
            return $this->notFound($request);
        }
        return $this->listing($request, [
            'type' => $type,
            'sort' => $request->string('sort', 'recent'),
        ], $this->typeTitle($type), '/type/' . $type, (int) ($page ?? $request->int('page', 1)));
    }

    /** Friendly aliases used by the old site: /anime /drama /southIndian /adult18plus */
    public function typeAlias(Request $request, ?string $page = null): Response
    {
        $rawPath = trim($request->path(), '/');
        $path = (string) preg_replace('~/page/\d+$~', '', $rawPath);
        $map = [
            'anime' => ['type' => 'anime', 'title' => '🍥 Anime Zone'],
            'drama' => ['type' => 'drama', 'title' => '🇰🇷 K/J/C Drama'],
            'southIndian' => ['language' => 'tamil,telugu,malayalam,kannada', 'title' => '🔥 South Indian Movies'],
            'adult18plus' => ['adult' => 1, 'title' => '🔞 18+ Adult', 'noindex' => true],
        ];
        $config = $map[$path] ?? null;
        if ($config === null) {
            return $this->notFound($request);
        }
        $title = (string) $config['title'];
        unset($config['title']);
        $noindex = (bool) ($config['noindex'] ?? false);
        unset($config['noindex']);

        $sort = $request->string('sort', 'recent');
        $pageNo = (int) ($page ?? $request->int('page', 1));

        return $this->listing($request, $config + ['sort' => $sort], $title, '/' . $path, $pageNo, $noindex);
    }

    public function category(Request $request, string $slug, ?string $page = null): Response
    {
        $clean = strtolower(trim($slug));
        $pageNo = (int) ($page ?? $request->int('page', 1));
        $sort = $request->string('sort', 'recent');

        if ($clean === 'wwe' || $clean === 'sports') {
            return $this->listing($request, ['genre' => 'sports', 'sort' => $sort], '🤼 WWE & Sports', '/category/' . $slug, $pageNo);
        }
        $genre = $this->app->genres()->find($clean);
        if ($genre !== null) {
            return $this->listing($request, ['genre' => $clean, 'sort' => $sort], (string) $genre['name'], '/category/' . $slug, $pageNo);
        }
        return $this->listing($request, ['q' => str_replace('-', ' ', $clean), 'sort' => $sort], ucfirst(str_replace('-', ' ', $slug)), '/category/' . $slug, $pageNo);
    }

    public function language(Request $request, string $slug, ?string $page = null): Response
    {
        $entry = $this->findInNavigation('languages', $slug);
        return $this->listing($request, [
            'language' => $slug,
            'sort' => $request->string('sort', 'recent'),
        ], $entry['label'] ?? ucfirst(str_replace('-', ' ', $slug)), '/language/' . $slug,
            (int) ($page ?? $request->int('page', 1)));
    }

    public function genre(Request $request, string $slug, ?string $page = null): Response
    {
        $genre = $this->app->genres()->find($slug);
        $entry = $this->findInNavigation('genres', $slug);
        $label = $entry['label'] ?? ($genre['name'] ?? ucfirst(str_replace('-', ' ', $slug)));
        return $this->listing($request, [
            'genre' => $slug,
            'sort' => $request->string('sort', 'views'),
        ], $label . ' Movies & Series', '/genre/' . $slug, (int) ($page ?? $request->int('page', 1)));
    }

    public function collection(Request $request, string $slug, ?string $page = null): Response
    {
        $collection = $this->app->collections()->find($slug);
        if ($collection === null) {
            return $this->notFound($request);
        }
        return $this->listing($request, [
            'collection' => $slug,
            'sort' => $request->string('sort', 'views'),
        ], (string) $collection['name'], '/collection/' . $slug, (int) ($page ?? $request->int('page', 1)),
            false, (string) ($collection['description'] ?? ''));
    }

    public function collections(Request $request): Response
    {
        return $this->renderPage('pages/collections', [
            'title' => 'Collections — ' . (string) Config::get('site.name'),
            'description' => 'Hand-picked MovieLinkBD collections: MCU, DC, Bangla web series, Korean drama and more.',
            'collections' => $this->app->collections()->all(),
        ]);
    }

    public function ottList(Request $request): Response
    {
        return $this->renderPage('pages/ott-list', [
            'title' => 'Watch by OTT platform — ' . (string) Config::get('site.name'),
            'description' => 'Browse every title by streaming platform: Netflix, Prime, Chorki, Hoichoi and more.',
            'platforms' => $this->app->ott()->all(),
        ]);
    }

    public function ott(Request $request, string $slug, ?string $page = null): Response
    {
        $platform = $this->app->ott()->find($slug);
        if ($platform === null) {
            return $this->notFound($request);
        }
        return $this->listing($request, [
            'ott' => $slug,
            'sort' => $request->string('sort', 'recent'),
        ], (string) $platform['name'] . ' — Movies & Series', '/ott/' . $slug,
            (int) ($page ?? $request->int('page', 1)));
    }

    public function search(Request $request, ?string $page = null): Response
    {
        $q = $request->string('q');
        $params = [
            'q' => $q,
            'type' => $request->string('type'),
            'language' => $request->string('language'),
            'genre' => $request->string('genre'),
            'sort' => $request->string('sort', 'recent'),
            'page' => (int) ($page ?? $request->int('page', 1)),
            'per_page' => 24,
        ];
        if (!$request->bool('adult')) {
            $params['adult'] = 0;
        }

        $result = $this->app->titles()->search($params);

        $queryArgs = array_filter([
            'q' => $q,
            'type' => $params['type'],
            'language' => $params['language'],
            'genre' => $params['genre'],
            'sort' => $params['sort'] !== 'recent' ? $params['sort'] : '',
            'adult' => $request->bool('adult') ? '1' : '',
        ], static fn (string $v): bool => $v !== '');
        $paginationBase = '/search?' . ($queryArgs !== [] ? http_build_query($queryArgs) . '&' : '') . 'page=';

        return $this->renderPage('pages/search', [
            'title' => ($q !== '' ? 'Search: ' . $q . ' — ' : 'Search — ') . (string) Config::get('site.name'),
            'description' => 'Search movies, series, anime and drama on MovieLinkBD.',
            'noindex' => true,
            'query' => $q,
            'result' => $result,
            'filters' => [
                'type' => $params['type'],
                'language' => $params['language'],
                'genre' => $params['genre'],
                'sort' => $params['sort'],
            ],
            'paginationBase' => $paginationBase,
            'page' => $result['page'],
            'pages' => $result['pages'],
            'total' => $result['total'],
            'languages' => (array) Config::get('navigation.languages', []),
            'genres' => (array) Config::get('navigation.genres', []),
            'collections' => $this->app->collections()->all(),
        ]);
    }

    public function upcoming(Request $request, ?string $page = null): Response
    {
        $items = $this->app->titles()->upcoming(36);
        return $this->renderPage('pages/upcoming', [
            'title' => 'Upcoming Releases — ' . (string) Config::get('site.name'),
            'description' => 'Release calendar of upcoming movies and series on MovieLinkBD.',
            'items' => $items,
        ]);
    }

    public function latest(Request $request, ?string $page = null): Response
    {
        return $this->listing($request, ['sort' => $request->string('sort', 'latest')], '🆕 Latest Published', '/latest',
            (int) ($page ?? $request->int('page', 1)));
    }

    public function ongoing(Request $request, ?string $page = null): Response
    {
        return $this->listing($request, ['status' => 'ongoing', 'sort' => $request->string('sort', 'recent')], '⏳ Ongoing Series',
            '/ongoing', (int) ($page ?? $request->int('page', 1)));
    }

    public function trending(Request $request, ?string $page = null): Response
    {
        return $this->listing($request, ['sort' => $request->string('sort', 'views')], '🔥 Trending Now', '/trending',
            (int) ($page ?? $request->int('page', 1)));
    }

    public function live(Request $request, ?string $page = null): Response
    {
        return $this->listing($request, ['status' => 'ongoing', 'sort' => $request->string('sort', 'recent')], '📡 Live & Ongoing',
            '/live', (int) ($page ?? $request->int('page', 1)));
    }

    // -------------------------------------------------------- title page
    public function title(Request $request, string $type, string $slug): Response
    {
        $type = $this->normaliseType($type);
        if ($type === null) {
            return $this->notFound($request);
        }
        $title = $this->app->titles()->find($slug);
        if ($title === null) {
            return $this->notFound($request);
        }

        $this->app->titles()->incrementViews((int) $title['id']);

        $rawLinks = $this->app->titles()->downloadLinks((int) $title['id']);
        $episodes = $this->app->titles()->episodes((int) $title['id']);

        $requestedEp = strtoupper($request->string('ep'));
        $activeEpIndex = 0;
        $activeEpisode = null;
        foreach ($episodes as $idx => $ep) {
            $code = sprintf('S%02dE%02d', (int) $ep['season'], (int) $ep['episode']);
            $episodes[$idx]['code'] = $code;
            $episodes[$idx]['stream_fast'] = MediaCatalog::fastStreamUrl($title, '720p', $idx);
            $episodes[$idx]['stream_hd'] = MediaCatalog::fastStreamUrl($title, '1080p', $idx);
            $episodes[$idx]['stream_cinema'] = MediaCatalog::cinemaStreamUrl($title, $idx);
            $episodes[$idx]['dl_href'] = url('/dl/' . implode('/', array_map('rawurlencode', explode('/', (string) $title['slug']))))
                . '?q=720p&ep=' . $idx;
            $episodes[$idx]['filename'] = MediaCatalog::filename($title, '720p', $code);
            if ($requestedEp !== '' && ($requestedEp === $code || $requestedEp === 'E' . str_pad((string) $ep['episode'], 2, '0', STR_PAD_LEFT))) {
                $activeEpIndex = $idx;
            }
        }
        if ($episodes !== []) {
            $activeEpisode = $episodes[$activeEpIndex] ?? $episodes[0];
        }

        $links = MediaCatalog::normaliseLinks($title, $rawLinks);
        $servers = MediaCatalog::servers($title, $rawLinks, $activeEpIndex);

        return $this->renderPage('pages/title', [
            'title' => (string) $title['title'] . ' — Download & Watch | ' . (string) Config::get('site.name'),
            'description' => mb_substr(
                (string) ($title['synopsis'] ?: $title['title'] . ' download in ' . ($title['quality'] ?: 'HD') . '. Ad-free, fast, one click.'),
                0,
                300
            ),
            'ogImage' => (string) ($title['poster'] ?: Config::get('site.og_image')),
            'noindex' => (bool) $title['is_adult'],
            'item' => $title,
            'links' => $links,
            'servers' => $servers,
            'episodes' => $episodes,
            'activeEpisode' => $activeEpisode,
            'activeEpIndex' => $activeEpIndex,
            'related' => $this->app->titles()->related($title, 8),
            'breadcrumb' => [
                ['name' => 'Home', 'url' => '/'],
                ['name' => $this->typeTitle($type), 'url' => '/type/' . $type],
                ['name' => (string) $title['title'], 'url' => '/' . $type . '/' . $slug],
            ],
        ]);
    }

    public function download(Request $request, string $type, string $slug): Response
    {
        $title = $this->app->titles()->find($slug);
        if ($title === null) {
            return $this->notFound($request);
        }
        $rawLinks = $this->app->titles()->downloadLinks((int) $title['id']);
        return $this->renderPage('pages/download', [
            'title' => 'Download ' . (string) $title['title'] . ' — ' . (string) Config::get('site.name'),
            'noindex' => true,
            'item' => $title,
            'links' => MediaCatalog::normaliseLinks($title, $rawLinks),
        ]);
    }

    /** First-party `/dl/{slug}` endpoint: resolves to a live HTTPS `.mp4` stream. */
    public function directDownload(Request $request, string $slug): Response
    {
        $title = $this->app->titles()->find($slug);
        if ($title === null) {
            return $this->notFound($request);
        }
        $rawLinks = $this->app->titles()->downloadLinks((int) $title['id']);
        $quality = $request->string('q', '720p');
        $epOffset = max(0, $request->int('ep', 0));
        $target = MediaCatalog::resolveDownloadTarget($title, $rawLinks, $quality, $epOffset);

        return Response::redirect($target, 302)->withHeader('Cache-Control', 'no-store');
    }

    /** Static info pages stored in the `pages` table (about, faq, dmca, privacy). */
    public function info(Request $request, string $slug): Response
    {
        $page = $this->app->db()->one('SELECT * FROM pages WHERE slug = :slug', ['slug' => $slug]);
        if ($page === null) {
            return $this->notFound($request);
        }

        return $this->renderPage('pages/info', [
            'title' => (string) $page['title'] . ' — ' . (string) Config::get('site.name'),
            'description' => mb_substr(strip_tags((string) $page['body']), 0, 200),
            'page' => $page,
            'breadcrumb' => [
                ['name' => 'Home', 'url' => '/'],
                ['name' => (string) $page['title'], 'url' => '/info/' . $slug],
            ],
        ]);
    }

    /** Legacy /continue/{key} links: look the key up, otherwise show the homepage. */
    public function continueTo(Request $request, string $key): Response
    {
        $title = $this->app->titles()->find($key);
        if ($title !== null) {
            return Response::redirect(url('/' . $title['type'] . '/' . $title['slug']));
        }
        return Response::redirect(url('/'));
    }

    // ----------------------------------------------------------- shared
    /**
     * @param array<string,mixed> $params
     */
    private function listing(
        Request $request,
        array $params,
        string $heading,
        string $base,
        int $page,
        bool $noindex = false,
        string $description = ''
    ): Response {
        $params['page'] = max(1, $page);
        $params['per_page'] = 24;
        if (!array_key_exists('adult', $params) && !$request->bool('adult')) {
            $params['adult'] = 0;
        }
        $result = $this->app->titles()->search($params);

        $extraQuery = array_filter([
            'sort' => $request->string('sort'),
            'adult' => $request->bool('adult') ? '1' : '',
        ], static fn (string $v): bool => $v !== '');
        $paginationSuffix = $extraQuery !== [] ? '?' . http_build_query($extraQuery) : '';

        return $this->renderPage('pages/listing', [
            'title' => $heading . ' — ' . (string) Config::get('site.name'),
            'description' => $description !== '' ? $description : $heading . ' — browsable archive, completely ad-free.',
            'noindex' => $noindex,
            'heading' => $heading,
            'result' => $result,
            'paginationBase' => $base . '/page/',
            'paginationSuffix' => $paginationSuffix,
            'page' => $result['page'],
            'pages' => $result['pages'],
            'total' => $result['total'],
            'sort' => (string) ($params['sort'] ?? 'recent'),
            'basePath' => $base,
            'collections' => $this->app->collections()->all(),
            'languages' => (array) Config::get('navigation.languages', []),
            'genres' => (array) Config::get('navigation.genres', []),
            'breadcrumb' => [
                ['name' => 'Home', 'url' => '/'],
                ['name' => $heading, 'url' => $base],
            ],
        ]);
    }

    private function normaliseType(string $type): ?string
    {
        $type = strtolower($type);
        $map = [
            'movies' => 'movie', 'movie' => 'movie',
            'series' => 'series', 'tv' => 'series', 'webseries' => 'series',
            'anime' => 'anime', 'drama' => 'drama',
            'animation' => 'animation', 'cartoon' => 'animation',
        ];
        return $map[$type] ?? null;
    }

    private function typeTitle(string $type): string
    {
        return match ($type) {
            'movie' => '🎬 Movies',
            'series' => '📺 Series & TV Shows',
            'anime' => '🍥 Anime Zone',
            'drama' => '🇰🇷 K/J/C Drama',
            'animation' => '🎨 Animation',
            default => ucfirst($type),
        };
    }

    /** @return array<string,string>|null */
    private function findInNavigation(string $group, string $slug): ?array
    {
        foreach ((array) Config::get('navigation.' . $group, []) as $entry) {
            if (($entry['slug'] ?? '') === $slug) {
                return $entry;
            }
        }
        return null;
    }

    /** @param array<string,mixed> $data */
    private function renderPage(string $template, array $data): Response
    {
        $data['canonical'] = (string) Config::get('app.url') . '/' . ltrim(
            (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH),
            '/'
        );
        $html = $this->app->view()->render($template, $data);
        return Response::html($html);
    }

    private function notFound(Request $request): Response
    {
        return Response::html($this->app->view()->render('errors/404', [
            'title' => '404 — Not found',
            'path' => $request->path(),
        ]), 404);
    }
}

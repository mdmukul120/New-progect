<?php
/**
 * Public JSON API.
 *
 * Every endpoint is registered in the `api_endpoints` table (see
 * database/seed.php) so /api and the admin panel always document the
 * live routes. Response envelope:
 *
 *   { "ok": true, "data": ..., "meta": { ... } }
 *
 * @api-category core
 */

declare(strict_types=1);

namespace App\Controller;

use App\Core\App;
use App\Core\Config;
use App\Core\MediaCatalog;
use App\Core\Request;
use App\Core\Response;

final class ApiController
{
    public function __construct(private readonly App $app)
    {
    }

    // ------------------------------------------------------------ index
    public function index(Request $request): Response
    {
        return Response::html($this->app->view()->render('pages/api-docs', [
            'title' => 'API — ' . (string) Config::get('site.name'),
            'description' => 'Public JSON API for MovieLinkBD titles, genres, collections and OTT platforms.',
            'groups' => $this->app->endpoints()->grouped(),
            'total' => $this->app->endpoints()->count(),
            'base' => (string) Config::get('app.url'),
        ]));
    }

    public function indexJson(Request $request): Response
    {
        return $this->ok([
            'name' => (string) Config::get('site.name') . ' Public API',
            'version' => '1.0.0',
            'base_url' => (string) Config::get('app.url'),
            'envelope' => ['ok' => 'boolean', 'data' => 'mixed', 'meta' => 'object|null', 'error' => 'object when ok=false'],
            'rate_limit' => (int) Config::get('app.security.rate_limit_per_minute', 90) . ' requests / minute / IP',
            'endpoints' => $this->app->endpoints()->all(),
        ]);
    }

    public function health(Request $request): Response
    {
        $checkedAt = date('c');
        try {
            $titleCount = (int) $this->app->db()->scalar('SELECT COUNT(*) FROM titles');
            $status = 200;
            $dbOk = true;
        } catch (\Throwable) {
            $titleCount = 0;
            $status = 503;
            $dbOk = false;
        }

        return $this->ok([
            'status' => $dbOk ? 'healthy' : 'degraded',
            'database' => $dbOk ? 'connected' : 'unreachable',
            'driver' => $this->app->db()->driver(),
            'titles' => $titleCount,
            'php' => PHP_VERSION,
            'checked_at' => $checkedAt,
            'uptime' => 'n/a',
        ], [], $status);
    }

    // ----------------------------------------------------------- titles
    public function titles(Request $request): Response
    {
        $params = $this->listingParams($request, 24);
        $result = $this->app->titles()->search($params);
        $result['items'] = array_map([$this, 'serialize'], $result['items']);

        return $this->paginated($result, $params);
    }

    public function title(Request $request, string $slug): Response
    {
        $title = $this->app->titles()->find($slug);
        if ($title === null) {
            return $this->fail('not_found', 'No title with slug "' . $slug . '"', 404);
        }
        $rawLinks = $this->app->titles()->downloadLinks((int) $title['id']);
        $links = MediaCatalog::normaliseLinks($title, $rawLinks);
        $payload = $this->serialize($title);
        $payload['episodes'] = $this->app->titles()->episodes((int) $title['id']);
        $payload['streams'] = MediaCatalog::servers($title, $rawLinks);
        $payload['downloads'] = array_map(
            static fn (array $l): array => [
                'label' => $l['label'],
                'quality' => $l['quality'],
                'size' => $l['size'],
                'url' => $l['url'],
                'direct_url' => $l['direct_url'],
                'filename' => $l['filename'],
            ],
            $links
        );
        $payload['related'] = array_map([$this, 'serialize'], $this->app->titles()->related($title, 8));

        return $this->ok($payload);
    }

    public function search(Request $request): Response
    {
        if ($request->string('q') === '') {
            return $this->fail('validation_error', 'Query parameter "q" is required.', 422);
        }
        $params = $this->listingParams($request, 24);
        $result = $this->app->titles()->search($params);
        $result['items'] = array_map([$this, 'serialize'], $result['items']);
        return $this->paginated($result, $params);
    }

    /** Lightweight endpoint for the header search box. */
    public function suggest(Request $request): Response
    {
        $q = trim($request->string('q'));
        if (mb_strlen($q) < 2) {
            return $this->ok([], ['query' => $q, 'hint' => 'Type at least 2 characters.']);
        }
        $result = $this->app->titles()->search([
            'q' => $q,
            'per_page' => min(10, max(1, $request->int('limit', 8))),
            'sort' => 'views',
            'adult' => 0,
        ]);
        $items = array_map(static fn (array $row): array => [
            'slug' => $row['slug'],
            'title' => $row['title'],
            'type' => $row['type'],
            'url' => '/' . $row['type'] . '/' . $row['slug'],
            'poster' => $row['poster'],
            'year' => $row['year'] !== null ? (int) $row['year'] : null,
            'quality' => $row['quality'],
            'views' => (int) $row['views'],
            'views_human' => format_views((int) $row['views']),
        ], $result['items']);

        return $this->ok($items, ['query' => $q, 'count' => count($items)]);
    }

    public function trending(Request $request): Response
    {
        $limit = min(50, max(1, $request->int('limit', 12)));
        return $this->ok(array_map([$this, 'serialize'], $this->app->titles()->topRated($limit)));
    }

    public function latest(Request $request): Response
    {
        $result = $this->app->titles()->search([
            'sort' => 'latest',
            'per_page' => min(50, max(1, $request->int('limit', 12))),
            'adult' => 0,
        ]);
        return $this->ok(array_map([$this, 'serialize'], $result['items']));
    }

    public function upcoming(Request $request): Response
    {
        return $this->ok(array_map([$this, 'serialize'], $this->app->titles()->upcoming(
            min(50, max(1, $request->int('limit', 12)))
        )));
    }

    public function collection(Request $request, string $slug): Response
    {
        $collection = $this->app->collections()->find($slug);
        if ($collection === null) {
            return $this->fail('not_found', 'No collection "' . $slug . '"', 404);
        }
        return $this->ok([
            'collection' => $collection,
            'items' => array_map([$this, 'serialize'], $this->app->collections()->items(
                $slug,
                min(60, max(1, $request->int('limit', 24)))
            )),
        ]);
    }

    public function home(Request $request): Response
    {
        $titles = $this->app->titles();
        $rails = [];
        foreach ((array) Config::get('navigation.rails', []) as $key => $rail) {
            $params = (array) ($rail['params'] ?? []);
            $params['per_page'] = 12;
            $params['adult'] = $params['adult'] ?? 0;
            $rails[$key] = [
                'title' => (string) ($rail['title'] ?? $key),
                'items' => array_map([$this, 'serialize'], $titles->search($params)['items']),
            ];
        }

        return $this->ok([
            'recent' => array_map([$this, 'serialize'], $titles->search(['per_page' => 12])['items']),
            'top10' => array_map([$this, 'serialize'], $titles->topRated(10)),
            'upcoming' => array_map([$this, 'serialize'], $titles->upcoming(12)),
            'rails' => $rails,
            'collections' => $this->app->collections()->all(),
            'ott' => $this->app->ott()->all(),
            'notices' => $this->app->notices()->active(),
        ]);
    }

    public function genres(Request $request): Response
    {
        return $this->ok($this->app->genres()->all());
    }

    public function languages(Request $request): Response
    {
        $rows = $this->app->db()->all(
            "SELECT language AS slug, COUNT(*) AS titles_count FROM titles
              WHERE language IS NOT NULL AND language <> '' AND is_adult = 0
              GROUP BY language ORDER BY titles_count DESC"
        );
        return $this->ok($rows);
    }

    public function ott(Request $request): Response
    {
        return $this->ok($this->app->ott()->all());
    }

    public function notices(Request $request): Response
    {
        return $this->ok($this->app->notices()->active());
    }

    public function stats(Request $request): Response
    {
        $db = $this->app->db();
        $byType = $db->all('SELECT type, COUNT(*) AS total FROM titles GROUP BY type ORDER BY total DESC');
        $requests24h = (int) $db->scalar('SELECT COUNT(*) FROM api_logs WHERE created_at >= ' . $db->sinceDaysAgo(1));

        return $this->ok([
            'titles' => (int) $db->scalar('SELECT COUNT(*) FROM titles'),
            'views' => (int) $db->scalar('SELECT COALESCE(SUM(views),0) FROM titles'),
            'episodes' => (int) $db->scalar('SELECT COUNT(*) FROM episodes'),
            'genres' => (int) $db->scalar('SELECT COUNT(*) FROM genres'),
            'collections' => (int) $db->scalar('SELECT COUNT(*) FROM collections'),
            'ott_platforms' => (int) $db->scalar('SELECT COUNT(*) FROM ott_platforms'),
            'by_type' => $byType,
            'api_requests_24h' => $requests24h,
            'generated_at' => date('c'),
        ]);
    }

    // -------------------------------------------------------- internals
    /** @return array<string,mixed> */
    private function listingParams(Request $request, int $defaultPerPage): array
    {
        return [
            'q' => $request->string('q'),
            'type' => $request->string('type'),
            'language' => $request->string('language'),
            'genre' => $request->string('genre'),
            'collection' => $request->string('collection'),
            'ott' => $request->string('ott'),
            'status' => $request->string('status'),
            'sort' => $request->string('sort', 'recent'),
            'page' => max(1, $request->int('page', 1)),
            'per_page' => min(60, max(1, $request->int('per_page', $defaultPerPage))),
            'adult' => $request->bool('adult') ? 1 : 0,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public function serialize(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'slug' => $row['slug'],
            'title' => $row['title'],
            'type' => $row['type'],
            'year' => $row['year'] !== null ? (int) $row['year'] : null,
            'quality' => $row['quality'],
            'language' => $row['language'],
            'language_label' => $row['language_raw'] ?? null,
            'rating' => $row['rating'] !== null ? (float) $row['rating'] : null,
            'views' => (int) $row['views'],
            'views_human' => format_views((int) $row['views']),
            'poster' => $row['poster'],
            'status' => $row['status'],
            'episode' => $row['ep_label'] !== null ? ['label' => $row['ep_label'], 'state' => $row['ep_state']] : null,
            'genres' => $row['genres'] ?? [],
            'ott' => $row['ott_slug'],
            'pinned' => (bool) $row['is_pinned'],
            'adult' => (bool) $row['is_adult'],
            'url' => '/' . $row['type'] . '/' . $row['slug'],
            'release_date' => $row['release_date'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /**
     * @param array<string,mixed> $result
     * @param array<string,mixed> $params
     */
    private function paginated(array $result, array $params): Response
    {
        return $this->ok($result['items'], [
            'total' => $result['total'],
            'page' => $result['page'],
            'per_page' => $result['per_page'],
            'pages' => $result['pages'],
            'filters' => array_filter($params, static fn ($v): bool => $v !== '' && $v !== null && $v !== 0),
        ]);
    }

    /** @param array<string,mixed> $data */
    private function ok(array $data, array $meta = [], int $status = 200): Response
    {
        return Response::json([
            'ok' => true,
            'data' => $data,
            'meta' => $meta === [] ? null : $meta,
        ], $status);
    }

    private function fail(string $code, string $message, int $status): Response
    {
        return Response::json([
            'ok' => false,
            'error' => ['code' => $code, 'message' => $message],
            'docs' => (string) Config::get('app.url') . '/api',
        ], $status);
    }
}

<?php
/**
 * Explicit, fast router.  Patterns support {param} and {param?}.
 */

declare(strict_types=1);

namespace App\Core;

use App\Controller\AdminController;
use App\Controller\ApiController;
use App\Controller\SetupController;
use App\Controller\SitemapController;
use App\Controller\WebController;

final class Router
{
    /** @var array<int,array{method:string,regex:string,params:array<int,string>,handler:array{0:class-string,1:string}}> */
    private array $routes = [];

    public function __construct(private readonly App $app)
    {
        $this->register();
    }

    private function get(string $path, string $controller, string $action): void
    {
        $this->add('GET', $path, $controller, $action);
    }

    private function post(string $path, string $controller, string $action): void
    {
        $this->add('POST', $path, $controller, $action);
    }

    /** @param class-string $controller */
    private function add(string $method, string $path, string $controller, string $action): void
    {
        $params = [];
        $regex = preg_replace_callback(
            '~\{([a-zA-Z_][a-zA-Z0-9_]*)(\?)?\}~',
            static function (array $m) use (&$params): string {
                $params[] = $m[1];
                return $m[2] ?? '' ? '([^/]*)' : '([^/]+)';
            },
            $path
        );
        $this->routes[] = [
            'method' => $method,
            'regex' => '~^' . $regex . '$~',
            'params' => $params,
            'handler' => [$controller, $action],
        ];
    }

    private function register(): void
    {
        $c = WebController::class;
        $a = ApiController::class;
        $m = AdminController::class;
        $s = SitemapController::class;
        $p = SetupController::class;

        // ------------------------------------------------ web (HTML)
        $this->get('/', $c, 'home');
        $this->get('/page/{page}', $c, 'home');
        $this->get('/type/{type}', $c, 'type');
        $this->get('/type/{type}/page/{page}', $c, 'type');
        $this->get('/language/{slug}', $c, 'language');
        $this->get('/language/{slug}/page/{page}', $c, 'language');
        $this->get('/genre/{slug}', $c, 'genre');
        $this->get('/genre/{slug}/page/{page}', $c, 'genre');
        $this->get('/collections', $c, 'collections');
        $this->get('/collection/{slug}', $c, 'collection');
        $this->get('/collection/{slug}/page/{page}', $c, 'collection');
        $this->get('/ott', $c, 'ottList');
        $this->get('/ott/{slug}', $c, 'ott');
        $this->get('/ott/{slug}/page/{page}', $c, 'ott');
        $this->get('/search', $c, 'search');
        $this->get('/search/page/{page}', $c, 'search');
        $this->get('/upcoming', $c, 'upcoming');
        $this->get('/latest', $c, 'latest');
        $this->get('/ongoing', $c, 'ongoing');
        $this->get('/trending', $c, 'trending');
        $this->get('/anime', $c, 'typeAlias');
        $this->get('/drama', $c, 'typeAlias');
        $this->get('/southIndian', $c, 'typeAlias');
        $this->get('/adult18plus', $c, 'typeAlias');
        $this->get('/live', $c, 'live');
        $this->get('/info/{slug}', $c, 'info');
        $this->get('/download/{type}/{slug}', $c, 'download');
        $this->get('/continue/{key}', $c, 'continueTo');

        // ------------------------------------------------- admin
        $this->get('/admin', $m, 'dashboard');
        $this->get('/admin/login', $m, 'loginForm');
        $this->post('/admin/login', $m, 'login');
        $this->post('/admin/logout', $m, 'logout');
        $this->get('/admin/titles', $m, 'titles');
        $this->post('/admin/titles/save', $m, 'saveTitle');
        $this->post('/admin/titles/delete', $m, 'deleteTitle');
        $this->get('/admin/endpoints', $m, 'endpoints');
        $this->get('/admin/settings', $m, 'settings');
        $this->post('/admin/settings', $m, 'saveSettings');

        // --------------------------------------------------- api
        $this->get('/api', $a, 'index');
        $this->get('/api/index.json', $a, 'indexJson');
        $this->get('/api/health.json', $a, 'health');
        $this->get('/api/titles.json', $a, 'titles');
        $this->get('/api/titles/{slug}.json', $a, 'title');
        $this->get('/api/search.json', $a, 'search');
        $this->get('/api/suggest.json', $a, 'suggest');
        $this->get('/api/trending.json', $a, 'trending');
        $this->get('/api/latest.json', $a, 'latest');
        $this->get('/api/upcoming.json', $a, 'upcoming');
        $this->get('/api/collection/{slug}.json', $a, 'collection');
        $this->get('/api/home.json', $a, 'home');
        $this->get('/api/genres.json', $a, 'genres');
        $this->get('/api/languages.json', $a, 'languages');
        $this->get('/api/ott.json', $a, 'ott');
        $this->get('/api/notices.json', $a, 'notices');
        $this->get('/api/stats.json', $a, 'stats');

        // ------------------------------------------- one-shot installer
        $this->get('/setup', $p, 'run');

        // ---------------------------------------------- sitemaps / seo
        $this->get('/sitemap.xml', $s, 'index');
        $this->get('/sitemap-titles.xml', $s, 'titles');
        $this->get('/sitemap-taxonomy.xml', $s, 'taxonomy');
        $this->get('/robots.txt', $s, 'robots');
        $this->get('/manifest.webmanifest', $s, 'manifest');

        // ---------------------------------------------- catch-all (last!)
        // Registered last so it can never swallow /api, /admin or sitemap routes.
        $this->get('/{type}/{slug}', $c, 'title');
    }

    public function dispatch(string $method, string $uri): Response
    {
        $start = microtime(true);
        $request = Request::capture();

        RateLimiter::guard($request);

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method && !($method === 'HEAD' && $route['method'] === 'GET')) {
                continue;
            }
            if (!preg_match($route['regex'], $request->path(), $matches)) {
                continue;
            }
            array_shift($matches);
            $args = [];
            foreach ($route['params'] as $index => $name) {
                $args[$name] = $matches[$index] ?? null;
            }

            [$class, $action] = $route['handler'];
            $controller = new $class($this->app);
            /** @var Response $response */
            $response = $controller->{$action}($request, ...$args);

            $this->log($request, $response, $start);
            return $response;
        }

        $notFound = $request->wantsJson()
            ? Response::json([
                'ok' => false,
                'error' => ['code' => 'not_found', 'message' => 'No endpoint matches ' . $request->path()],
                'docs' => url('/api'),
            ], 404)
            : Response::html($this->app->view()->render('errors/404', [
                'title' => '404 — Not found',
                'path' => $request->path(),
            ]), 404);

        $this->log($request, $notFound, $start);
        return $notFound;
    }

    private function log(Request $request, Response $response, float $start): void
    {
        if (!$request->isApi()) {
            return;
        }
        try {
            $duration = (int) round((microtime(true) - $start) * 1000);
            $this->app->db()->insert('api_logs', [
                'method' => $request->method(),
                'path' => mb_substr($request->path(), 0, 190),
                'status' => $response->status(),
                'duration_ms' => $duration,
                'ip' => mb_substr($request->ip(), 0, 45),
            ]);
            // Keep the log table small without a cron job.
            if (random_int(1, 40) === 1) {
                $this->app->db()->run(
                    'DELETE FROM api_logs WHERE created_at < ' . $this->app->db()->sinceDaysAgo(7)
                );
            }
        } catch (\Throwable) {
            // Never let telemetry break a request.
        }
    }
}

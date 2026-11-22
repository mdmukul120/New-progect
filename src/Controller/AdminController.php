<?php
/**
 * Admin panel: session login (no ads, no external assets) + editors for
 * titles, endpoints and settings.
 */

declare(strict_types=1);

namespace App\Controller;

use App\Core\App;
use App\Core\Config;
use App\Core\Env;
use App\Core\Request;
use App\Core\Response;

final class AdminController
{
    public function __construct(private readonly App $app)
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            // Keep sessions inside the project so we never depend on the
            // host's php.ini session path being writable.
            $sessionDir = MLBD_ROOT . '/storage/sessions';
            if (!is_dir($sessionDir)) {
                @mkdir($sessionDir, 0775, true);
            }
            if (is_dir($sessionDir) && is_writable($sessionDir)) {
                session_save_path($sessionDir);
            }
            session_set_cookie_params([
                'lifetime' => 0,
                'path' => '/',
                'httponly' => true,
                'samesite' => 'Lax',
                'secure' => str_starts_with((string) Config::get('app.url', ''), 'https://'),
            ]);
            session_name('mlbd_admin');
            session_start();
        }
    }

    // ------------------------------------------------------------ auth
    public function loginForm(Request $request): Response
    {
        if ($this->authed()) {
            return Response::redirect(url('/admin'));
        }
        return Response::html($this->app->view()->render('admin/login', [
            'title' => 'Admin login',
            'error' => null,
            'csrf' => $this->csrf(),
            'admin' => true,
            'layout' => null,
        ]));
    }

    public function login(Request $request): Response
    {
        $username = $request->string('username');
        $password = (string) $request->input('password', '');
        $csrf = $request->string('_token');

        if (!$this->verifyCsrf($csrf)) {
            return $this->renderLogin('Session expired, please try again.');
        }

        $expectedUser = $this->app->settings()->get('admin_username', (string) Env::get('ADMIN_USERNAME', 'admin'));
        $hash = $this->app->settings()->get('admin_password_hash', '');

        if ($hash === '') {
            $hash = password_hash((string) Env::get('ADMIN_PASSWORD', 'change-me-now'), PASSWORD_DEFAULT);
            $this->app->settings()->set('admin_password_hash', $hash);
            $this->app->settings()->set('admin_username', $expectedUser);
        }

        // Constant-ish time comparison for the username, hash verify for the password.
        if (hash_equals((string) $expectedUser, $username) && password_verify($password, $hash)) {
            session_regenerate_id(true);
            $_SESSION['admin'] = ['user' => $username, 'at' => time()];
            return Response::redirect(url('/admin'));
        }

        return $this->renderLogin('Wrong username or password.');
    }

    public function logout(Request $request): Response
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        }
        session_destroy();
        return Response::redirect(url('/admin/login'));
    }

    // ----------------------------------------------------------- pages
    public function dashboard(Request $request): Response
    {
        if ($guard = $this->guard()) {
            return $guard;
        }
        $db = $this->app->db();

        return $this->render('admin/dashboard', [
            'title' => 'Dashboard',
            'stats' => [
                'titles' => (int) $db->scalar('SELECT COUNT(*) FROM titles'),
                'views' => (int) $db->scalar('SELECT COALESCE(SUM(views),0) FROM titles'),
                'episodes' => (int) $db->scalar('SELECT COUNT(*) FROM episodes'),
                'endpoints' => $this->app->endpoints()->count(),
                'requests_24h' => (int) $db->scalar("SELECT COUNT(*) FROM api_logs WHERE created_at >= datetime('now','-1 day')"),
                'avg_ms' => (int) $db->scalar("SELECT COALESCE(AVG(duration_ms),0) FROM api_logs WHERE created_at >= datetime('now','-1 day')"),
            ],
            'byType' => $db->all('SELECT type, COUNT(*) AS total FROM titles GROUP BY type ORDER BY total DESC'),
            'topEndpoints' => $db->all(
                "SELECT path, COUNT(*) AS hits, CAST(AVG(duration_ms) AS INTEGER) AS avg_ms
                   FROM api_logs WHERE created_at >= datetime('now','-1 day')
                  GROUP BY path ORDER BY hits DESC LIMIT 8"
            ),
            'recentTitles' => $db->all('SELECT * FROM titles ORDER BY updated_at DESC LIMIT 8'),
        ]);
    }

    public function titles(Request $request): Response
    {
        if ($guard = $this->guard()) {
            return $guard;
        }
        $q = $request->string('q');
        $result = $this->app->titles()->search([
            'q' => $q,
            'page' => max(1, $request->int('page', 1)),
            'per_page' => 20,
            'adult' => $request->bool('adult') ? 1 : 0,
        ]);

        return $this->render('admin/titles', [
            'title' => 'Titles',
            'result' => $result,
            'q' => $q,
            'csrf' => $this->csrf(),
        ]);
    }

    public function saveTitle(Request $request): Response
    {
        if ($guard = $this->guard()) {
            return $guard;
        }
        if (!$this->verifyCsrf($request->string('_token'))) {
            return Response::redirect(url('/admin/titles?csrf=1'));
        }

        $id = $request->int('id', 0);
        $data = [
            'slug' => $request->string('slug'),
            'title' => $request->string('title'),
            'type' => $request->string('type', 'movie'),
            'year' => $request->int('year') ?: null,
            'quality' => $request->string('quality') ?: null,
            'language' => $request->string('language') ?: null,
            'rating' => $request->input('rating') !== null && $request->input('rating') !== '' ? (float) $request->input('rating') : null,
            'poster' => $request->string('poster') ?: null,
            'synopsis' => $request->string('synopsis') ?: null,
            'status' => $request->string('status', 'completed'),
            'ep_label' => $request->string('ep_label') ?: null,
            'ep_state' => $request->string('ep_state') ?: null,
            'is_adult' => $request->bool('is_adult') ? 1 : 0,
            'is_new' => $request->bool('is_new') ? 1 : 0,
            'is_pinned' => $request->bool('is_pinned') ? 1 : 0,
        ];
        if ($data['slug'] === '') {
            $data['slug'] = slugify($data['title']);
        }

        if ($id > 0) {
            $this->app->titles()->update($id, $data);
        } else {
            $id = $this->app->titles()->create($data);
        }

        $genres = array_filter(array_map('trim', explode(',', $request->string('genres'))));
        if ($genres !== []) {
            $this->app->titles()->syncGenres($id, $genres);
        }

        // Auto-create the episode list from a label like "S02 | Ep 1-8 Added".
        if (!empty($data['ep_label'])) {
            $this->app->titles()->syncEpisodes($id, (string) $data['ep_label']);
        }

        return Response::redirect(url('/admin/titles?saved=' . $id));
    }

    public function deleteTitle(Request $request): Response
    {
        if ($guard = $this->guard()) {
            return $guard;
        }
        if (!$this->verifyCsrf($request->string('_token'))) {
            return Response::redirect(url('/admin/titles?csrf=1'));
        }
        $id = $request->int('id', 0);
        if ($id > 0) {
            $this->app->titles()->delete($id);
        }
        return Response::redirect(url('/admin/titles?deleted=1'));
    }

    public function endpoints(Request $request): Response
    {
        if ($guard = $this->guard()) {
            return $guard;
        }
        return $this->render('admin/endpoints', [
            'title' => 'API endpoints',
            'groups' => $this->app->endpoints()->grouped(),
            'total' => $this->app->endpoints()->count(),
        ]);
    }

    public function settings(Request $request): Response
    {
        if ($guard = $this->guard()) {
            return $guard;
        }
        return $this->render('admin/settings', [
            'title' => 'Settings',
            'csrf' => $this->csrf(),
            'values' => $this->app->settings()->all(),
            'saved' => $request->bool('saved'),
        ]);
    }

    public function saveSettings(Request $request): Response
    {
        if ($guard = $this->guard()) {
            return $guard;
        }
        if (!$this->verifyCsrf($request->string('_token'))) {
            return Response::redirect(url('/admin/settings'));
        }

        $allowed = ['meta_title_home', 'meta_description', 'notice_enabled', 'analytics_enabled'];
        foreach ($allowed as $key) {
            if ($request->input($key) !== null) {
                $this->app->settings()->set($key, (string) $request->input($key));
            }
        }

        $password = (string) $request->input('new_password', '');
        if (strlen($password) >= 8) {
            $this->app->settings()->set('admin_password_hash', password_hash($password, PASSWORD_DEFAULT));
        }

        return Response::redirect(url('/admin/settings?saved=1'));
    }

    // -------------------------------------------------------- internals
    private function authed(): bool
    {
        $session = $_SESSION['admin'] ?? null;
        if (!is_array($session)) {
            return false;
        }
        $maxAge = (int) Config::get('app.security.session_hours', 12) * 3600;
        if (time() - (int) ($session['at'] ?? 0) > $maxAge) {
            unset($_SESSION['admin']);
            return false;
        }
        return true;
    }

    private function guard(): ?Response
    {
        return $this->authed() ? null : Response::redirect(url('/admin/login'));
    }

    private function renderLogin(string $error): Response
    {
        return Response::html($this->app->view()->render('admin/login', [
            'title' => 'Admin login',
            'error' => $error,
            'csrf' => $this->csrf(),
            'admin' => true,
            'layout' => null,
        ]));
    }

    /** @param array<string,mixed> $data */
    private function render(string $template, array $data): Response
    {
        $data['csrf'] = $data['csrf'] ?? $this->csrf();
        $data['admin'] = true;
        return Response::html($this->app->view()->render($template, $data));
    }

    private function csrf(): string
    {
        $_SESSION['csrf'] ??= bin2hex(random_bytes(24));
        return (string) $_SESSION['csrf'];
    }

    private function verifyCsrf(string $token): bool
    {
        return $token !== '' && hash_equals((string) ($_SESSION['csrf'] ?? ''), $token);
    }
}

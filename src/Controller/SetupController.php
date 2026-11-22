<?php
/**
 * One-shot remote installer.
 *
 * Serverless deployments start with an empty database and there is no shell to
 * run `bin/console.php migrate --seed`, so this route does it over HTTPS. It is
 * disabled unless SETUP_TOKEN is configured, and it refuses to run once the
 * catalogue exists unless `&fresh=1` is passed explicitly.
 *
 *   GET /setup?token=...            -> apply schema, seed if the DB is empty
 *   GET /setup?token=...&fresh=1    -> drop everything and rebuild
 *   GET /setup?token=...&migrate=1  -> schema only, no seed data
 */

declare(strict_types=1);

namespace App\Controller;

use App\Core\App;
use App\Core\Config;
use App\Core\Env;
use App\Core\Installer;
use App\Core\Request;
use App\Core\Response;
use Throwable;

final class SetupController
{
    public function __construct(private readonly App $app)
    {
    }

    public function run(Request $request): Response
    {
        $expected = trim((string) Env::get('SETUP_TOKEN', ''));
        $token = $request->string('token');

        if ($expected === '') {
            return $this->json([
                'ok' => false,
                'error' => ['code' => 'setup_disabled', 'message' => 'Set SETUP_TOKEN in the environment to enable /setup.'],
            ], 403);
        }

        if ($token === '' || !hash_equals($expected, $token)) {
            return $this->json([
                'ok' => false,
                'error' => ['code' => 'forbidden', 'message' => 'Invalid setup token.'],
            ], 403);
        }

        $fresh = $request->bool('fresh');
        $migrateOnly = $request->bool('migrate');

        try {
            $db = $this->app->db();
        } catch (Throwable $e) {
            return $this->json([
                'ok' => false,
                'error' => [
                    'code' => 'db_unreachable',
                    'message' => $e->getMessage(),
                    'hint' => 'Check DB_DRIVER/DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS (or DB_URL) in the Vercel project.',
                ],
            ], 500);
        }

        $installed = false;
        try {
            $installed = (int) $db->scalar('SELECT COUNT(*) FROM titles') > 0;
        } catch (Throwable) {
            $installed = false;
        }

        if ($installed && !$fresh && !$migrateOnly) {
            return $this->json([
                'ok' => true,
                'data' => [
                    'installed' => true,
                    'message' => 'Database already seeded. Add &fresh=1 to rebuild it, or &migrate=1 to apply schema changes only.',
                ],
            ]);
        }

        try {
            $migration = Installer::migrate($fresh);
            $counts = $migrateOnly ? null : Installer::seed();
        } catch (Throwable $e) {
            error_log('Setup failed: ' . $e->getMessage());

            return $this->json([
                'ok' => false,
                'error' => [
                    'code' => 'setup_failed',
                    'message' => $e->getMessage(),
                ],
            ], 500);
        }

        return $this->json([
            'ok' => true,
            'data' => [
                'installed' => true,
                'driver' => $migration['driver'],
                'schema_statements' => $migration['applied'],
                'fresh' => $migration['fresh'],
                'seeded' => $counts,
                'site' => (string) Config::get('app.url', ''),
            ],
        ]);
    }

    /** @param array<string,mixed> $payload */
    private function json(array $payload, int $status = 200): Response
    {
        $payload['meta'] = [
            'endpoint' => '/setup',
            'generated_at' => date('c'),
        ];

        return Response::json($payload, $status);
    }
}

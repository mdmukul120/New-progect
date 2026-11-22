<?php
/**
 * MovieLinkBD CLI
 *
 *   php bin/console.php migrate [--fresh] [--seed]
 *   php bin/console.php seed
 *   php bin/console.php admin:password <new-password>
 *   php bin/console.php routes
 *   php bin/console.php check
 *
 * The actual schema/seed work lives in App\Core\Installer so the same code
 * also runs from the web setup route on serverless hosts.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

use App\Core\App;
use App\Core\Config;
use App\Core\Database;
use App\Core\Installer;
use App\Core\Storage;

$argv = $_SERVER['argv'] ?? [];
$command = $argv[1] ?? 'help';
$options = array_slice($argv, 2);

$app = App::boot(dirname(__DIR__) . '/public');

if (!function_exists('app')) {
    function app(): App
    {
        return App::boot(dirname(__DIR__) . '/public');
    }
}

function line(string $text = ''): void
{
    echo $text, PHP_EOL;
}

function ok(string $text): void
{
    echo "  \033[32m✔\033[0m ", $text, PHP_EOL;
}

function warn(string $text): void
{
    echo "  \033[33m!\033[0m ", $text, PHP_EOL;
}

function fail(string $text): void
{
    echo "  \033[31m✘\033[0m ", $text, PHP_EOL;
}

function migrate(bool $fresh): void
{
    try {
        $result = Installer::migrate($fresh);
    } catch (Throwable $e) {
        fail('Migration failed: ' . $e->getMessage());
        exit(1);
    }
    if ($fresh) {
        ok('Dropped existing ' . $result['driver'] . ' tables');
    }
    ok('Applied ' . $result['applied'] . ' schema statements (' . $result['driver'] . ')');
}

function seed(): void
{
    try {
        $counts = Installer::seed();
    } catch (Throwable $e) {
        fail('Seed failed: ' . $e->getMessage());
        exit(1);
    }

    ok('Registered ' . $counts['endpoints'] . ' API endpoints');
    unset($counts['endpoints']);
    foreach ($counts as $name => $count) {
        ok(sprintf('%-12s %d new', $name, $count));
    }
}

function check(): void
{
    $root = MLBD_ROOT;

    line('Environment');
    ok('PHP ' . PHP_VERSION . ($root !== '' ? ' at ' . $root : ''));
    if (PHP_VERSION_ID < 80200) {
        fail('PHP 8.2+ is required (found ' . PHP_VERSION . ')');
    }
    $driver = (string) Config::get('database.default', 'sqlite');
    $needed = match ($driver) {
        'pgsql' => ['pdo_pgsql', 'mbstring', 'json', 'openssl'],
        'mysql' => ['pdo_mysql', 'mbstring', 'json', 'openssl'],
        default => ['pdo_sqlite', 'mbstring', 'json', 'openssl'],
    };
    foreach ($needed as $extension) {
        extension_loaded($extension) ? ok('extension ' . $extension) : warn('extension ' . $extension . ' missing');
    }

    line();
    line('Files');
    $required = [
        'public/index.php', 'api/index.php', 'vercel.json', 'src/bootstrap.php', 'config/app.php',
        'database/schema.sqlite.sql', 'database/schema.mysql.sql', 'database/schema.pgsql.sql',
        'database/seed.php', 'database/endpoints.php',
        'templates/layouts/main.php', 'public/assets/css/app.css', 'public/assets/js/app.js',
    ];
    foreach ($required as $file) {
        is_file($root . '/' . $file) ? ok($file) : fail('missing ' . $file);
    }

    line();
    line('Writable');
    $writable = [
        'logs' => Storage::logs(),
        'cache' => Storage::cache(),
        'sessions' => 'database table "sessions" (' . $driver . ')',
    ];
    if ($driver === 'sqlite') {
        $writable['database'] = $root . '/database';
        if (!is_dir($writable['database'])) {
            @mkdir($writable['database'], 0775, true);
        }
    }
    foreach ($writable as $label => $path) {
        if (!str_starts_with($path, '/')) {
            ok($label . ' → ' . $path);
            continue;
        }
        is_writable($path) ? ok($label . ' (' . $path . ')') : fail($label . ' is not writable: ' . $path);
    }

    line();
    line('Database');
    try {
        $db = Database::instance();
        ok('Connected via ' . $db->driver());
        $titles = (int) $db->scalar('SELECT COUNT(*) FROM titles');
        $endpoints = (int) $db->scalar('SELECT COUNT(*) FROM api_endpoints');
        ok($titles . ' titles, ' . $endpoints . ' API endpoints');
    } catch (Throwable $e) {
        warn('Not initialised: ' . $e->getMessage());
        line('    → run: php bin/console.php migrate --seed');
    }

    line();
    line('Ad scan (should be zero)');
    $patterns = ['adsbygoogle', 'adsterra', 'monetag', 'popunder', 'doubleclick', 'googlesyndication', 'propeller', 'onclickads'];
    $hits = 0;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root . '/templates', FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if (!$file->isFile() || !str_ends_with($file->getFilename(), '.php')) {
            continue;
        }
        $contents = strtolower((string) file_get_contents($file->getPathname()));
        foreach ($patterns as $pattern) {
            if (str_contains($contents, $pattern)) {
                fail($pattern . ' found in ' . $file->getPathname());
                $hits++;
            }
        }
    }
    $hits === 0 ? ok('No ad or tracker markers in templates') : fail($hits . ' ad markers found');
}

switch ($command) {
    case 'migrate':
        migrate(in_array('--fresh', $options, true));
        if (in_array('--seed', $options, true)) {
            line();
            seed();
        }
        line();
        ok('Done. Point your web root at /public and open /');
        break;

    case 'seed':
        seed();
        break;

    case 'admin:password':
        $password = $options[0] ?? '';
        if (strlen($password) < 8) {
            fail('Usage: php bin/console.php admin:password <min-8-chars>');
            exit(1);
        }
        $app->settings()->set('admin_password_hash', password_hash($password, PASSWORD_DEFAULT));
        $app->settings()->set('admin_username', (string) \App\Core\Env::get('ADMIN_USERNAME', 'admin'));
        ok('Admin password updated');
        break;

    case 'routes':
        $router = new \App\Core\Router($app);
        $reflection = new ReflectionClass($router);
        $property = $reflection->getProperty('routes');
        $property->setAccessible(true);
        foreach ($property->getValue($router) as $route) {
            printf("  %-6s %s\n", $route['method'], $route['regex']);
        }
        break;

    case 'check':
        check();
        break;

    default:
        line('MovieLinkBD console');
        line();
        line('  php bin/console.php migrate [--fresh] [--seed]');
        line('  php bin/console.php seed');
        line('  php bin/console.php admin:password <password>');
        line('  php bin/console.php routes');
        line('  php bin/console.php check');
        line();
}

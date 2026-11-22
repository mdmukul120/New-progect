<?php
/**
 * MovieLinkBD CLI
 *
 *   php bin/console.php migrate [--fresh] [--seed]
 *   php bin/console.php seed
 *   php bin/console.php admin:password <new-password>
 *   php bin/console.php routes
 *   php bin/console.php check
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

use App\Core\App;
use App\Core\Config;
use App\Core\Database;

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

/** Split a SQL file into statements, respecting trigger-style BEGIN…END. */
function sql_statements(string $sql): array
{
    $lines = preg_split("~\r\n|\n~", $sql) ?: [];
    $buffer = '';
    $statements = [];
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '--')) {
            continue;
        }
        $buffer .= $line . "\n";
        if (str_ends_with($trimmed, ';')) {
            $statements[] = trim($buffer);
            $buffer = '';
        }
    }
    if (trim($buffer) !== '') {
        $statements[] = trim($buffer);
    }
    return $statements;
}

function migrate(bool $fresh): void
{
    $db = Database::instance();
    $driver = $db->driver();

    if ($fresh) {
        if ($driver === 'sqlite') {
            $path = (string) Config::get('database.connections.sqlite.database');
            foreach ([$path, $path . '-wal', $path . '-shm'] as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            ok('Removed existing SQLite database');
            // Re-create the connection so the file is empty again.
            $reflection = new ReflectionClass(Database::class);
            $prop = $reflection->getProperty('instance');
            $prop->setValue(null, null);
            $db = Database::instance();
        } else {
            foreach (['api_logs', 'api_endpoints', 'title_genres', 'collection_items', 'download_links',
                      'episodes', 'titles', 'genres', 'collections', 'ott_platforms', 'notices',
                      'pages', 'settings'] as $table) {
                $db->run('DROP TABLE IF EXISTS ' . $table);
            }
            ok('Dropped existing MySQL tables');
        }
    }

    $schemaFile = MLBD_ROOT . '/database/schema.' . ($driver === 'sqlite' ? 'sqlite' : 'mysql') . '.sql';
    $statements = sql_statements((string) file_get_contents($schemaFile));
    $applied = 0;
    foreach ($statements as $statement) {
        try {
            $db->pdo()->exec($statement);
            $applied++;
        } catch (Throwable $e) {
            // MySQL has no "CREATE INDEX IF NOT EXISTS": ignore duplicates.
            if (str_contains($e->getMessage(), 'Duplicate key name')) {
                continue;
            }
            fail('SQL failed: ' . $e->getMessage());
            fail(substr($statement, 0, 160));
            exit(1);
        }
    }
    ok('Applied ' . $applied . ' schema statements (' . $driver . ')');
}

function seed(): void
{
    $db = Database::instance();
    /** @var array<string,mixed> $data */
    $data = require MLBD_ROOT . '/database/seed.php';

    $counts = ['titles' => 0, 'genres' => 0, 'collections' => 0, 'ott' => 0, 'notices' => 0, 'pages' => 0];

    $db->begin();
    try {
        // --- genres
        foreach ($data['genres'] as $genre) {
            $existing = $db->scalar('SELECT id FROM genres WHERE slug = :s', ['s' => $genre['slug']]);
            if ($existing === null) {
                $db->insert('genres', ['slug' => $genre['slug'], 'name' => $genre['name'], 'icon' => $genre['icon']]);
                $counts['genres']++;
            } else {
                $db->update('genres', ['name' => $genre['name'], 'icon' => $genre['icon']], ['id' => (int) $existing]);
            }
        }

        // --- ott
        foreach ($data['ott'] as $index => $platform) {
            $existing = $db->scalar('SELECT id FROM ott_platforms WHERE slug = :s', ['s' => $platform['slug']]);
            $row = ['slug' => $platform['slug'], 'name' => $platform['name'], 'logo' => $platform['logo'], 'sort' => $index];
            if ($existing === null) {
                $db->insert('ott_platforms', $row);
                $counts['ott']++;
            } else {
                $db->update('ott_platforms', $row, ['id' => (int) $existing]);
            }
        }

        // --- collections
        $collectionIds = [];
        foreach ($data['collections'] as $index => $collection) {
            $existing = $db->scalar('SELECT id FROM collections WHERE slug = :s', ['s' => $collection['slug']]);
            if ($existing === null) {
                $collectionIds[$collection['slug']] = $db->insert('collections', [
                    'slug' => $collection['slug'],
                    'name' => $collection['name'],
                    'description' => $collection['description'],
                    'keywords' => collectionTokens($db, $collection['keywords'] ?? []),
                    'sort' => $index,
                ]);
                $counts['collections']++;
            } else {
                $db->update('collections', [
                    'name' => $collection['name'],
                    'description' => $collection['description'],
                    'keywords' => collectionTokens($db, $collection['keywords'] ?? []),
                    'sort' => $index,
                ], ['id' => (int) $existing]);
                $collectionIds[$collection['slug']] = (int) $existing;
            }
        }

        // --- titles (+ genres, links, episodes)
        foreach ($data['titles'] as $title) {
            $genres = $title['genres'];
            unset($title['genres']);
            $slug = $title['slug'];

            $existing = $db->scalar('SELECT id FROM titles WHERE slug = :s', ['s' => $slug]);
            $row = $title;
            if ($existing === null) {
                $titleId = $db->insert('titles', $row);
                $counts['titles']++;
            } else {
                $titleId = (int) $existing;
                $db->update('titles', $row, ['id' => $titleId]);
            }

            foreach ($genres as $genreSlug) {
                $genreId = $db->scalar('SELECT id FROM genres WHERE slug = :s', ['s' => $genreSlug]);
                if ($genreId === null) {
                    continue;
                }
                $db->run(
                    insertIgnore($db) . 'title_genres (title_id, genre_id) VALUES (:t, :g)',
                    ['t' => $titleId, 'g' => (int) $genreId]
                );
            }

            seedLinks($db, $titleId, $title);

            if (!empty($title['ep_label'])) {
                app()->titles()->syncEpisodes($titleId, (string) $title['ep_label']);
            }
        }

        // --- map collections by keyword
        if ($data['collections'] !== []) {
            $db->run('DELETE FROM collection_items');
            foreach ($data['collections'] as $collection) {
                $collectionId = $collectionIds[$collection['slug']] ?? null;
                if ($collectionId === null) {
                    continue;
                }
                $rows = $db->all('SELECT id, title, language, type FROM titles');
                $sort = 0;
                foreach ($rows as $row) {
                    $haystack = strtolower((string) $row['title'] . ' ' . (string) $row['language'] . ' ' . (string) $row['type']);
                    foreach ($collection['keywords'] as $keyword) {
                        if ($keyword !== '' && str_contains($haystack, strtolower((string) $keyword))) {
                            $db->run(
                                insertIgnore($db) . 'collection_items (collection_id, title_id, sort) VALUES (:c, :t, :s)',
                                ['c' => $collectionId, 't' => (int) $row['id'], 's' => $sort++]
                            );
                            break;
                        }
                    }
                }
            }
        }

        // --- notices
        if ($data['notices'] !== []) {
            $db->run('DELETE FROM notices');
            foreach ($data['notices'] as $index => $notice) {
                $db->insert('notices', [
                    'message' => $notice['message'],
                    'style' => $notice['style'],
                    'color' => $notice['color'],
                    'active' => 1,
                    'sort' => $index,
                ]);
                $counts['notices']++;
            }
        }

        // --- pages
        foreach ($data['pages'] as $page) {
            $existing = $db->scalar('SELECT id FROM pages WHERE slug = :s', ['s' => $page['slug']]);
            if ($existing === null) {
                $db->insert('pages', ['slug' => $page['slug'], 'title' => $page['title'], 'body' => $page['body']]);
                $counts['pages']++;
            }
        }

        // --- api endpoints registry
        $endpoints = require MLBD_ROOT . '/database/endpoints.php';
        $db->run('DELETE FROM api_endpoints');
        foreach ($endpoints as $index => $endpoint) {
            [$method, $path, $category, $summary, $params, $sample] = $endpoint;
            $db->insert('api_endpoints', [
                'method' => $method,
                'path' => $path,
                'category' => $category,
                'summary' => $summary,
                'params' => $params,
                'sample' => $sample,
                'is_public' => 1,
                'sort' => $index,
            ]);
        }
        ok('Registered ' . count($endpoints) . ' API endpoints');

        $db->commit();
    } catch (Throwable $e) {
        $db->rollback();
        fail('Seed failed: ' . $e->getMessage());
        exit(1);
    }

    foreach ($counts as $name => $count) {
        ok(sprintf('%-12s %d new', $name, $count));
    }
}

/** "INSERT IGNORE" on MySQL, "INSERT OR IGNORE" on SQLite. */
function insertIgnore(Database $db): string
{
    return $db->driver() === 'mysql' ? 'INSERT IGNORE INTO ' : 'INSERT OR IGNORE INTO ';
}

/**
 * Normalise collection keywords into a "|a|b|" match string. When a keyword
 * matches a language slug found in the catalogue, the slug itself is added too
 * so the collection query can match on language = token.
 *
 * @param array<int,string> $keywords
 */
function collectionTokens(Database $db, array $keywords): string
{
    $tokens = [];
    foreach ($keywords as $keyword) {
        $keyword = strtolower(trim((string) $keyword));
        if ($keyword === '') {
            continue;
        }
        $tokens[] = $keyword;
        $slug = slugify($keyword);
        if ($slug !== '' && $slug !== $keyword) {
            $tokens[] = $slug;
        }
    }
    $tokens = array_values(array_unique(array_filter($tokens)));
    return $tokens === [] ? '' : '|' . implode('|', $tokens) . '|';
}

function seedLinks(Database $db, int $titleId, array $title): void
{
    $existing = (int) $db->scalar('SELECT COUNT(*) FROM download_links WHERE title_id = :id', ['id' => $titleId]);
    if ($existing > 0) {
        return;
    }
    $quality = $title['quality'] ?: 'WEB-DL';
    $base = 'https://movielinkbd.tv/dl/' . rawurlencode((string) $title['slug']);
    $variants = [
        ['480p HEVC', '480p', '~320 MB'],
        ['720p HEVC', '720p', '~720 MB'],
        ['1080p HEVC', '1080p', '~1.4 GB'],
        ['1080p x264', '1080p', '~2.1 GB'],
    ];
    foreach ($variants as $index => [$label, $q, $size]) {
        $db->insert('download_links', [
            'title_id' => $titleId,
            'label' => $label . ' · ' . $quality,
            'quality' => $q,
            'size' => $size,
            'url' => $base . '?q=' . $q . '&src=web',
            'sort' => $index,
        ]);
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
    foreach (['pdo_sqlite', 'mbstring', 'json', 'openssl'] as $extension) {
        extension_loaded($extension) ? ok('extension ' . $extension) : warn('extension ' . $extension . ' missing');
    }

    line();
    line('Files');
    $required = [
        'public/index.php', 'src/bootstrap.php', 'config/app.php', 'database/schema.sqlite.sql',
        'database/schema.mysql.sql', 'database/seed.php', 'database/endpoints.php',
        'templates/layouts/main.php', 'public/assets/css/app.css', 'public/assets/js/app.js',
    ];
    foreach ($required as $file) {
        is_file($root . '/' . $file) ? ok($file) : fail('missing ' . $file);
    }

    line();
    line('Writable');
    foreach (['storage/logs', 'storage/cache', 'database'] as $dir) {
        $path = $root . '/' . $dir;
        if (!is_dir($path)) {
            @mkdir($path, 0775, true);
        }
        is_writable($path) ? ok($dir) : fail($dir . ' is not writable');
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

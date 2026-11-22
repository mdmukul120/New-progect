<?php
/**
 * Database installer: schema + seed data.
 *
 * Shared by the CLI (`bin/console.php migrate --seed`) and the guarded web
 * setup route (`/setup?token=...`), so a fresh serverless deployment boots
 * through exactly the same code path that local development uses.
 */

declare(strict_types=1);

namespace App\Core;

use App\Repository\TitleRepository;
use ReflectionClass;
use RuntimeException;
use Throwable;

final class Installer
{
    /** Dropped by a fresh install, children first. */
    public const TABLES = [
        'sessions', 'api_logs', 'api_endpoints', 'title_genres', 'collection_items',
        'download_links', 'episodes', 'titles', 'genres', 'collections',
        'ott_platforms', 'notices', 'pages', 'settings',
    ];

    public static function schemaFile(string $driver): string
    {
        return MLBD_ROOT . '/database/schema.' . match ($driver) {
            'pgsql' => 'pgsql',
            'mysql' => 'mysql',
            default => 'sqlite',
        } . '.sql';
    }

    public static function migrate(bool $fresh = false): array
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
                // Re-create the connection so the file is empty again.
                $reflection = new ReflectionClass(Database::class);
                $prop = $reflection->getProperty('instance');
                $prop->setValue(null, null);
                $db = Database::instance();
            } else {
                foreach (['sessions', 'api_logs', 'api_endpoints', 'title_genres', 'collection_items',
                          'download_links', 'episodes', 'titles', 'genres', 'collections',
                          'ott_platforms', 'notices', 'pages', 'settings'] as $table) {
                    $db->run('DROP TABLE IF EXISTS ' . $table);
                }
            }
        }

        $statements = self::splitStatements((string) file_get_contents(self::schemaFile($driver)));
        $applied = 0;
        foreach ($statements as $statement) {
            try {
                $db->pdo()->exec($statement);
                $applied++;
            } catch (Throwable $e) {
                // MySQL has no "CREATE INDEX IF NOT EXISTS": ignore duplicates.
                if (str_contains($e->getMessage(), 'Duplicate key name')
                    || str_contains($e->getMessage(), 'already exists')) {
                    continue;
                }
                throw new RuntimeException(
                    'Schema statement failed: ' . $e->getMessage() . ' — ' . substr($statement, 0, 160),
                    0,
                    $e
                );
            }
        }
        return ['driver' => $driver, 'applied' => $applied, 'fresh' => $fresh];
    }


    public static function seed(): array
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
                        'keywords' => self::collectionTokens($collection['keywords'] ?? []),
                        'sort' => $index,
                    ]);
                    $counts['collections']++;
                } else {
                    $db->update('collections', [
                        'name' => $collection['name'],
                        'description' => $collection['description'],
                        'keywords' => self::collectionTokens($collection['keywords'] ?? []),
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
                        self::insertIgnore($db, 'title_genres', '(title_id, genre_id)', 'VALUES (:t, :g)', '(title_id, genre_id)'),
                        ['t' => $titleId, 'g' => (int) $genreId]
                    );
                }

                self::seedLinks($db, $titleId, $title);

                if (!empty($title['ep_label'])) {
                    (new TitleRepository($db))->syncEpisodes($titleId, (string) $title['ep_label']);
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
                                    self::insertIgnore(
                                        $db,
                                        'collection_items',
                                        '(collection_id, title_id, sort)',
                                        'VALUES (:c, :t, :s)',
                                        '(collection_id, title_id)'
                                    ),
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

            $counts['endpoints'] = count($endpoints);

            $db->commit();
        } catch (Throwable $e) {
            $db->rollback();
            throw $e;
        }

        return $counts;
    }


/** Dialect-neutral "insert, skip duplicates" statement. */
    private static function insertIgnore(Database $db, string $table, string $columns, string $values, string $conflict): string
    {
        return $db->insertIgnore($table, $columns, $values, $conflict);
    }

/**
 * Normalise collection keywords into a "|a|b|" match string. When a keyword
 * matches a language slug found in the catalogue, the slug itself is added too
 * so the collection query can match on language = token.
 *
 * @param array<int,string> $keywords
 */
    private static function collectionTokens(array $keywords): string
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

    private static function seedLinks(Database $db, int $titleId, array $title): void
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


    private static function splitStatements(string $sql): array
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

}

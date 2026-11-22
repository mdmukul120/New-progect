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


    /**
     * Import the captured catalogue.
     *
     * Every table is written with ONE multi-row statement instead of one
     * statement per row: the production database lives in another region, so
     * ~1,800 round trips would blow past a serverless request timeout while
     * ~15 batched statements take well under a second.
     *
     * @return array<string,int>
     */
    public static function seed(): array
    {
        $db = Database::instance();
        /** @var array<string,mixed> $data */
        $data = require MLBD_ROOT . '/database/seed.php';

        $counts = ['titles' => 0, 'genres' => 0, 'collections' => 0, 'ott' => 0, 'notices' => 0, 'pages' => 0];
        $now = date('Y-m-d H:i:s');

        $db->begin();
        try {
            // --- genres -------------------------------------------------
            $genres = [];
            foreach ($data['genres'] as $genre) {
                $genres[] = ['slug' => $genre['slug'], 'name' => $genre['name'], 'icon' => $genre['icon']];
            }
            $genreColumns = ['slug', 'name', 'icon'];
            self::runBatch($db, self::upsertSql($db, 'genres', $genreColumns, count($genres), '(slug)'), $genres, $genreColumns);
            $counts['genres'] = count($genres);

            // --- ott platforms ------------------------------------------
            $ott = [];
            foreach ($data['ott'] as $index => $platform) {
                $ott[] = [
                    'slug' => $platform['slug'],
                    'name' => $platform['name'],
                    'logo' => $platform['logo'],
                    'sort' => $index,
                ];
            }
            $ottColumns = ['slug', 'name', 'logo', 'sort'];
            self::runBatch($db, self::upsertSql($db, 'ott_platforms', $ottColumns, count($ott), '(slug)'), $ott, $ottColumns);
            $counts['ott'] = count($ott);

            // --- collections --------------------------------------------
            $collections = [];
            foreach ($data['collections'] as $index => $collection) {
                $collections[] = [
                    'slug' => $collection['slug'],
                    'name' => $collection['name'],
                    'description' => $collection['description'],
                    'keywords' => self::collectionTokens($collection['keywords'] ?? []),
                    'sort' => $index,
                ];
            }
            $collectionColumns = ['slug', 'name', 'description', 'keywords', 'sort'];
            self::runBatch(
                $db,
                self::upsertSql($db, 'collections', $collectionColumns, count($collections), '(slug)'),
                $collections,
                $collectionColumns
            );
            $counts['collections'] = count($collections);

            // --- titles -------------------------------------------------
            $titles = [];
            $genreSlugsByTitle = [];
            $linkRowsByTitle = [];
            $episodesByTitle = [];

            foreach ($data['titles'] as $title) {
                $genreSlugsByTitle[$title['slug']] = $title['genres'];
                unset($title['genres']);
                $title['created_at'] = $now;
                $title['updated_at'] = $now;
                $titles[] = $title;

                $linkRowsByTitle[$title['slug']] = self::downloadVariants($title);
                $episodesByTitle[$title['slug']] = self::episodeNumbers((string) ($title['ep_label'] ?? ''));
            }

            $titleColumns = array_keys($titles[0]);
            self::runBatch(
                $db,
                self::upsertSql($db, 'titles', $titleColumns, count($titles), '(slug)', ['created_at']),
                $titles,
                $titleColumns
            );
            $counts['titles'] = count($titles);

            $titleIds = [];
            foreach ($db->all('SELECT id, slug FROM titles') as $row) {
                $titleIds[(string) $row['slug']] = (int) $row['id'];
            }
            $genreIds = [];
            foreach ($db->all('SELECT id, slug FROM genres') as $row) {
                $genreIds[(string) $row['slug']] = (int) $row['id'];
            }

            // --- title <-> genre pairs ----------------------------------
            $pairs = [];
            foreach ($genreSlugsByTitle as $slug => $slugs) {
                $titleId = $titleIds[$slug] ?? null;
                if ($titleId === null) {
                    continue;
                }
                foreach ($slugs as $genreSlug) {
                    if (isset($genreIds[$genreSlug])) {
                        $pairs[] = ['title_id' => $titleId, 'genre_id' => $genreIds[$genreSlug]];
                    }
                }
            }
            $pairColumns = ['title_id', 'genre_id'];
            self::runBatch(
                $db,
                self::upsertSql($db, 'title_genres', $pairColumns, count($pairs), '(title_id, genre_id)'),
                $pairs,
                $pairColumns
            );

            // --- download links (only for titles that have none) --------
            $withLinks = [];
            foreach ($db->all('SELECT DISTINCT title_id FROM download_links') as $row) {
                $withLinks[(int) $row['title_id']] = true;
            }
            $links = [];
            foreach ($linkRowsByTitle as $slug => $rows) {
                $titleId = $titleIds[$slug] ?? null;
                if ($titleId === null || isset($withLinks[$titleId])) {
                    continue;
                }
                foreach ($rows as $row) {
                    $links[] = ['title_id' => $titleId] + $row;
                }
            }
            $linkColumns = ['title_id', 'label', 'quality', 'size', 'url', 'sort'];
            self::runBatch($db, self::insertSql('download_links', $linkColumns, count($links)), $links, $linkColumns);

            // --- episodes ----------------------------------------------
            $episodes = [];
            foreach ($episodesByTitle as $slug => $seasons) {
                $titleId = $titleIds[$slug] ?? null;
                if ($titleId === null) {
                    continue;
                }
                foreach ($seasons as $season => $numbers) {
                    foreach ($numbers as $episode) {
                        $episodes[] = [
                            'title_id' => $titleId,
                            'season' => $season,
                            'episode' => $episode,
                            'name' => 'Episode ' . $episode,
                        ];
                    }
                }
            }
            $episodeColumns = ['title_id', 'season', 'episode', 'name'];
            self::runBatch(
                $db,
                self::upsertSql($db, 'episodes', $episodeColumns, count($episodes), '(title_id, season, episode)'),
                $episodes,
                $episodeColumns
            );

            // --- collection membership, matched on keywords -------------
            $db->run('DELETE FROM collection_items');
            $collectionIds = [];
            foreach ($db->all('SELECT id, slug FROM collections') as $row) {
                $collectionIds[(string) $row['slug']] = (int) $row['id'];
            }
            $catalogue = $db->all('SELECT id, title, language, type FROM titles');
            $items = [];
            foreach ($data['collections'] as $collection) {
                $collectionId = $collectionIds[$collection['slug']] ?? null;
                if ($collectionId === null) {
                    continue;
                }
                $keywords = array_values(array_filter(array_map(
                    static fn ($keyword): string => strtolower(trim((string) $keyword)),
                    $collection['keywords'] ?? []
                ), static fn (string $keyword): bool => $keyword !== ''));
                if ($keywords === []) {
                    continue;
                }
                $sort = 0;
                foreach ($catalogue as $item) {
                    $haystack = strtolower((string) $item['title'] . ' ' . (string) $item['language'] . ' ' . (string) $item['type']);
                    foreach ($keywords as $keyword) {
                        if (str_contains($haystack, $keyword)) {
                            $items[] = ['collection_id' => $collectionId, 'title_id' => (int) $item['id'], 'sort' => $sort++];
                            break;
                        }
                    }
                }
            }
            $itemColumns = ['collection_id', 'title_id', 'sort'];
            self::runBatch(
                $db,
                self::upsertSql($db, 'collection_items', $itemColumns, count($items), '(collection_id, title_id)'),
                $items,
                $itemColumns
            );

            // --- notices ------------------------------------------------
            $db->run('DELETE FROM notices');
            $notices = [];
            foreach ($data['notices'] as $index => $notice) {
                $notices[] = [
                    'message' => $notice['message'],
                    'style' => $notice['style'],
                    'color' => $notice['color'],
                    'active' => 1,
                    'sort' => $index,
                ];
            }
            $noticeColumns = ['message', 'style', 'color', 'active', 'sort'];
            self::runBatch($db, self::insertSql('notices', $noticeColumns, count($notices)), $notices, $noticeColumns);
            $counts['notices'] = count($notices);

            // --- pages --------------------------------------------------
            $pages = [];
            foreach ($data['pages'] as $page) {
                $pages[] = [
                    'slug' => $page['slug'],
                    'title' => $page['title'],
                    'body' => $page['body'],
                    'updated_at' => $now,
                ];
            }
            $pageColumns = ['slug', 'title', 'body', 'updated_at'];
            self::runBatch(
                $db,
                self::upsertSql($db, 'pages', $pageColumns, count($pages), '(slug)'),
                $pages,
                $pageColumns
            );
            $counts['pages'] = count($pages);

            // --- api endpoint registry ----------------------------------
            $endpoints = require MLBD_ROOT . '/database/endpoints.php';
            $db->run('DELETE FROM api_endpoints');
            $endpointRows = [];
            foreach ($endpoints as $index => $endpoint) {
                [$method, $path, $category, $summary, $params, $sample] = $endpoint;
                $endpointRows[] = [
                    'method' => $method,
                    'path' => $path,
                    'category' => $category,
                    'summary' => $summary,
                    'params' => $params,
                    'sample' => $sample,
                    'is_public' => 1,
                    'sort' => $index,
                ];
            }
            $endpointColumns = ['method', 'path', 'category', 'summary', 'params', 'sample', 'is_public', 'sort'];
            self::runBatch($db, self::insertSql('api_endpoints', $endpointColumns, count($endpointRows)), $endpointRows, $endpointColumns);
            $counts['endpoints'] = count($endpointRows);

            $db->commit();
        } catch (Throwable $e) {
            $db->rollback();
            throw $e;
        }

        return $counts;
    }

    /** Multi-row VALUES list with ":column_0" style placeholders. */
    private static function insertSql(string $table, array $columns, int $rowCount): string
    {
        $groups = [];
        for ($i = 0; $i < $rowCount; $i++) {
            $groups[] = '(' . implode(', ', array_map(
                static fn (string $column): string => ':' . $column . '_' . $i,
                $columns
            )) . ')';
        }
        return 'INSERT INTO ' . $table . ' (' . implode(', ', $columns) . ') VALUES ' . implode(', ', $groups);
    }

    /**
     * Multi-row "insert or update the row that already has this key" statement
     * for the active dialect: Postgres/SQLite use ON CONFLICT, MySQL uses
     * ON DUPLICATE KEY UPDATE.
     *
     * @param array<int,string> $columns
     * @param array<int,string> $preserve columns that must never be overwritten
     */
    private static function upsertSql(
        Database $db,
        string $table,
        array $columns,
        int $rowCount,
        string $conflictTarget,
        array $preserve = []
    ): string {
        $sql = self::insertSql($table, $columns, $rowCount);
        $assignable = array_values(array_filter($columns, static fn (string $c): bool => !in_array($c, $preserve, true)));

        if ($assignable === []) {
            return $db->driver() === 'mysql' ? $sql : $sql . ' ON CONFLICT ' . $conflictTarget . ' DO NOTHING';
        }

        if ($db->driver() === 'mysql') {
            return $sql . ' ON DUPLICATE KEY UPDATE ' . implode(', ', array_map(
                static fn (string $column): string => $column . ' = VALUES(' . $column . ')',
                $assignable
            ));
        }

        return $sql . ' ON CONFLICT ' . $conflictTarget . ' DO UPDATE SET ' . implode(', ', array_map(
            static fn (string $column): string => $column . ' = excluded.' . $column,
            $assignable
        ));
    }

    /**
     * Run one batched statement with flattened bindings.
     *
     * @param array<int,array<string,mixed>> $rows
     * @param array<int,string> $columns
     */
    private static function runBatch(Database $db, string $sql, array $rows, array $columns): void
    {
        if ($rows === []) {
            return;
        }
        $bindings = [];
        foreach ($rows as $index => $row) {
            foreach ($columns as $column) {
                $bindings[$column . '_' . $index] = $row[$column] ?? null;
            }
        }
        $db->run($sql, $bindings);
    }

    /** The four mirror rows every title gets. */
    private static function downloadVariants(array $title): array
    {
        $quality = $title['quality'] ?: 'WEB-DL';
        $base = 'https://movielinkbd.tv/dl/' . rawurlencode((string) $title['slug']);
        $variants = [
            ['480p HEVC', '480p', '~320 MB'],
            ['720p HEVC', '720p', '~720 MB'],
            ['1080p HEVC', '1080p', '~1.4 GB'],
            ['1080p x264', '1080p', '~2.1 GB'],
        ];
        $rows = [];
        foreach ($variants as $index => [$label, $q, $size]) {
            $rows[] = [
                'label' => $label . ' · ' . $quality,
                'quality' => $q,
                'size' => $size,
                'url' => $base . '?q=' . $q . '&src=web',
                'sort' => $index,
            ];
        }
        return $rows;
    }

    /**
     * Episode numbers per season, mirroring TitleRepository::syncEpisodes().
     *
     * @return array<int,array<int,int>>
     */
    private static function episodeNumbers(string $label): array
    {
        if ($label === '') {
            return [];
        }
        $season = 1;
        if (preg_match('~S(\d{1,2})~i', $label, $seasonMatch)) {
            $season = (int) $seasonMatch[1];
        }
        if (preg_match('~Ep\.?\s*(\d{1,3})\s*-\s*(\d{1,3})~i', $label, $range)) {
            $from = (int) $range[1];
            $to = min((int) $range[2], $from + 199);
            return $from <= $to ? [$season => range($from, $to)] : [];
        }
        if (preg_match('~Ep\.?\s*(\d{1,3})~i', $label, $single)) {
            return [$season => [(int) $single[1]]];
        }
        return [];
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

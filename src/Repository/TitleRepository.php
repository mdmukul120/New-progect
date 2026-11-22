<?php
/**
 * Titles: search / filter / paginate + single lookups.
 */

declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

final class TitleRepository
{
    public const TYPES = ['movie', 'series', 'anime', 'drama', 'animation'];
    public const SORTS = [
        'recent' => 'updated_at DESC, views DESC',
        'latest' => 'created_at DESC',
        'views' => 'views DESC',
        'rating' => 'rating DESC, views DESC',
        'title' => 'title ASC',
        'year' => 'year DESC, updated_at DESC',
    ];

    public function __construct(private readonly Database $db)
    {
    }

    /**
     * @param array<string,mixed> $params
     * @return array{items:array<int,array<string,mixed>>,total:int,page:int,per_page:int,pages:int}
     */
    public function search(array $params = []): array
    {
        [$where, $bindings] = $this->buildWhere($params);

        $perPage = (int) ($params['per_page'] ?? 24);
        $perPage = $perPage < 1 ? 24 : min($perPage, 60);
        $page = max(1, (int) ($params['page'] ?? 1));

        $total = (int) $this->db->scalar('SELECT COUNT(*) FROM titles ' . $where, $bindings);
        $pages = max(1, (int) ceil($total / $perPage));
        $page = min($page, $pages);

        $sort = self::SORTS[(string) ($params['sort'] ?? 'recent')] ?? self::SORTS['recent'];
        $sql = 'SELECT * FROM titles ' . $where . ' ORDER BY ' . $sort
            . ' LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage);

        $items = $this->db->all($sql, $bindings);

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'pages' => $pages,
        ];
    }

    /**
     * @param array<string,mixed> $params
     * @return array{0:string,1:array<string,mixed>}
     */
    private function buildWhere(array $params): array
    {
        $clauses = [];
        $bindings = [];

        $type = $params['type'] ?? null;
        if ($type !== null && $type !== '' && in_array($type, self::TYPES, true)) {
            $clauses[] = 'type = :type';
            $bindings['type'] = $type;
        }

        $language = (string) ($params['language'] ?? '');
        if ($language !== '') {
            $langs = array_values(array_filter(array_map('trim', explode(',', $language))));
            if ($langs !== []) {
                // `language` is the primary bucket, `languages` lists every
                // language present in labels such as "Dual [Hindi-Tamil]".
                $ph = [];
                foreach (array_slice($langs, 0, 12) as $i => $lang) {
                    $ph[] = 'language = :lang' . $i . ' OR languages LIKE :langlike' . $i;
                    $bindings['lang' . $i] = $lang;
                    $bindings['langlike' . $i] = '%|' . $lang . '|%';
                }
                $clauses[] = '(' . implode(' OR ', $ph) . ')';
            }
        }

        $genre = (string) ($params['genre'] ?? '');
        if ($genre !== '') {
            $clauses[] = 'id IN (SELECT tg.title_id FROM title_genres tg
                                   JOIN genres g ON g.id = tg.genre_id WHERE g.slug = :genre)';
            $bindings['genre'] = $genre;
        }

        $collection = (string) ($params['collection'] ?? '');
        if ($collection !== '') {
            // Curated members first (collection_items), then a keyword match so a
            // newly published title joins its collection automatically. Kept in
            // one sub-select so COUNT(*) and the page query stay identical.
            $byLanguage = $this->containsToken('c2.keywords', "LOWER(COALESCE(t.language, ''))");
            $byType = $this->containsToken('c3.keywords', 'LOWER(t.type)');
            $byGenre = $this->containsToken('c4.keywords', 'LOWER(g.slug)');
            $clauses[] = "id IN (
                SELECT ci.title_id FROM collection_items ci
                  JOIN collections c ON c.id = ci.collection_id
                 WHERE c.slug = :collection
                UNION
                SELECT t.id FROM titles t
                  JOIN collections c2 ON c2.slug = :collection
                 WHERE t.is_adult = 0 AND {$byLanguage}
                UNION
                SELECT t.id FROM titles t
                  JOIN collections c3 ON c3.slug = :collection
                 WHERE t.is_adult = 0 AND {$byType}
                UNION
                SELECT t.id FROM titles t
                  JOIN title_genres tg ON tg.title_id = t.id
                  JOIN genres g ON g.id = tg.genre_id
                  JOIN collections c4 ON c4.slug = :collection
                 WHERE t.is_adult = 0 AND {$byGenre}
            )";
            $bindings['collection'] = $collection;
        }

        $ott = (string) ($params['ott'] ?? '');
        if ($ott !== '') {
            $clauses[] = 'ott_slug = :ott';
            $bindings['ott'] = $ott;
        }

        $status = (string) ($params['status'] ?? '');
        if (in_array($status, ['completed', 'ongoing', 'upcoming'], true)) {
            $clauses[] = 'status = :status';
            $bindings['status'] = $status;
        } elseif (empty($params['include_upcoming'])) {
            // Not-yet-released titles live only on /upcoming and the home rail,
            // so they never rank inside normal archives or the API listing.
            $clauses[] = "status <> 'upcoming'";
        }

        if (array_key_exists('adult', $params) && $params['adult'] !== null && $params['adult'] !== '') {
            $clauses[] = 'is_adult = :adult';
            $bindings['adult'] = (int) (bool) $params['adult'];
        }

        if (array_key_exists('pinned', $params) && $params['pinned'] !== null && $params['pinned'] !== '') {
            $clauses[] = 'is_pinned = :pinned';
            $bindings['pinned'] = (int) (bool) $params['pinned'];
        }

        if (array_key_exists('new', $params) && $params['new'] !== null && $params['new'] !== '') {
            $clauses[] = 'is_new = :is_new';
            $bindings['is_new'] = (int) (bool) $params['new'];
        }

        $year = (int) ($params['year'] ?? 0);
        if ($year > 1900) {
            $clauses[] = 'year = :year';
            $bindings['year'] = $year;
        }

        if (isset($params['min_views']) && (int) $params['min_views'] > 0) {
            $clauses[] = 'views >= :min_views';
            $bindings['min_views'] = (int) $params['min_views'];
        }

        $q = trim((string) ($params['q'] ?? ''));
        if ($q !== '') {
            $clauses[] = '(title LIKE :q OR COALESCE(language, \'\') LIKE :q OR COALESCE(language_raw, \'\') LIKE :q OR COALESCE(quality, \'\') LIKE :q)';
            $bindings['q'] = '%' . $q . '%';
        }

        if (isset($params['exclude']) && (int) $params['exclude'] > 0) {
            $clauses[] = 'id <> :exclude';
            $bindings['exclude'] = (int) $params['exclude'];
        }

        return [$clauses === [] ? '' : 'WHERE ' . implode(' AND ', $clauses), $bindings];
    }

    /**
     * Concatenate SQL expressions with the current driver's operator.
     * SQLite and Postgres use `||`, MySQL needs CONCAT().
     *
     * @param array<int,string> $parts
     */
    private function concat(array $parts): string
    {
        return $this->db->driver() === 'mysql'
            ? 'CONCAT(' . implode(', ', $parts) . ')'
            : '(' . implode(' || ', $parts) . ')';
    }

    /**
     * "|a|b|"-style token list contains the value of $valueExpression,
     * e.g. `|hindi|tamil|` matched against `hindi`.
     */
    private function containsToken(string $tokenColumn, string $valueExpression): string
    {
        return $this->concat(["'|'", 'COALESCE(' . $tokenColumn . ", '')", "'|'"])
            . ' LIKE '
            . $this->concat(["'%|'", $valueExpression, "'|%'"]);
    }

    /** @return array<string,mixed>|null */
    public function find(string $slug): ?array
    {
        $row = $this->db->one('SELECT * FROM titles WHERE slug = :slug LIMIT 1', ['slug' => $slug]);
        return $row === null ? null : $this->hydrate($row);
    }

    /** @return array<string,mixed>|null */
    public function findById(int $id): ?array
    {
        $row = $this->db->one('SELECT * FROM titles WHERE id = :id', ['id' => $id]);
        return $row === null ? null : $this->hydrate($row);
    }

    /**
     * Replace the genre pivot for a title.
     *
     * @param array<int,string> $slugs
     */
    public function syncGenres(int $titleId, array $slugs): void
    {
        $this->db->run('DELETE FROM title_genres WHERE title_id = :id', ['id' => $titleId]);
        foreach (array_unique($slugs) as $slug) {
            $genreId = $this->db->scalar('SELECT id FROM genres WHERE slug = :slug', ['slug' => $slug]);
            if ($genreId === null) {
                $this->db->insert('genres', ['slug' => $slug, 'name' => ucfirst(str_replace('-', ' ', $slug))]);
                $genreId = $this->db->scalar('SELECT id FROM genres WHERE slug = :slug', ['slug' => $slug]);
            }
            $this->db->run(
                $this->db->insertIgnore(
                    'title_genres',
                    '(title_id, genre_id)',
                    'VALUES (:t, :g)',
                    '(title_id, genre_id)'
                ),
                ['t' => $titleId, 'g' => (int) $genreId]
            );
        }
    }

    /** @return array<int,string> */
    public function genresFor(int $titleId): array
    {
        /** @var array<int,string> $rows */
        $rows = array_column(
            $this->db->all(
                'SELECT g.slug FROM genres g JOIN title_genres tg ON tg.genre_id = g.id
                  WHERE tg.title_id = :id ORDER BY g.name',
                ['id' => $titleId]
            ),
            'slug'
        );
        return $rows;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private function hydrate(array $row): array
    {
        $row['id'] = (int) $row['id'];
        $row['genres'] = $this->genresFor((int) $row['id']);
        return $row;
    }

    /** @return array<int,array<string,mixed>> */
    public function topRated(int $limit = 10): array
    {
        return $this->db->all(
            'SELECT * FROM titles WHERE is_adult = 0 ORDER BY views DESC, rating DESC LIMIT ' . max(1, $limit)
        );
    }

    /** @return array<int,array<string,mixed>> */
    public function upcoming(int $limit = 12): array
    {
        return $this->db->all(
            "SELECT * FROM titles
              WHERE status = 'upcoming' OR is_upcoming = 1
              ORDER BY COALESCE(release_date, '9999-12-31') ASC LIMIT " . max(1, $limit)
        );
    }

    /** @return array<int,array<string,mixed>> */
    public function downloadLinks(int $titleId): array
    {
        return $this->db->all(
            'SELECT * FROM download_links WHERE title_id = :id ORDER BY sort, id',
            ['id' => $titleId]
        );
    }

    /** @return array<int,array<string,mixed>> */
    public function episodes(int $titleId, ?int $season = null): array
    {
        $sql = 'SELECT * FROM episodes WHERE title_id = :id';
        $bindings = ['id' => $titleId];
        if ($season !== null) {
            $sql .= ' AND season = :season';
            $bindings['season'] = $season;
        }
        return $this->db->all($sql . ' ORDER BY season, episode', $bindings);
    }

    /**
     * Create episode rows from a label such as "S05 | Ep 1-9 Added".
     * Safe to call repeatedly: existing (title, season, episode) pairs are kept.
     */
    public function syncEpisodes(int $titleId, string $label): int
    {
        if ($label === '') {
            return 0;
        }

        $season = 1;
        if (preg_match('~S(\d{1,2})~i', $label, $seasonMatch)) {
            $season = (int) $seasonMatch[1];
        }

        $numbers = [];
        if (preg_match('~Ep\.?\s*(\d{1,3})\s*-\s*(\d{1,3})~i', $label, $range)) {
            $from = (int) $range[1];
            $to = min((int) $range[2], $from + 199);
            $numbers = $from <= $to ? range($from, $to) : [];
        } elseif (preg_match('~Ep\.?\s*(\d{1,3})~i', $label, $single)) {
            $numbers = [(int) $single[1]];
        }

        $inserted = 0;
        // The name column must be in the column list, otherwise the fourth
        // placeholder has nowhere to go (Postgres rejects it outright).
        $verb = $this->db->insertIgnore(
            'episodes',
            '(title_id, season, episode, name)',
            'VALUES (:t, :s, :e, :n)',
            '(title_id, season, episode)'
        );
        foreach ($numbers as $episode) {
            $this->db->run(
                $verb,
                ['t' => $titleId, 's' => $season, 'e' => $episode, 'n' => 'Episode ' . $episode]
            );
            $inserted++;
        }
        return $inserted;
    }

    /**
     * Related titles: same type + shared genre, never the current one.
     *
     * @return array<int,array<string,mixed>>
     */
    public function related(array $title, int $limit = 8): array
    {
        if ($title['genres'] !== []) {
            $slug = $title['genres'][0];
            $rows = $this->db->all(
                'SELECT t.* FROM titles t
                   JOIN title_genres tg ON tg.title_id = t.id
                   JOIN genres g ON g.id = tg.genre_id
                  WHERE g.slug = :genre AND t.id <> :id AND t.is_adult = 0
                  ORDER BY t.views DESC LIMIT ' . max(1, $limit),
                ['genre' => $slug, 'id' => (int) $title['id']]
            );
            if ($rows !== []) {
                return $rows;
            }
        }
        return $this->db->all(
            'SELECT * FROM titles WHERE type = :type AND id <> :id AND is_adult = 0
              ORDER BY views DESC LIMIT ' . max(1, $limit),
            ['type' => $title['type'], 'id' => (int) $title['id']]
        );
    }

    public function incrementViews(int $id): void
    {
        $this->db->run('UPDATE titles SET views = views + 1 WHERE id = :id', ['id' => $id]);
    }

    /** @return array<string,int> */
    public function counts(): array
    {
        $rows = $this->db->all('SELECT type, COUNT(*) AS c FROM titles GROUP BY type');
        $out = ['all' => 0];
        foreach ($rows as $row) {
            $out[$row['type']] = (int) $row['c'];
            $out['all'] += (int) $row['c'];
        }
        return $out;
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $data['updated_at'] = date('Y-m-d H:i:s');
        return $this->db->insert('titles', $data);
    }

    /** @param array<string,mixed> $data */
    public function update(int $id, array $data): void
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        $this->db->update('titles', $data, ['id' => $id]);
    }

    public function delete(int $id): void
    {
        $this->db->run('DELETE FROM titles WHERE id = :id', ['id' => $id]);
    }
}

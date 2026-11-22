<?php
/**
 * Genres (action, thriller, ...).
 */

declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

final class GenreRepository
{
    public function __construct(private readonly Database $db)
    {
    }

    /** @return array<int,array<string,mixed>> */
    public function all(): array
    {
        return $this->db->all(
            'SELECT g.*, (SELECT COUNT(*) FROM title_genres tg WHERE tg.genre_id = g.id) AS titles_count
               FROM genres g ORDER BY g.name'
        );
    }

    /**
     * Genres that actually have public titles, sorted by popularity.
     *
     * @return array<int,array<string,mixed>>
     */
    public function popular(int $limit = 40): array
    {
        return $this->db->all(
            'SELECT g.slug, g.name, COUNT(t.id) AS titles_count
               FROM genres g
               JOIN title_genres tg ON tg.genre_id = g.id
               JOIN titles t ON t.id = tg.title_id AND t.is_adult = 0
              GROUP BY g.id ORDER BY titles_count DESC, g.name LIMIT ' . max(1, $limit)
        );
    }

    /** @return array<string,mixed>|null */
    public function find(string $slug): ?array
    {
        return $this->db->one('SELECT * FROM genres WHERE slug = :slug', ['slug' => $slug]);
    }
}

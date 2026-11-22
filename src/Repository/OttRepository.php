<?php
/**
 * OTT platforms (Netflix, Prime, Chorki, ...).
 */

declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

final class OttRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly TitleRepository $titles
    ) {
    }

    /** @return array<int,array<string,mixed>> */
    public function all(): array
    {
        return $this->db->all(
            'SELECT o.*, (SELECT COUNT(*) FROM titles t WHERE t.ott_slug = o.slug AND t.is_adult = 0) AS titles_count
               FROM ott_platforms o ORDER BY titles_count DESC, o.sort, o.name'
        );
    }

    /** @return array<string,mixed>|null */
    public function find(string $slug): ?array
    {
        return $this->db->one('SELECT * FROM ott_platforms WHERE slug = :slug', ['slug' => $slug]);
    }
}

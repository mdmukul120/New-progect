<?php
/**
 * Curated collections (MCU, DC, Bangla web series, ...).
 */

declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

final class CollectionRepository
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
            'SELECT c.*, (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS titles_count
               FROM collections c ORDER BY c.sort, c.name'
        );
    }

    /** @return array<string,mixed>|null */
    public function find(string $slug): ?array
    {
        return $this->db->one('SELECT * FROM collections WHERE slug = :slug', ['slug' => $slug]);
    }

    /** @return array<int,array<string,mixed>> */
    public function items(string $slug, int $limit = 24): array
    {
        return $this->db->all(
            'SELECT t.* FROM titles t
               JOIN collection_items ci ON ci.title_id = t.id
               JOIN collections c ON c.id = ci.collection_id
              WHERE c.slug = :slug
              ORDER BY ci.sort, t.views DESC LIMIT ' . max(1, $limit),
            ['slug' => $slug]
        );
    }
}

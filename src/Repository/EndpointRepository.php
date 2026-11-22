<?php
/**
 * The API endpoint registry — single source of truth for /api docs,
 * the OpenAPI-style index and the admin API browser.
 *
 * Endpoints are also auto-collected from src/Controller/ApiController.php
 * attributes ("@api" docblocks) at schema-sync time.
 */

declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

final class EndpointRepository
{
    public function __construct(private readonly Database $db)
    {
    }

    /** @return array<int,array<string,mixed>> */
    public function all(): array
    {
        return $this->db->all('SELECT * FROM api_endpoints ORDER BY category, sort, path');
    }

    /** @return array<string,array<int,array<string,mixed>>> */
    public function grouped(): array
    {
        $groups = [];
        foreach ($this->all() as $endpoint) {
            $groups[(string) $endpoint['category']][] = $endpoint;
        }
        return $groups;
    }

    public function count(): int
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM api_endpoints');
    }
}

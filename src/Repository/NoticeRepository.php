<?php
/**
 * The homepage notice board.
 */

declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

final class NoticeRepository
{
    public function __construct(private readonly Database $db)
    {
    }

    /** @return array<int,array<string,mixed>> */
    public function active(): array
    {
        return $this->db->all('SELECT * FROM notices WHERE active = 1 ORDER BY sort, id');
    }
}

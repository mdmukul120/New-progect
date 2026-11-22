<?php
/**
 * Key/value settings (admin credentials live here, hashed).
 */

declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

final class SettingRepository
{
    /** @var array<string,string>|null */
    private ?array $cache = null;

    public function __construct(private readonly Database $db)
    {
    }

    public function get(string $key, ?string $default = null): ?string
    {
        $this->cache ??= $this->loadAll();
        return $this->cache[$key] ?? $default;
    }

    public function set(string $key, string $value): void
    {
        $exists = $this->db->scalar('SELECT 1 FROM settings WHERE ' . $this->keyColumn() . ' = :k', ['k' => $key]);
        if ($exists === null) {
            $this->db->run(
                'INSERT INTO settings (' . $this->keyColumn() . ', value) VALUES (:k, :v)',
                ['k' => $key, 'v' => $value]
            );
        } else {
            $this->db->run(
                'UPDATE settings SET value = :v WHERE ' . $this->keyColumn() . ' = :k',
                ['k' => $key, 'v' => $value]
            );
        }
        $this->cache = null;
    }

    /** @return array<string,string> */
    public function all(): array
    {
        return $this->cache ??= $this->loadAll();
    }

    /** @return array<string,string> */
    private function loadAll(): array
    {
        $rows = $this->db->all('SELECT ' . $this->keyColumn() . ' AS k, value FROM settings');
        $out = [];
        foreach ($rows as $row) {
            $out[(string) $row['k']] = (string) $row['value'];
        }
        return $out;
    }

    /** "key" is a reserved word in MySQL, so it is quoted there. */
    private function keyColumn(): string
    {
        return $this->db->driver() === 'mysql' ? '`key`' : 'key';
    }
}

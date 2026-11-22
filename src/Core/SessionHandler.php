<?php
/**
 * Database-backed PHP sessions.
 *
 * Serverless platforms give each invocation a fresh /tmp, so file sessions
 * would log the admin out at random. Sessions live in the `sessions` table
 * instead, which makes them work across instances and survive restarts.
 */

declare(strict_types=1);

namespace App\Core;

final class SessionHandler implements \SessionHandlerInterface, \SessionUpdateTimestampHandlerInterface
{
    private int $ttl;

    public function __construct(private readonly Database $db, int $ttlSeconds = 43200)
    {
        $this->ttl = max(300, $ttlSeconds);
    }

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        try {
            $payload = $this->db->scalar(
                'SELECT payload FROM sessions WHERE id = :id AND last_activity >= :cutoff',
                ['id' => $id, 'cutoff' => time() - $this->ttl]
            );
        } catch (\Throwable) {
            return '';
        }

        return $payload === null ? '' : (string) $payload;
    }

    public function write(string $id, string $data): bool
    {
        try {
            $this->db->run($this->upsertSql(), ['id' => $id, 'payload' => $data, 'at' => time()]);
        } catch (\Throwable $e) {
            error_log('Session write failed: ' . $e->getMessage());
            return false;
        }

        return true;
    }

    public function destroy(string $id): bool
    {
        try {
            $this->db->run('DELETE FROM sessions WHERE id = :id', ['id' => $id]);
        } catch (\Throwable) {
            return false;
        }

        return true;
    }

    public function gc(int $max_lifetime): int|false
    {
        try {
            return $this->db->run(
                'DELETE FROM sessions WHERE last_activity < :cutoff',
                ['cutoff' => time() - max($max_lifetime, $this->ttl)]
            )->rowCount();
        } catch (\Throwable) {
            return false;
        }
    }

    public function validateId(string $id): bool
    {
        try {
            return $this->db->scalar(
                'SELECT 1 FROM sessions WHERE id = :id AND last_activity >= :cutoff',
                ['id' => $id, 'cutoff' => time() - $this->ttl]
            ) !== null;
        } catch (\Throwable) {
            return false;
        }
    }

    public function updateTimestamp(string $id, string $data): bool
    {
        try {
            $this->db->run(
                'UPDATE sessions SET last_activity = :at WHERE id = :id',
                ['id' => $id, 'at' => time()]
            );
        } catch (\Throwable) {
            return false;
        }

        return true;
    }

    /** Dialect-specific "insert or refresh this session row" statement. */
    private function upsertSql(): string
    {
        $columns = '(id, payload, last_activity) VALUES (:id, :payload, :at)';

        return match ($this->db->driver()) {
            'pgsql' => 'INSERT INTO sessions ' . $columns
                . ' ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload,'
                . ' last_activity = EXCLUDED.last_activity',
            'mysql' => 'INSERT INTO sessions ' . $columns
                . ' ON DUPLICATE KEY UPDATE payload = VALUES(payload),'
                . ' last_activity = VALUES(last_activity)',
            default => 'INSERT INTO sessions ' . $columns
                . ' ON CONFLICT (id) DO UPDATE SET payload = excluded.payload,'
                . ' last_activity = excluded.last_activity',
        };
    }
}

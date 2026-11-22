<?php
/**
 * PDO wrapper with a very small query-builder style API.
 * Works with SQLite (default), MySQL/MariaDB and PostgreSQL (Supabase).
 *
 * The few dialect differences the app needs are normalised here so that
 * repositories and controllers always speak plain SQL.
 */

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?Database $instance = null;

    private PDO $pdo;

    /** @var array<string, mixed> */
    private array $config;

    private function __construct()
    {
        $connection = (string) Config::get('database.default', 'sqlite');
        /** @var array<string,mixed> $conf */
        $conf = Config::get('database.connections.' . $connection, []);
        if ($conf === []) {
            throw new RuntimeException('Unknown database connection: ' . $connection);
        }
        $this->config = $conf;

        try {
            $driver = (string) ($conf['driver'] ?? 'sqlite');
            if ($driver === 'sqlite') {
                $path = (string) $conf['database'];
                $dir = dirname($path);
                if (!is_dir($dir)) {
                    mkdir($dir, 0775, true);
                }
                $this->pdo = new PDO('sqlite:' . $path, null, null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
                $this->pdo->exec('PRAGMA journal_mode = WAL');
                $this->pdo->exec('PRAGMA foreign_keys = ON');
                $this->pdo->exec('PRAGMA busy_timeout = 5000');
            } elseif ($driver === 'pgsql') {
                $dsn = sprintf(
                    'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
                    $conf['host'],
                    (int) $conf['port'],
                    $conf['database'],
                    $conf['sslmode'] ?? 'require'
                );
                $this->pdo = new PDO($dsn, (string) $conf['username'], (string) $conf['password'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    // Serverless: connect lazily, fail fast instead of hanging.
                    PDO::ATTR_TIMEOUT => 10,
                ]);
                $this->pdo->exec("SET application_name = 'movielinkbd'");
            } else {
                $dsn = sprintf(
                    'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                    $conf['host'],
                    (int) $conf['port'],
                    $conf['database'],
                    $conf['charset'] ?? 'utf8mb4'
                );
                $this->pdo = new PDO($dsn, (string) $conf['username'], (string) $conf['password'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            }
        } catch (PDOException $e) {
            error_log('DB connection failed: ' . $e->getMessage());
            throw new RuntimeException(
                'Database connection failed. Check the DB_* environment variables, or run '
                . '`php bin/console.php migrate --seed` for a local install.',
                0,
                $e
            );
        }
    }

    public static function instance(): self
    {
        return self::$instance ??= new self();
    }

    public function driver(): string
    {
        return (string) ($this->config['driver'] ?? 'sqlite');
    }

    public function isPostgres(): bool
    {
        return $this->driver() === 'pgsql';
    }

    /**
     * Full "insert, skip duplicates" statement for the current dialect.
     *
     * @param string $columns        column list, e.g. "(title_id, genre_id)"
     * @param string $values         value list,  e.g. "VALUES (:t, :g)"
     * @param string $conflictTarget the unique key to probe, e.g. "(title_id, genre_id)"
     */
    public function insertIgnore(string $table, string $columns, string $values, string $conflictTarget = ''): string
    {
        $prefix = match ($this->driver()) {
            'mysql' => 'INSERT IGNORE INTO ',
            'pgsql' => 'INSERT INTO ',
            default => 'INSERT OR IGNORE INTO ',
        };

        $sql = $prefix . $table . ' ' . $columns . ' ' . $values;

        if ($this->driver() === 'pgsql') {
            $sql .= ' ON CONFLICT ' . ($conflictTarget === '' ? '' : $conflictTarget . ' ') . 'DO NOTHING';
        }

        return $sql;
    }

    /**
     * A quoted identifier for the current driver ("key" is reserved on
     * MySQL and Postgres alike, but they quote it differently).
     */
    public function quoteIdent(string $identifier): string
    {
        return match ($this->driver()) {
            'pgsql' => '"' . str_replace('"', '""', $identifier) . '"',
            'mysql' => '`' . str_replace('`', '``', $identifier) . '`',
            default => '"' . str_replace('"', '""', $identifier) . '"',
        };
    }

    /**
     * "Rows created in the last N days", in the driver's own dialect.
     * Timestamps are stored as sortable TEXT by every backend.
     */
    public function sinceDaysAgo(int $days): string
    {
        $days = max(0, $days);
        return match ($this->driver()) {
            'pgsql' => "(now() - INTERVAL '" . $days . " day')::text",
            'mysql' => 'DATE_SUB(NOW(), INTERVAL ' . $days . ' DAY)',
            default => "datetime('now','-" . $days . " day')",
        };
    }

    public function pdo(): PDO
    {
        return $this->pdo;
    }

    /** @param array<string|int,mixed> $bindings */
    public function run(string $sql, array $bindings = []): \PDOStatement
    {
        try {
            $statement = $this->pdo->prepare($sql);
            $statement->execute($bindings);
            return $statement;
        } catch (PDOException $e) {
            error_log('SQL error: ' . $e->getMessage() . ' | ' . $sql);
            throw $e;
        }
    }

    /**
     * @param array<string|int,mixed> $bindings
     * @return array<int,array<string,mixed>>
     */
    public function all(string $sql, array $bindings = []): array
    {
        /** @var array<int,array<string,mixed>> $rows */
        $rows = $this->run($sql, $bindings)->fetchAll();
        return $rows;
    }

    /**
     * @param array<string|int,mixed> $bindings
     * @return array<string,mixed>|null
     */
    public function one(string $sql, array $bindings = []): ?array
    {
        $row = $this->run($sql, $bindings)->fetch();
        return $row === false ? null : $row;
    }

    /** @param array<string|int,mixed> $bindings */
    public function scalar(string $sql, array $bindings = []): mixed
    {
        $value = $this->run($sql, $bindings)->fetchColumn();
        return $value === false ? null : $value;
    }

    /** @param array<string,mixed> $data */
    public function insert(string $table, array $data): int
    {
        $columns = array_keys($data);
        $placeholders = array_map(static fn (string $c): string => ':' . $c, $columns);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $columns),
            implode(', ', $placeholders)
        );
        $this->run($sql, $this->bindings($data));
        $last = $this->pdo->lastInsertId();
        if ($last !== false && (string) $last !== '' && (int) $last > 0) {
            return (int) $last;
        }
        // Postgres only exposes the serial value via RETURNING, so a table
        // without a sequence-backed primary key falls back to 0 here.
        return 0;
    }

    /**
     * @param array<string,mixed> $data
     * @param array<string|int,mixed> $where
     */
    public function update(string $table, array $data, array $where): int
    {
        $sets = [];
        foreach (array_keys($data) as $column) {
            $sets[] = $column . ' = :s_' . $column;
        }
        $wheres = [];
        $bindings = [];
        foreach ($data as $column => $value) {
            $bindings['s_' . $column] = $value;
        }
        foreach ($where as $column => $value) {
            $wheres[] = $column . ' = :w_' . $column;
            $bindings['w_' . $column] = $value;
        }
        $sql = sprintf(
            'UPDATE %s SET %s WHERE %s',
            $table,
            implode(', ', $sets),
            implode(' AND ', $wheres)
        );
        return $this->run($sql, $bindings)->rowCount();
    }

    public function begin(): void
    {
        $this->pdo->beginTransaction();
    }

    public function commit(): void
    {
        $this->pdo->commit();
    }

    public function rollback(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    private function bindings(array $data): array
    {
        $bindings = [];
        foreach ($data as $key => $value) {
            $bindings[':' . $key] = is_bool($value) ? (int) $value : $value;
        }
        return $bindings;
    }
}

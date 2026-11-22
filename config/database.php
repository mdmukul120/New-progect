<?php
/**
 * Database configuration.
 *
 * sqlite  : zero setup, file lives in /database (default for local dev)
 * mysql   : set DB_* variables in .env
 * pgsql   : PostgreSQL / Supabase (what the Vercel deployment uses)
 *
 * DB_URL wins over the individual parts when it is set, which is how most
 * managed Postgres providers hand out their connection string, e.g.
 *   postgresql://postgres.abcdef:pw@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
 */

declare(strict_types=1);

use App\Core\Env;

$sqlitePath = (string) Env::get('DB_SQLITE_PATH', 'database/movielinkbd.sqlite');
if ($sqlitePath !== '' && $sqlitePath[0] !== '/') {
    $sqlitePath = dirname(__DIR__) . '/' . ltrim($sqlitePath, '/');
}

$pgsql = [
    'host' => Env::get('DB_HOST', '127.0.0.1'),
    'port' => Env::int('DB_PORT', 5432),
    'database' => Env::get('DB_NAME', 'postgres'),
    'username' => Env::get('DB_USER', 'postgres'),
    'password' => Env::get('DB_PASS', ''),
    'sslmode' => Env::get('DB_SSLMODE', 'require'),
];

$url = trim((string) Env::get('DB_URL', ''));
if ($url !== '') {
    $parts = parse_url($url);
    if (is_array($parts)) {
        $pgsql['host'] = $parts['host'] ?? $pgsql['host'];
        $pgsql['port'] = isset($parts['port']) ? (int) $parts['port'] : $pgsql['port'];
        $pgsql['username'] = isset($parts['user']) ? rawurldecode($parts['user']) : $pgsql['username'];
        $pgsql['password'] = isset($parts['pass']) ? rawurldecode($parts['pass']) : $pgsql['password'];
        $pgsql['database'] = isset($parts['path']) ? ltrim(rawurldecode($parts['path']), '/') : $pgsql['database'];
        parse_str((string) ($parts['query'] ?? ''), $query);
        if (isset($query['sslmode'])) {
            $pgsql['sslmode'] = (string) $query['sslmode'];
        }
    }
}

return [
    'default' => Env::get('DB_DRIVER', 'sqlite'),

    'connections' => [
        'sqlite' => [
            'driver' => 'sqlite',
            'database' => $sqlitePath,
        ],
        'mysql' => [
            'driver' => 'mysql',
            'host' => Env::get('DB_HOST', '127.0.0.1'),
            'port' => Env::int('DB_PORT', 3306),
            'database' => Env::get('DB_NAME', 'movielinkbd'),
            'username' => Env::get('DB_USER', 'root'),
            'password' => Env::get('DB_PASS', ''),
            'charset' => Env::get('DB_CHARSET', 'utf8mb4'),
        ],
        'pgsql' => ['driver' => 'pgsql'] + $pgsql,
    ],
];

<?php
/**
 * Database configuration.
 *
 * sqlite  : zero setup, file lives in /database
 * mysql   : set DB_* variables in .env
 */

declare(strict_types=1);

use App\Core\Env;

$sqlitePath = (string) Env::get('DB_SQLITE_PATH', 'database/movielinkbd.sqlite');
if ($sqlitePath !== '' && $sqlitePath[0] !== '/') {
    $sqlitePath = dirname(__DIR__) . '/' . ltrim($sqlitePath, '/');
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
    ],
];

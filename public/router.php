<?php
/**
 * Router for PHP's built-in server (`php -S 0.0.0.0:8080 -t public public/router.php`).
 * Serves existing files directly, everything else through index.php.
 */

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$file = __DIR__ . $path;

if ($path !== '/' && is_file($file)) {
    return false; // let the built-in server stream the static file
}

require __DIR__ . '/index.php';

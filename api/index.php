<?php
/**
 * Vercel entrypoint.
 *
 * The `vercel-php` runtime boots PHP's built-in server with this file as the
 * router: any asset that exists under /public is streamed straight from the
 * bundle (the `routes` in vercel.json already serve CSS/JS/images before they
 * reach PHP), and everything else is handed to the framework front controller.
 *
 * Locally the same job is done by public/router.php.
 */

declare(strict_types=1);

$publicDir = dirname(__DIR__) . '/public';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$candidate = realpath($publicDir . '/' . ltrim(rawurldecode($path), '/'));

// Only stream files that really live inside /public (no ../ traversal).
if ($candidate !== false
    && str_starts_with($candidate, $publicDir . DIRECTORY_SEPARATOR)
    && is_file($candidate)
) {
    return false;
}

require $publicDir . '/index.php';

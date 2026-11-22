<?php
/**
 * Vercel entrypoint.
 *
 * On Vercel, static files under /public/assets/* are served directly from the
 * edge CDN (see `routes` in vercel.json), while `/` and all application routes
 * dispatch here. When invoked via `php -S localhost:8000 api/index.php`, non-PHP
 * files inside /public are streamed safely before falling through to the front
 * controller.
 */

declare(strict_types=1);

$publicDir = dirname(__DIR__) . '/public';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$candidate = realpath($publicDir . '/' . ltrim(rawurldecode($path), '/'));

if ($candidate !== false
    && str_starts_with($candidate, $publicDir . DIRECTORY_SEPARATOR)
    && is_file($candidate)
) {
    $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
    if ($ext !== 'php') {
        $mimes = [
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'ico' => 'image/x-icon',
            'woff2' => 'font/woff2',
            'json' => 'application/json; charset=utf-8',
        ];
        header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($candidate);
        return true;
    }
}

require $publicDir . '/index.php';

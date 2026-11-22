<?php
/**
 * Modern PHP 8.2+ helpers.  Kept tiny and side-effect free.
 */

declare(strict_types=1);

use App\Core\Config;

if (!function_exists('e')) {
    /** HTML-escape (always used for user/DB output). */
    function e(mixed $value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (!function_exists('app_guess_url')) {
    /** Best-effort absolute base URL when APP_URL is not configured. */
    function app_guess_url(): string
    {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        if ($host === '') {
            return 'http://localhost:8080';
        }
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
        return ($https ? 'https://' : 'http://') . $host;
    }
}

if (!function_exists('url')) {
    /** Absolute path on this host, e.g. url('/movie/abc') => /movie/abc */
    function url(string $path = '/'): string
    {
        $base = (string) Config::get('app.url', '');
        $basePath = $base !== '' ? (string) parse_url($base, PHP_URL_PATH) : '';
        $path = '/' . ltrim($path, '/');
        $prefix = rtrim($basePath, '/');
        return ($prefix === '' ? '' : $prefix) . $path;
    }
}

if (!function_exists('asset')) {
    /** Static asset with a cache-busting version based on file mtime. */
    function asset(string $path): string
    {
        $relative = ltrim($path, '/');
        $file = MLBD_ROOT . '/public/' . $relative;
        $version = is_file($file) ? (string) filemtime($file) : '1';
        return url('/' . $relative) . '?v=' . $version;
    }
}

if (!function_exists('format_views')) {
    /** 1284000 => "1.28M" */
    function format_views(int|float|string|null $views): string
    {
        $n = (int) $views;
        if ($n >= 1_000_000_000) {
            return rtrim(rtrim(number_format($n / 1_000_000_000, 2, '.', ''), '0'), '.') . 'B';
        }
        if ($n >= 1_000_000) {
            return rtrim(rtrim(number_format($n / 1_000_000, 2, '.', ''), '0'), '.') . 'M';
        }
        if ($n >= 1_000) {
            return rtrim(rtrim(number_format($n / 1_000, 2, '.', ''), '0'), '.') . 'K';
        }
        return (string) $n;
    }
}

if (!function_exists('time_ago')) {
    /** "8 hours ago" from a datetime string. */
    function time_ago(?string $datetime): string
    {
        if (!$datetime) {
            return '';
        }
        try {
            $then = new DateTimeImmutable($datetime);
        } catch (Throwable) {
            return '';
        }
        $diff = time() - $then->getTimestamp();
        if ($diff < 0) {
            return 'just now';
        }
        $units = [
            31536000 => 'year',
            2592000 => 'month',
            604800 => 'week',
            86400 => 'day',
            3600 => 'hour',
            60 => 'minute',
        ];
        foreach ($units as $seconds => $label) {
            if ($diff >= $seconds) {
                $count = (int) floor($diff / $seconds);
                return $count . ' ' . $label . ($count > 1 ? 's' : '') . ' ago';
            }
        }
        return 'just now';
    }
}

if (!function_exists('slugify')) {
    function slugify(string $text): string
    {
        $text = trim($text);
        $text = preg_replace('~[^\pL\d]+~u', '-', $text) ?? '';
        $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
        $text = preg_replace('~[^-\w]+~', '', $text) ?? '';
        $text = trim($text, '-');
        $text = preg_replace('~-+~', '-', $text) ?? '';
        return strtolower($text) !== '' ? strtolower($text) : 'n-a';
    }
}

if (!function_exists('json_response')) {
    /** @param array<string,mixed>|array<int,mixed> $data */
    function json_response(array $data, int $status = 200): void
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    }
}

if (!function_exists('dd')) {
    function dd(mixed ...$values): never
    {
        echo '<pre style="background:#0b1322;color:#e6eaf2;padding:16px;border-radius:8px">';
        foreach ($values as $value) {
            echo htmlspecialchars(print_r($value, true), ENT_QUOTES), "\n";
        }
        echo '</pre>';
        exit(1);
    }
}

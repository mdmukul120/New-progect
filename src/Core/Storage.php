<?php
/**
 * Writable storage paths.
 *
 * A classic PHP host gives the app its own directory to write into. Serverless
 * platforms (Vercel, Lambda, Cloud Run) mount the bundle read-only and only
 * /tmp is writable, so every path funnels through here:
 *
 *   STORAGE_PATH unset   -> <project>/storage/{logs,cache,sessions}
 *   STORAGE_PATH=/tmp    -> /tmp/mlbd-storage/{logs,cache,sessions}
 *
 * Anything that must survive a restart belongs in the database, not on disk.
 */

declare(strict_types=1);

namespace App\Core;

final class Storage
{
    /** @var array<string,string> */
    private static array $paths = [];

    /** Base directory for everything the app writes at runtime. */
    public static function base(): string
    {
        return self::$paths['base'] ??= self::resolveBase();
    }

    /** A writable directory, created on first use. */
    public static function dir(string $name): string
    {
        if (isset(self::$paths[$name])) {
            return self::$paths[$name];
        }

        $path = self::base() . '/' . trim($name, '/');
        if (!is_dir($path)) {
            @mkdir($path, 0775, true);
        }
        // If the preferred location is not writable (read-only bundle), fall
        // back to the system temp dir once and remember it.
        if (!is_dir($path) || !is_writable($path)) {
            $fallback = rtrim(sys_get_temp_dir(), '/') . '/mlbd-storage/' . trim($name, '/');
            if (!is_dir($fallback)) {
                @mkdir($fallback, 0775, true);
            }
            $path = $fallback;
        }

        return self::$paths[$name] = $path;
    }

    public static function logs(): string
    {
        return self::dir('logs');
    }

    public static function cache(): string
    {
        return self::dir('cache');
    }

    public static function sessions(): string
    {
        return self::dir('sessions');
    }

    public static function isServerless(): bool
    {
        return getenv('VERCEL') !== false
            || getenv('AWS_LAMBDA_FUNCTION_NAME') !== false
            || getenv('LAMBDA_TASK_ROOT') !== false;
    }

    private static function resolveBase(): string
    {
        $configured = trim((string) Env::get('STORAGE_PATH', ''));
        if ($configured !== '') {
            if ($configured[0] !== '/') {
                $configured = MLBD_ROOT . '/' . ltrim($configured, '/');
            }
            return rtrim($configured, '/');
        }

        if (self::isServerless()) {
            return rtrim(sys_get_temp_dir(), '/') . '/mlbd-storage';
        }

        return MLBD_ROOT . '/storage';
    }
}

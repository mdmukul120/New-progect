<?php
/**
 * Small file-based rate limiter (no Redis required).
 */

declare(strict_types=1);

namespace App\Core;

final class RateLimiter
{
    /** @return array{allowed:bool,remaining:int,reset:int} */
    public static function check(string $key, int $limit, int $window = 60): array
    {
        $dir = MLBD_ROOT . '/storage/cache';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $file = $dir . '/rl_' . sha1($key) . '.json';
        $now = time();
        $bucket = ['start' => $now, 'count' => 0];

        if (is_file($file)) {
            $raw = @file_get_contents($file);
            $data = $raw ? json_decode($raw, true) : null;
            if (is_array($data) && isset($data['start'], $data['count']) && ($now - (int) $data['start']) < $window) {
                $bucket = ['start' => (int) $data['start'], 'count' => (int) $data['count']];
            }
        }

        $bucket['count']++;
        @file_put_contents($file, (string) json_encode($bucket), LOCK_EX);

        $reset = $bucket['start'] + $window;

        return [
            'allowed' => $bucket['count'] <= $limit,
            'remaining' => max(0, $limit - $bucket['count']),
            'reset' => $reset,
        ];
    }

    public static function guard(Request $request): void
    {
        $limit = (int) Config::get('app.security.rate_limit_per_minute', 90);
        if ($limit <= 0 || $request->path() === '/api/health.json') {
            return;
        }

        $result = self::check($request->ip() . '|' . $request->method(), $limit);
        if ($result['allowed'] && !headers_sent()) {
            header('X-RateLimit-Limit: ' . $limit);
            header('X-RateLimit-Remaining: ' . $result['remaining']);
            header('X-RateLimit-Reset: ' . $result['reset']);
            return;
        }
        if (!$result['allowed']) {
            if (!headers_sent()) {
                header('Retry-After: ' . max(1, $result['reset'] - time()));
                header('X-RateLimit-Limit: ' . $limit);
                header('X-RateLimit-Remaining: 0');
            }
            Response::json([
                'ok' => false,
                'error' => [
                    'code' => 'rate_limited',
                    'message' => 'Too many requests. Slow down a little.',
                    'retry_after' => max(1, $result['reset'] - time()),
                ],
            ], 429)->send();
            exit;
        }
    }
}

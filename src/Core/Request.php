<?php
/**
 * Immutable-ish HTTP request wrapper (safe, sanitised input only).
 */

declare(strict_types=1);

namespace App\Core;

final class Request
{
    /** @var array<string,string> */
    private array $query;

    /** @var array<string,mixed> */
    private array $body;

    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly string $ip,
        private readonly string $userAgent
    ) {
        $this->query = $_GET;
        $this->body = $this->parseBody();
    }

    public static function capture(): self
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $path = rawurldecode($path);
        $path = '/' . trim(preg_replace('~/{2,}~', '/', $path) ?? '/', '/');

        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $path,
            (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? ''),
            (string) ($_SERVER['HTTP_USER_AGENT'] ?? '')
        );
    }

    /** @return array<string,mixed> */
    private function parseBody(): array
    {
        $contentType = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
        if (str_contains($contentType, 'application/json')) {
            $raw = file_get_contents('php://input') ?: '';
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : [];
        }
        if ($_POST !== []) {
            return $_POST;
        }
        // Support form-encoded PUT/DELETE payloads.
        if (in_array($this->method, ['PUT', 'PATCH', 'DELETE'], true)) {
            $raw = file_get_contents('php://input') ?: '';
            parse_str($raw, $parsed);
            return $parsed;
        }
        return [];
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function ip(): string
    {
        return trim(explode(',', $this->ip)[0]);
    }

    public function userAgent(): string
    {
        return $this->userAgent;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    /** @return array<string,string> */
    public function queryAll(): array
    {
        return $this->query;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    public function int(string $key, int $default = 0): int
    {
        $value = $this->query[$key] ?? $this->body[$key] ?? null;
        return $value === null || $value === '' ? $default : (int) $value;
    }

    public function string(string $key, string $default = ''): string
    {
        $value = $this->query[$key] ?? $this->body[$key] ?? null;
        return $value === null ? $default : trim((string) (is_array($value) ? '' : $value));
    }

    public function bool(string $key): bool
    {
        $value = $this->query[$key] ?? $this->body[$key] ?? null;
        return in_array((string) $value, ['1', 'true', 'yes', 'on'], true);
    }

    public function isApi(): bool
    {
        return str_starts_with($this->path, '/api/') || $this->path === '/api';
    }

    public function wantsJson(): bool
    {
        return $this->isApi()
            || str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json')
            || $this->query('format', '') === 'json';
    }
}

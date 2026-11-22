<?php
/**
 * HTTP response object with sane security headers (no ad scripts, no
 * third-party click handlers).
 */

declare(strict_types=1);

namespace App\Core;

final class Response
{
    /** @var array<string,string> */
    private array $headers = [];

    public function __construct(
        private readonly string $body = '',
        private readonly int $status = 200
    ) {
    }

    /** @param array<string,mixed>|array<int,mixed> $data */
    public static function json(array $data, int $status = 200): self
    {
        $response = new self(
            (string) json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            $status
        );
        return $response->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    public static function html(string $html, int $status = 200): self
    {
        return (new self($html, $status))->withHeader('Content-Type', 'text/html; charset=utf-8');
    }

    public static function redirect(string $to, int $status = 302): self
    {
        return (new self('', $status))->withHeader('Location', $to);
    }

    public static function text(string $text, int $status = 200): self
    {
        return (new self($text, $status))->withHeader('Content-Type', 'text/plain; charset=utf-8');
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function status(): int
    {
        return $this->status;
    }

    public function body(): string
    {
        return $this->body;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);

            // Baseline hardening — applied to every response.
            header('X-Content-Type-Options: nosniff');
            header('X-Frame-Options: SAMEORIGIN');
            header('Referrer-Policy: strict-origin-when-cross-origin');
            header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()');
            header(
                "Content-Security-Policy: default-src 'self'; "
                . "img-src 'self' data: https:; "
                . "media-src 'self' https: blob:; "
                . "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://netdna.bootstrapcdn.com; "
                . "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://netdna.bootstrapcdn.com; "
                . "script-src 'self' 'unsafe-inline'; "
                . "connect-src 'self'; "
                . "frame-src 'self'; "
                . "object-src 'none'; base-uri 'self'; form-action 'self'"
            );
            foreach ($this->headers as $name => $value) {
                header($name . ': ' . $value);
            }
        }

        echo $this->body;
    }
}

<?php
/**
 * Plain-PHP template renderer with a shared layout and small helpers.
 */

declare(strict_types=1);

namespace App;

use App\Core\Config;
use App\Core\Request;

final class View
{
    /** @var array<string,mixed> */
    private array $globals = [];

    public function __construct(
        private readonly string $basePath,
        private readonly string $siteName
    ) {
    }

    /** @param array<string,mixed> $data */
    public function share(array $data): void
    {
        $this->globals = array_merge($this->globals, $data);
    }

    /** @param array<string,mixed> $data */
    public function render(string $template, array $data = []): string
    {
        $file = $this->basePath . '/' . $template . '.php';
        if (!is_file($file)) {
            throw new \RuntimeException('Template not found: ' . $template);
        }

        $data = array_merge($this->globals, $data);
        $data['view'] = $this;
        $data['site'] = [
            'name' => $this->siteName,
            'tagline' => (string) Config::get('site.tagline'),
            'description' => (string) Config::get('site.description'),
            'logo' => self::absolute((string) Config::get('site.logo')),
            'og_image' => self::absolute((string) Config::get('site.og_image')),
            'placeholder' => (string) Config::get('site.placeholder'),
            'social' => (array) Config::get('site.social', []),
            'copyright' => (string) Config::get('site.copyright'),
            'url' => (string) Config::get('app.url'),
        ];

        extract($data, EXTR_SKIP);

        ob_start();
        require $file;
        $content = (string) ob_get_clean();

        if (!empty($data['admin'])) {
            $data['layout'] = 'admin/layout';
        }
        $layout = array_key_exists('layout', $data) ? $data['layout'] : 'layouts/main';
        if ($layout === null) {
            return $content;
        }

        ob_start();
        require $this->basePath . '/' . $layout . '.php';
        return (string) ob_get_clean();
    }

    /** Render a partial inline (used by templates). */
    public function partial(string $template, array $data = []): string
    {
        return $this->render($template, array_merge($data, ['layout' => null]));
    }

    /** Prefix root-relative asset paths with the configured base URL. */
    public static function absolute(string $path): string
    {
        if ($path === '' || str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, '//')) {
            return $path;
        }
        return rtrim((string) Config::get('app.url', ''), '/') . '/' . ltrim($path, '/');
    }

    public function e(mixed $value): string
    {
        return e($value);
    }
}

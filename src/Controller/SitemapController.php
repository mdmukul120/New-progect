<?php
/**
 * Sitemaps, robots.txt and the web app manifest.
 */

declare(strict_types=1);

namespace App\Controller;

use App\Core\App;
use App\Core\Config;
use App\Core\Request;
use App\Core\Response;

final class SitemapController
{
    public function __construct(private readonly App $app)
    {
    }

    private function base(): string
    {
        return rtrim((string) Config::get('app.url', ''), '/');
    }

    public function index(Request $request): Response
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach (['sitemap-titles.xml', 'sitemap-taxonomy.xml'] as $file) {
            $xml .= '  <sitemap><loc>' . e($this->base() . '/' . $file) . '</loc>'
                . '<lastmod>' . date('c') . '</lastmod></sitemap>' . "\n";
        }
        $xml .= '</sitemapindex>';

        return (new Response($xml))->withHeader('Content-Type', 'application/xml; charset=utf-8');
    }

    public function titles(Request $request): Response
    {
        $rows = $this->app->db()->all(
            'SELECT type, slug, updated_at FROM titles WHERE is_adult = 0 ORDER BY updated_at DESC LIMIT 5000'
        );

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($rows as $row) {
            $loc = $this->base() . '/' . $row['type'] . '/' . rawurlencode((string) $row['slug']);
            $xml .= '  <url><loc>' . e($loc) . '</loc>'
                . '<lastmod>' . e((string) substr((string) $row['updated_at'], 0, 10)) . '</lastmod>'
                . '<changefreq>weekly</changefreq><priority>0.8</priority></url>' . "\n";
        }
        $xml .= '</urlset>';

        return (new Response($xml))->withHeader('Content-Type', 'application/xml; charset=utf-8');
    }

    public function taxonomy(Request $request): Response
    {
        $urls = [
            ['loc' => '/', 'priority' => '1.0'],
            ['loc' => '/type/movies', 'priority' => '0.9'],
            ['loc' => '/type/series', 'priority' => '0.9'],
            ['loc' => '/anime', 'priority' => '0.9'],
            ['loc' => '/drama', 'priority' => '0.9'],
            ['loc' => '/southIndian', 'priority' => '0.8'],
            ['loc' => '/ongoing', 'priority' => '0.8'],
            ['loc' => '/latest', 'priority' => '0.8'],
            ['loc' => '/trending', 'priority' => '0.8'],
            ['loc' => '/upcoming', 'priority' => '0.7'],
            ['loc' => '/collections', 'priority' => '0.7'],
            ['loc' => '/ott', 'priority' => '0.7'],
            ['loc' => '/api', 'priority' => '0.5'],
        ];
        foreach ((array) Config::get('navigation.languages', []) as $entry) {
            $urls[] = ['loc' => '/language/' . $entry['slug'], 'priority' => '0.6'];
        }
        foreach ((array) Config::get('navigation.genres', []) as $entry) {
            $urls[] = ['loc' => '/genre/' . $entry['slug'], 'priority' => '0.6'];
        }
        foreach ($this->app->collections()->all() as $collection) {
            $urls[] = ['loc' => '/collection/' . $collection['slug'], 'priority' => '0.6'];
        }
        foreach ($this->app->ott()->all() as $platform) {
            $urls[] = ['loc' => '/ott/' . $platform['slug'], 'priority' => '0.5'];
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($urls as $url) {
            $xml .= '  <url><loc>' . e($this->base() . $url['loc']) . '</loc>'
                . '<changefreq>daily</changefreq><priority>' . $url['priority'] . '</priority></url>' . "\n";
        }
        $xml .= '</urlset>';

        return (new Response($xml))->withHeader('Content-Type', 'application/xml; charset=utf-8');
    }

    public function robots(Request $request): Response
    {
        $lines = [
            'User-agent: *',
            'Allow: /',
            'Disallow: /admin',
            'Disallow: /search',
            'Disallow: /api/',
            'Disallow: /adult18plus',
            'Disallow: /download/',
            '',
            'Sitemap: ' . $this->base() . '/sitemap.xml',
        ];
        return Response::text(implode("\n", $lines));
    }

    public function manifest(Request $request): Response
    {
        $name = (string) Config::get('site.name');
        return Response::json([
            'name' => $name . ' — Movies & Series',
            'short_name' => $name,
            'description' => (string) Config::get('site.description'),
            'start_url' => '/',
            'scope' => '/',
            'display' => 'standalone',
            'orientation' => 'portrait',
            'background_color' => '#06131f',
            'theme_color' => '#06131f',
            'categories' => ['entertainment', 'video'],
            'icons' => [
                ['src' => (string) Config::get('site.logo'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
                ['src' => (string) Config::get('site.logo'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
            ],
        ])->withHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    }
}

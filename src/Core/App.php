<?php
/**
 * Application container: shared services + repository factory.
 */

declare(strict_types=1);

namespace App\Core;

use App\Repository\CollectionRepository;
use App\Repository\EndpointRepository;
use App\Repository\GenreRepository;
use App\Repository\NoticeRepository;
use App\Repository\OttRepository;
use App\Repository\SettingRepository;
use App\Repository\TitleRepository;
use App\View;

final class App
{
    private static ?App $instance = null;

    /** @var array<string,mixed> */
    private array $services = [];

    private function __construct(private readonly string $publicPath)
    {
    }

    public static function boot(string $publicPath): self
    {
        return self::$instance ??= new self($publicPath);
    }

    public static function get(): self
    {
        if (self::$instance === null) {
            throw new \RuntimeException('App has not been booted.');
        }
        return self::$instance;
    }

    public function publicPath(string $append = ''): string
    {
        return $this->publicPath . ($append === '' ? '' : '/' . ltrim($append, '/'));
    }

    public function rootPath(string $append = ''): string
    {
        return dirname($this->publicPath) . ($append === '' ? '' : '/' . ltrim($append, '/'));
    }

    public function db(): Database
    {
        return Database::instance();
    }

    public function titles(): TitleRepository
    {
        return $this->services['titles'] ??= new TitleRepository($this->db());
    }

    public function genres(): GenreRepository
    {
        return $this->services['genres'] ??= new GenreRepository($this->db());
    }

    public function collections(): CollectionRepository
    {
        return $this->services['collections'] ??= new CollectionRepository($this->db(), $this->titles());
    }

    public function ott(): OttRepository
    {
        return $this->services['ott'] ??= new OttRepository($this->db(), $this->titles());
    }

    public function notices(): NoticeRepository
    {
        return $this->services['notices'] ??= new NoticeRepository($this->db());
    }

    public function settings(): SettingRepository
    {
        return $this->services['settings'] ??= new SettingRepository($this->db());
    }

    public function endpoints(): EndpointRepository
    {
        return $this->services['endpoints'] ??= new EndpointRepository($this->db());
    }

    public function view(): View
    {
        return $this->services['view'] ??= new View($this->rootPath('templates'), (string) Config::get('site.name', 'MovieLinkBD'));
    }

    /** Cache-busting site version (used by CSS/JS query strings). */
    public function version(): string
    {
        return (string) ($this->services['version'] ??= substr(sha1((string) filemtime($this->publicPath('assets/css/app.css'))), 0, 8));
    }
}

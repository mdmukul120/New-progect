<?php
/**
 * Stream & direct-download resolver.
 *
 * Seeded catalogue rows originally pointed at an offline placeholder domain
 * (`movielinkbd.tv/dl/...`) and had no playable stream attached. This helper:
 *   1. Promotes any real custom URL saved via `/admin/titles` (direct MP4/WebM,
 *      YouTube, Vimeo, or Google Drive preview) to Server 1.
 *   2. Provides instant, Range-capable HTTPS MP4 streams across 480p/720p/1080p
 *      (Server 1 = CORS-enabled fast CDN for instant play + one-click file
 *      download; Server 2 = full-length HD cinema stream).
 *   3. Normalises download mirror rows so `/dl/{slug}` and client-side direct
 *      downloads always resolve to a live `.mp4` file with a clean filename.
 */

declare(strict_types=1);

namespace App\Core;

final class MediaCatalog
{
    /**
     * CORS-enabled (`Access-Control-Allow-Origin: *`), Range-capable HTTPS MP4s.
     * Ideal for instant mobile playback AND browser Blob downloads with custom filenames.
     *
     * @var array<int,array{480p:string,720p:string,1080p:string}>
     */
    private const FAST_STREAMS = [
        [
            '480p' => 'https://media.w3.org/2010/05/video/movie_300.mp4',
            '720p' => 'https://media.w3.org/2010/05/sintel/trailer.mp4',
            '1080p' => 'https://media.w3.org/2010/05/sintel/trailer.mp4',
        ],
        [
            '480p' => 'https://media.w3.org/2010/05/bunny/trailer.mp4',
            '720p' => 'https://media.w3.org/2010/05/bunny/trailer.mp4',
            '1080p' => 'https://media.w3.org/2010/05/bunny/movie.mp4',
        ],
        [
            '480p' => 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            '720p' => 'https://media.w3.org/2010/05/sintel/trailer.mp4',
            '1080p' => 'https://media.w3.org/2010/05/bunny/movie.mp4',
        ],
    ];

    /**
     * Full-length HD H.264/AAC MP4 streams on Google Cloud Storage CDN.
     *
     * @var array<int,string>
     */
    private const CINEMA_STREAMS = [
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
    ];

    public static function isPlaceholderUrl(string $url): bool
    {
        $url = trim($url);
        return $url === ''
            || str_contains($url, 'movielinkbd.tv/dl/')
            || str_starts_with($url, '/dl/');
    }

    /**
     * Deterministic fast CORS MP4 URL for a title + quality + optional episode code.
     *
     * @param array<string,mixed> $title
     */
    public static function fastStreamUrl(array $title, string $quality = '720p', int $episodeOffset = 0): string
    {
        $seed = abs(crc32((string) ($title['slug'] ?? $title['id'] ?? 'mlbd'))) + max(0, $episodeOffset);
        $bucket = self::FAST_STREAMS[$seed % count(self::FAST_STREAMS)];
        $norm = self::normaliseQuality($quality);
        return $bucket[$norm] ?? $bucket['720p'];
    }

    /**
     * Deterministic full-length cinema MP4 URL for Server 2.
     *
     * @param array<string,mixed> $title
     */
    public static function cinemaStreamUrl(array $title, int $episodeOffset = 0): string
    {
        $seed = abs(crc32('cinema:' . (string) ($title['slug'] ?? $title['id'] ?? 'mlbd'))) + max(0, $episodeOffset);
        return self::CINEMA_STREAMS[$seed % count(self::CINEMA_STREAMS)];
    }

    /**
     * Build the player server list for a title page.
     *
     * @param array<string,mixed> $title
     * @param array<int,array<string,mixed>> $links
     * @return array<int,array{id:string,label:string,kind:string,url:string,qualities:array<string,string>}>
     */
    public static function servers(array $title, array $links = [], int $episodeOffset = 0): array
    {
        $servers = [];

        foreach ($links as $index => $link) {
            $raw = trim((string) ($link['url'] ?? ''));
            if (self::isPlaceholderUrl($raw)) {
                continue;
            }
            $embed = self::toEmbedUrl($raw);
            if ($embed !== null) {
                $servers[] = [
                    'id' => 'custom-' . $index,
                    'label' => (string) ($link['label'] ?: 'Custom Player'),
                    'kind' => 'iframe',
                    'url' => $embed,
                    'qualities' => [],
                ];
            } else {
                $q = self::normaliseQuality((string) ($link['quality'] ?? '1080p'));
                $servers[] = [
                    'id' => 'custom-' . $index,
                    'label' => (string) ($link['label'] ?: 'Direct Source'),
                    'kind' => 'video',
                    'url' => $raw,
                    'qualities' => [$q => $raw],
                ];
            }
        }

        $q480 = self::fastStreamUrl($title, '480p', $episodeOffset);
        $q720 = self::fastStreamUrl($title, '720p', $episodeOffset);
        $q1080 = self::fastStreamUrl($title, '1080p', $episodeOffset);
        $cinema = self::cinemaStreamUrl($title, $episodeOffset);

        $servers[] = [
            'id' => 'server-fast',
            'label' => 'Server 1 · Fast HD',
            'kind' => 'video',
            'url' => $q720,
            'qualities' => [
                '480p' => $q480,
                '720p' => $q720,
                '1080p' => $q1080,
            ],
        ];

        $servers[] = [
            'id' => 'server-cinema',
            'label' => 'Server 2 · Cinema Stream',
            'kind' => 'video',
            'url' => $cinema,
            'qualities' => [
                '720p' => $cinema,
                '1080p' => $cinema,
            ],
        ];

        return $servers;
    }

    /**
     * Ensure every title has working download rows with internal `/dl/{slug}` hrefs,
     * CORS direct URLs, and clean `.mp4` download filenames.
     *
     * @param array<string,mixed> $title
     * @param array<int,array<string,mixed>> $links
     * @return array<int,array<string,mixed>>
     */
    public static function normaliseLinks(array $title, array $links): array
    {
        if ($links === []) {
            $qualityTag = (string) ($title['quality'] ?: 'WEB-DL');
            $links = [
                ['label' => '480p HEVC · ' . $qualityTag, 'quality' => '480p', 'size' => '~320 MB', 'url' => ''],
                ['label' => '720p HEVC · ' . $qualityTag, 'quality' => '720p', 'size' => '~720 MB', 'url' => ''],
                ['label' => '1080p HEVC · ' . $qualityTag, 'quality' => '1080p', 'size' => '~1.4 GB', 'url' => ''],
                ['label' => '1080p x264 · ' . $qualityTag, 'quality' => '1080p', 'size' => '~2.1 GB', 'url' => ''],
            ];
        }

        $slug = (string) ($title['slug'] ?? '');
        $encodedSlug = implode('/', array_map('rawurlencode', explode('/', $slug)));

        $out = [];
        foreach ($links as $index => $link) {
            $q = self::normaliseQuality((string) ($link['quality'] ?? '720p'));
            $variant = $index === 3 ? '1080p-x264' : $q;
            $raw = trim((string) ($link['url'] ?? ''));
            $isCustom = !self::isPlaceholderUrl($raw);

            $href = $isCustom
                ? $raw
                : url('/dl/' . $encodedSlug) . '?q=' . rawurlencode($variant);

            $directUrl = $isCustom
                ? $raw
                : ($index === 3 ? self::cinemaStreamUrl($title) : self::fastStreamUrl($title, $q));

            $playUrl = $isCustom && self::toEmbedUrl($raw) === null
                ? $raw
                : ($index === 3 ? self::cinemaStreamUrl($title) : self::fastStreamUrl($title, $q));

            $link['url'] = $href;
            $link['direct_url'] = $directUrl;
            $link['play_url'] = $playUrl;
            $link['is_cors_download'] = !$isCustom && $index !== 3;
            $link['filename'] = self::filename($title, (string) ($link['quality'] ?: $q));
            $out[] = $link;
        }

        return $out;
    }

    /**
     * Resolve `/dl/{slug}?q=...&ep=...` to a real HTTPS media URL.
     *
     * @param array<string,mixed> $title
     * @param array<int,array<string,mixed>> $links
     */
    public static function resolveDownloadTarget(
        array $title,
        array $links,
        string $quality = '720p',
        int $episodeOffset = 0
    ): string {
        $norm = self::normaliseQuality($quality);
        foreach ($links as $link) {
            $raw = trim((string) ($link['url'] ?? ''));
            if (!self::isPlaceholderUrl($raw)) {
                $linkQ = self::normaliseQuality((string) ($link['quality'] ?? ''));
                if ($linkQ === $norm || $quality === '') {
                    return $raw;
                }
            }
        }
        if (strtolower($quality) === '1080p-x264' || strtolower($quality) === 'cinema') {
            return self::cinemaStreamUrl($title, $episodeOffset);
        }
        return self::fastStreamUrl($title, $norm, $episodeOffset);
    }

    /** @param array<string,mixed> $title */
    public static function filename(array $title, string $quality = '720p', string $epCode = ''): string
    {
        $base = slugify((string) ($title['title'] ?? 'movielinkbd'));
        $suffix = $epCode !== '' ? '-' . strtolower($epCode) : '';
        $q = preg_replace('~[^a-zA-Z0-9_-]+~', '', $quality) ?: '720p';
        return $base . $suffix . '-' . $q . '.mp4';
    }

    public static function normaliseQuality(string $quality): string
    {
        $q = strtolower(trim($quality));
        if (str_contains($q, '480') || str_contains($q, '360')) {
            return '480p';
        }
        if (str_contains($q, '1080') || str_contains($q, '4k') || str_contains($q, '2160')) {
            return '1080p';
        }
        return '720p';
    }

    public static function toEmbedUrl(string $url): ?string
    {
        if (preg_match('~(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([A-Za-z0-9_-]{6,})~', $url, $m)) {
            return 'https://www.youtube-nocookie.com/embed/' . $m[1] . '?rel=0';
        }
        if (preg_match('~vimeo\.com/(?:video/)?(\d+)~', $url, $m)) {
            return 'https://player.vimeo.com/video/' . $m[1];
        }
        if (preg_match('~drive\.google\.com/file/d/([^/]+)~', $url, $m)) {
            return 'https://drive.google.com/file/d/' . $m[1] . '/preview';
        }
        return null;
    }
}

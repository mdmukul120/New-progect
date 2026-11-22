<?php
/**
 * End-to-end smoke test — no framework, no network beyond this host.
 *
 *   php bin/console.php migrate --fresh --seed
 *   php -S 127.0.0.1:8080 -t public public/router.php &
 *   php bin/smoke-test.php http://127.0.0.1:8080
 *
 * Exits non-zero when any check fails, so it is CI friendly.
 */

declare(strict_types=1);

$base = rtrim($argv[1] ?? 'http://127.0.0.1:8080', '/');
$pass = 0;
$fail = 0;

/** @return array{0:int,1:string,2:array<string,string>} */
function http(string $url, string $method = 'GET', array $headers = [], ?string $body = null): array
{
    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", array_map(
                static fn (string $k, string $v): string => $k . ': ' . $v,
                array_keys($headers),
                $headers
            )),
            'content' => $body ?? '',
            'ignore_errors' => true,
            'follow_location' => 0,
            'timeout' => 30,
        ],
    ]);
    $content = @file_get_contents($url, false, $context);
    // PHP 8.5 deprecates the locally scoped $http_response_header variable.
    $responseHeaders = function_exists('http_get_last_response_headers')
        ? (http_get_last_response_headers() ?? [])
        : (${'http_response_header'} ?? []);
    $rawHeaders = [];
    foreach ($responseHeaders as $line) {
        if (str_contains($line, ':')) {
            [$k, $v] = explode(':', $line, 2);
            $rawHeaders[strtolower(trim($k))] = trim($v);
        }
    }
    $status = 200;
    if (isset($responseHeaders[0]) && preg_match('~\s(\d{3})~', $responseHeaders[0], $m)) {
        $status = (int) $m[1];
    }
    return [$status, (string) $content, $rawHeaders];
}

function check(string $label, bool $ok, string $detail = ''): void
{
    global $pass, $fail;
    if ($ok) {
        $pass++;
        echo "  \033[32m✔\033[0m ", $label, PHP_EOL;
        return;
    }
    $fail++;
    echo "  \033[31m✘\033[0m ", $label, $detail !== '' ? ' — ' . $detail : '', PHP_EOL;
}

echo PHP_EOL, 'MovieLinkBD smoke test → ', $base, PHP_EOL, PHP_EOL;

// ---------------------------------------------------------------- pages
$pages = [
    '/', '/page/2', '/type/movies', '/type/series', '/anime', '/drama', '/southIndian',
    '/language/hindi', '/language/bangla-dubbed', '/genre/action', '/collections',
    '/collection/anime-zone', '/collection/series-and-reality', '/ott', '/ott/netflix',
    '/search?q=bigg', '/upcoming', '/latest', '/ongoing', '/trending', '/live',
    '/info/faq', '/info/dmca', '/info/privacy', '/info/about', '/api',
    '/sitemap.xml', '/sitemap-titles.xml', '/sitemap-taxonomy.xml', '/robots.txt',
    '/manifest.webmanifest',
];

echo 'Pages', PHP_EOL;
foreach ($pages as $path) {
    [$status, $body] = http($base . $path);
    check($path . ' → ' . $status, $status === 200 && $body !== '', 'empty body');
}

echo PHP_EOL, 'API', PHP_EOL;
$endpoints = [
    '/api/index.json', '/api/health.json', '/api/titles.json', '/api/search.json?q=bigg',
    '/api/suggest.json?q=bi', '/api/trending.json', '/api/latest.json', '/api/upcoming.json',
    '/api/home.json', '/api/genres.json', '/api/languages.json', '/api/ott.json',
    '/api/notices.json', '/api/stats.json', '/api/collection/anime-zone.json',
];
foreach ($endpoints as $path) {
    [$status, $body] = http($base . $path);
    $json = json_decode($body, true);
    check(
        $path . ' → ' . $status,
        $status === 200 && is_array($json) && ($json['ok'] ?? false) === true,
        'invalid envelope'
    );
}

// ------------------------------------------------------- content checks
echo PHP_EOL, 'Content', PHP_EOL;
[$status, $home] = http($base . '/');
check('homepage has zero ad markers', !preg_match(
    '~adsbygoogle|adsterra|monetag|popunder|doubleclick|googlesyndication|onclickads|propeller~i',
    $home
));
check('homepage loads no third-party script', !preg_match('~<script[^>]+src="https?://~i', $home));
check('homepage escapes titles', !str_contains($home, '<script>alert'));
check('homepage has one <h1>', substr_count($home, '<h1') === 1, 'found ' . substr_count($home, '<h1'));
check('homepage has canonical + og:image', str_contains($home, 'rel="canonical"') && str_contains($home, 'property="og:image"'));
check('every <img> has alt text', !preg_match('~<img(?![^>]*\balt=)[^>]*>~i', $home));
check('notice board rendered', str_contains($home, 'notice-item'));
check('top-10 rail rendered', str_contains($home, 'rank-item'));

[$status, $listing] = http($base . '/type/movies');
check('listing renders cards', substr_count($listing, '<article class="card"') >= 12);
check('listing paginates', str_contains($listing, 'class="pagination"') || str_contains($listing, 'Next →'));

// ------------------------------------------------------------- security
echo PHP_EOL, 'Security', PHP_EOL;
[$status, $body] = http($base . '/admin');
check('/admin redirects to login', $status === 302);
[$status, , $headers] = http($base . '/');
check('CSP header present', isset($headers['content-security-policy']));
check('nosniff header present', ($headers['x-content-type-options'] ?? '') === 'nosniff');
[$status, $body] = http($base . '/nope');
check('unknown path returns 404', $status === 404);
[$status, $body] = http($base . '/api/titles/does-not-exist.json');
check('unknown API slug returns 404 JSON', $status === 404 && str_contains($body, 'not_found'));

[$status, $body] = http($base . '/api/search.json');
check('missing required param rejected', $status === 422);

echo PHP_EOL, $fail === 0
    ? "\033[32mAll {$pass} checks passed.\033[0m" . PHP_EOL
    : "\033[31m{$fail} of " . ($pass + $fail) . " checks failed.\033[0m" . PHP_EOL;

exit($fail === 0 ? 0 : 1);

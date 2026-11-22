<?php
/**
 * Application configuration.
 */

declare(strict_types=1);

use App\Core\Env;

$root = Env::get('BASE_PATH') ?: dirname(__DIR__);

$adsEnabled = Env::bool('ADS_ENABLED', false);

return [
    'env' => Env::get('APP_ENV', 'production'),
    'debug' => Env::bool('APP_DEBUG', false),
    // APP_URL wins; otherwise derive from the current request so previews and
    // fresh installs always emit correct canonical / sitemap URLs.
    'url' => rtrim((string) (Env::get('APP_URL') ?: app_guess_url()), '/'),
    'timezone' => Env::get('APP_TIMEZONE', 'Asia/Dhaka'),
    'root' => $root,

    // Ad slots are wired through this single switch. The design goal of
    // this codebase is an ad-free site, so it defaults to OFF and the
    // templates never receive third-party ad markup when it is off.
    'ads' => [
        'enabled' => $adsEnabled,
        'providers' => [],
    ],

    'security' => [
        'rate_limit_per_minute' => Env::int('RATE_LIMIT_PER_MINUTE', 90),
        'session_hours' => Env::int('ADMIN_SESSION_HOURS', 12),
    ],
];

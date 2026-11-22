<?php
/**
 * Site / navigation configuration.
 */

declare(strict_types=1);

use App\Core\Env;

$facebook = (string) Env::get('SOCIAL_FACEBOOK', 'https://www.facebook.com/groups/1423779586288739');
$telegram = (string) Env::get('SOCIAL_TELEGRAM', 'https://t.me/movielinkbdofficial');

return [
    'name' => Env::get('SITE_NAME', 'MovieLinkBD'),
    'tagline' => Env::get('SITE_TAGLINE', 'বাংলা • হিন্দি • সাউথ • K/J/C ড্রামা • অ্যানিমে'),
    'description' => Env::get(
        'SITE_DESCRIPTION',
        'MovieLinkBD — HD movies, web series, anime and K/J/C drama. Fast, clean and completely ad-free.'
    ),
    'locale' => 'en',
    'logo' => 'https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/img/kmovielinkbd.png',
    // Local, 1200x630 social cover (see public/assets/img/og-cover.jpg)
    'og_image' => '/assets/img/og-cover.jpg',
    'placeholder' => 'https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/img/poster-not-found.png',
    'loader' => 'https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/images/mlbd_load.svg',
    'social' => [
        'facebook' => $facebook,
        'telegram' => $telegram,
    ],
    'copyright' => '© 2026 MovieLinkBD.com — All Rights Reserved.',
];

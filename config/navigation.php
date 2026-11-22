<?php
/**
 * Primary navigation + homepage rails.
 *
 * The rail definitions drive both the homepage sections and the API
 * "category" feed, so a new home rail only needs an entry here.
 */

declare(strict_types=1);

return [
    // Header mega-menu / quick links --------------------------------
    'languages' => [
        ['slug' => 'bangla', 'label' => '🇧🇩 Bangla'],
        ['slug' => 'bangla-dubbed', 'label' => '🎙 Bangla Dub'],
        ['slug' => 'hindi', 'label' => '🇮🇳 Hindi'],
        ['slug' => 'hindi-dubbed', 'label' => '🎤 Hindi Dub'],
        ['slug' => 'dual-audio', 'label' => '🎧 Dual Audio'],
        ['slug' => 'tamil', 'label' => 'Tamil'],
        ['slug' => 'telugu', 'label' => 'Telugu'],
        ['slug' => 'korean', 'label' => '🇰🇷 Korean'],
        ['slug' => 'japanese', 'label' => '🇯🇵 Japanese'],
        ['slug' => 'english', 'label' => '🇺🇸 English'],
        ['slug' => 'indonesian', 'label' => '🇮🇩 Indonesian'],
        ['slug' => 'malayalam', 'label' => 'Malayalam'],
        ['slug' => 'kannada', 'label' => 'Kannada'],
        ['slug' => 'punjabi', 'label' => 'Punjabi'],
        ['slug' => 'marathi', 'label' => 'Marathi'],
        ['slug' => 'gujrati', 'label' => 'Gujarati'],
        ['slug' => 'spanish', 'label' => 'Spanish'],
        ['slug' => 'french', 'label' => 'French'],
        ['slug' => 'german', 'label' => 'German'],
        ['slug' => 'italian', 'label' => 'Italian'],
        ['slug' => 'portuguese', 'label' => 'Portuguese'],
        ['slug' => 'turkish', 'label' => 'Turkish'],
        ['slug' => 'chinese', 'label' => 'Chinese'],
        ['slug' => 'vietnamese', 'label' => 'Vietnamese'],
        ['slug' => 'malaysian', 'label' => 'Malaysian'],
        ['slug' => 'others', 'label' => 'Others'],
    ],

    'genres' => [
        ['slug' => 'action', 'label' => '⚔️ Action'],
        ['slug' => 'thriller', 'label' => '🧩 Thriller'],
        ['slug' => 'horror', 'label' => '👻 Horror'],
        ['slug' => 'romance', 'label' => '💕 Romance'],
        ['slug' => 'comedy', 'label' => '😂 Comedy'],
        ['slug' => 'drama', 'label' => '🎭 Drama'],
        ['slug' => 'crime', 'label' => '🕵️ Crime'],
        ['slug' => 'mystery', 'label' => '🔍 Mystery'],
        ['slug' => 'suspense', 'label' => '😰 Suspense'],
        ['slug' => 'sci-fi', 'label' => '🚀 Sci-Fi'],
        ['slug' => 'fantasy', 'label' => '🧙 Fantasy'],
        ['slug' => 'adventure', 'label' => '🗺️ Adventure'],
        ['slug' => 'animation', 'label' => '🎨 Animation'],
        ['slug' => 'family', 'label' => '👨‍👩‍👧 Family'],
        ['slug' => 'sports', 'label' => '🏆 Sports'],
        ['slug' => 'war', 'label' => '🪖 War'],
        ['slug' => 'superhero', 'label' => '🦸 Superhero'],
        ['slug' => 'historical', 'label' => '🏛️ Historical'],
        ['slug' => 'biographical', 'label' => '📖 Biographical'],
        ['slug' => 'documentary', 'label' => '🎥 Documentary'],
        ['slug' => 'music', 'label' => '🎵 Music'],
        ['slug' => 'musical', 'label' => '🎤 Musical'],
        ['slug' => 'survival', 'label' => '🏕️ Survival'],
    ],

    'quick_links' => [
        ['href' => '/live', 'label' => 'LiveNow', 'badge' => 'LIVE'],
        ['href' => '/anime', 'label' => '🍥 Anime Zone', 'badge' => 'FRESH'],
        ['href' => '/adult18plus', 'label' => '🔞 18+ Adult', 'badge' => 'HOT'],
        ['href' => '/ongoing', 'label' => '⏳ Ongoing', 'badge' => 'NEW'],
        ['href' => '/drama', 'label' => '🇰🇷 K/J/C Drama', 'badge' => 'ALL'],
        ['href' => '/southIndian', 'label' => '🔥 South Indian', 'badge' => 'BEST'],
        ['href' => '/category/wwe', 'label' => '🤼 WWE', 'badge' => ''],
        ['href' => '/type/movies', 'label' => '🎬 Movies', 'badge' => ''],
        ['href' => '/type/series', 'label' => '📺 Web Series', 'badge' => ''],
    ],

    // Homepage rails -------------------------------------------------
    // key => [title, query params for TitleRepository::search()]
    'rails' => [
        'movies' => ['title' => '🎬 Movies', 'params' => ['type' => 'movie', 'per_page' => 18]],
        'series' => ['title' => '📺 Series & TV Shows', 'params' => ['type' => 'series', 'per_page' => 18]],
        'drama' => ['title' => '🇰🇷 K/J/C Drama', 'params' => ['type' => 'drama', 'per_page' => 18]],
        'south' => ['title' => '🔥 South Indian', 'params' => ['language' => 'tamil,telugu,malayalam,kannada', 'per_page' => 18]],
        'ongoing' => ['title' => '⏳ Ongoing Series', 'params' => ['status' => 'ongoing', 'per_page' => 18]],
        'anime' => ['title' => '🍥 Anime Zone', 'params' => ['type' => 'anime', 'per_page' => 18]],
        'animation' => ['title' => '🎨 Animation', 'params' => ['genre' => 'animation', 'per_page' => 18]],
        'adult' => ['title' => '🔞 18+ Adult', 'params' => ['adult' => 1, 'per_page' => 18]],
    ],
];

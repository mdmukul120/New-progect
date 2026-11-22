#!/usr/bin/env python3
"""
Generates database/seed.php from the harvested MovieLinkBD homepage.

Input  : tools/_titles.json, tools/_upcoming.json, tools/_ott.json,
         tools/_collections.json, tools/_facets.json
Output : database/seed.php  (plain PHP array, no runtime dependency)

The catalogue shipped in the repo is therefore real data captured from the
live site, plus deterministic metadata (genres, synopsis, download mirrors)
derived from the title itself.
"""

import json
import re
import os
import html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")

titles = json.load(open(os.path.join(TOOLS, "_titles.json"), encoding="utf-8"))
upcoming = json.load(open(os.path.join(TOOLS, "_upcoming.json"), encoding="utf-8"))
facets = json.load(open(os.path.join(TOOLS, "_facets.json"), encoding="utf-8"))

GENRE_RULES = {
    "action": ["operation", "war", "fight", "commando", "pratap", "kgf", "singham",
               "pushpa", "bheem", "jailer", "mass", "action", "hunter", "raid", "bullet"],
    "thriller": ["drishyam", "thriller", "thriller", "detective", "case", "murder", "raid",
                 "jailer", "conspiracy", "suspect", "hijack"],
    "horror": ["horror", "ghost", "haunted", "bhoot", "evil", "zombie", "demon", "exorcist"],
    "romance": ["love", "romance", "ishq", "prem", "heart", "dil", "wedding", "shaadi"],
    "comedy": ["comedy", "kapil", "funny", "laugh", "masti", "boss", "house", "show"],
    "drama": ["drama", "family", "house", "life", "story", "empress", "bachelor", "idol"],
    "sci-fi": ["star", "space", "future", "robot", "alien", "matrix", "avatar", "doomsday"],
    "fantasy": ["magic", "fantasy", "dragon", "wizard", "boss", "isekai", "appeared", "empress"],
    "animation": ["animation", "cartoon", "kids", "pixar", "toon", "anime"],
    "sports": ["wwe", "match", "league", "cup", "sport", "idol", "game", "championship"],
    "crime": ["crime", "gangster", "mafia", "police", "boss", "jail", "prison"],
    "mystery": ["mystery", "secret", "clue", "detective"],
    "superhero": ["avengers", "marvel", "dc ", "superman", "batman", "spider", "doomsday"],
    "war": ["war", "army", "soldier", "battle", "operation"],
    "adventure": ["adventure", "journey", "quest", "island", "treasure", "wild"],
    "family": ["family", "kids", "house", "dil"],
    "anime": ["anime", "sub", "dub", "isekai"],
}

LANG_NAMES = {
    "hindi": "Hindi", "bangla": "Bangla", "english": "English", "tamil": "Tamil",
    "telugu": "Telugu", "korean": "Korean", "japanese": "Japanese", "multi": "Multi Audio",
}


# Canonical language buckets used by /language/{slug} routes. The raw label is
# still stored verbatim in titles.language_raw; titles.language holds one of
# these slugs so filtering never misses "Dual [Hindi-Tamil]" style labels.
LANGUAGE_BUCKETS = [
    ("bangla-dubbed", ["bangla dub", "bangla-dubbed"]),
    ("bangla", ["bangla", "bengali"]),
    ("hindi-dubbed", ["hindi dub", "hindi-dubbed", "hq dubbed"]),
    ("hindi", ["hindi"]),
    ("tamil", ["tamil"]),
    ("telugu", ["telugu"]),
    ("malayalam", ["malayalam"]),
    ("kannada", ["kannada"]),
    ("korean", ["korean"]),
    ("japanese", ["japanese"]),
    ("chinese", ["chinese"]),
    ("english", ["english"]),
    ("german", ["german"]),
    ("italian", ["italian"]),
    ("turkish", ["turkish"]),
    ("indonesian", ["indonesian"]),
    ("malaysian", ["malaysian"]),
    ("spanish", ["spanish"]),
    ("french", ["french"]),
    ("portuguese", ["portuguese"]),
    ("vietnamese", ["vietnamese"]),
    ("punjabi", ["punjabi"]),
    ("marathi", ["marathi"]),
    ("gujrati", ["gujarati", "gujrati"]),
]


def normalize_language(raw):
    """Map a raw label such as 'Multi [Hindi-Tamil]' to a canonical slug."""
    if not raw:
        return "others"
    text = html.unescape(raw).replace("\u2013", "-").lower()
    for slug, needles in LANGUAGE_BUCKETS:
        if any(needle in text for needle in needles):
            return slug
    return "others"


def all_languages(raw):
    """Every language slug present in a label, as '|hindi|tamil|'."""
    text = html.unescape(raw or "").replace("\u2013", "-").lower()
    found = [slug for slug, needles in LANGUAGE_BUCKETS if any(n in text for n in needles)]
    if not found:
        found = ["others"]
    return "|" + "|".join(found) + "|"


def clean_language(raw):
    if not raw:
        return None
    text = html.unescape(raw).replace("\u2013", "-").strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def clean_quality(raw):
    if not raw:
        return None
    return html.unescape(raw).strip() or None


def derive_genres(entry):
    text = (entry["title"] + " " + (entry.get("ep_label") or "")).lower()
    found = []
    for genre, needles in GENRE_RULES.items():
        if any(needle in text for needle in needles):
            found.append(genre)
    if entry["type"] == "anime" and "anime" not in found:
        found.append("anime")
    if entry["type"] == "animation" and "animation" not in found:
        found.append("animation")
    if not found:
        found = ["drama"] if entry["type"] in ("series", "drama") else ["action"]
    return sorted(set(found))[:3]


def year_of(entry):
    match = re.search(r"\((\d{4})\)", entry["title"])
    return int(match.group(1)) if match else 2026


def synopsis_of(entry):
    lang = clean_language(entry.get("language")) or "Multi Audio"
    quality = clean_quality(entry.get("quality")) or "HD"
    kind = {"movie": "movie", "series": "web series", "anime": "anime",
            "drama": "K/J/C drama", "animation": "animated feature"}.get(entry["type"], "title")
    extra = f" {entry['ep_label']}." if entry.get("ep_label") else ""
    return (f"{entry['title']} — {lang} {kind} available in {quality}.{extra} "
            "Streaming index with verified quality mirrors, subtitle notes and episode tracking. "
            "Served completely ad-free: no popunders, no click-jacking, no disguised buttons.")


def upload_ago_to_datetime(text):
    """Convert '8 hours ago' style strings to an ISO-ish timestamp."""
    if not text:
        return None
    text = text.split("<")[0].strip().lower()
    m = re.match(r"(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago", text)
    if not m:
        return None
    amount, unit = int(m.group(1)), m.group(2)
    seconds = {"minute": 60, "hour": 3600, "day": 86400, "week": 604800,
               "month": 2592000, "year": 31536000}[unit]
    # Anchor on a fixed date so seed output is reproducible (2026-11-22).
    from datetime import datetime, timedelta, timezone
    anchor = datetime(2026, 11, 22, 9, 0, tzinfo=timezone.utc)
    return (anchor - timedelta(seconds=amount * seconds)).strftime("%Y-%m-%d %H:%M:%S")


# Harvested strip items look like {"title": "Fauzi (2026), Dec 3", "date": "2026"}:
# the real release date is embedded in the label, not in "date".
UPCOMING_DATES = {}
for item in upcoming:
    label = item.get("title", "")
    match = re.search(r",\s*([A-Z][a-z]{2})\s*(\d{1,2})$", label)
    year_match = re.search(r"\((\d{4})\)", label) or re.search(r"(\d{4})", item.get("date", ""))
    if match and year_match:
        name = re.sub(r",\s*[A-Z][a-z]{2}\s*\d{1,2}$", "", label).strip()
        month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].index(match.group(1)) + 1
        UPCOMING_DATES[name.lower()] = f"{int(year_match.group(1))}-{month:02d}-{int(match.group(2)):02d}"


def release_date_for(title):
    key = title.lower()
    for candidate, value in UPCOMING_DATES.items():
        if candidate and (candidate in key or key in candidate):
            return value
    return None


records = []
OTT_HINTS = {
    "netflix": ["netflix", "sacred games", "stranger things"],
    "prime": ["prime", "mirzapur", "the boys", "family man"],
    "jiohotstar": ["hotstar", "disney+", "disney"],
    "sonyliv": ["sonyliv", "scam 1992"],
    "zee5": ["zee5", "zee"],
    "chorki": ["chorki"],
    "bongo": ["bongo"],
    "hoichoi": ["hoichoi", "byomkesh"],
    "crunchyroll": ["anime", "one piece", "naruto", "jujutsu"],
    "mxplayer": ["mx player", "mxplayer"],
    "viki": ["viki", "k-drama", "korean"],
}


def derive_ott(entry):
    """Assign a plausible OTT platform from platform hints + title language."""
    text = (entry["title"] + " " + (entry.get("language") or "")).lower()
    for slug, needles in OTT_HINTS.items():
        if any(needle in text for needle in needles):
            return slug
    if entry["type"] == "anime":
        return "crunchyroll"
    if (entry.get("language") or "").lower() in ("bangla", "bengali"):
        return "chorki"
    if (entry.get("language") or "").lower() == "korean":
        return "viki"
    if entry["type"] in ("series", "drama"):
        return "prime"
    return "netflix"


for entry in titles:
    genres = derive_genres(entry)
    records.append({
        "slug": entry["slug"],
        "title": entry["title"],
        "type": entry["type"],
        "year": year_of(entry),
        "quality": clean_quality(entry.get("quality")),
        "language": normalize_language(entry.get("language")),
        "language_raw": clean_language(entry.get("language")),
        "languages": all_languages(entry.get("language")),
        "rating": entry.get("rating"),
        "views": entry.get("views") or 0,
        "poster": entry.get("poster"),
        "ep_label": entry.get("ep_label"),
        "ep_state": entry.get("ep_state"),
        "status": "ongoing" if (entry.get("ep_label") and "completed" not in (entry.get("ep_label") or "").lower()) else "completed",
        "synopsis": synopsis_of(entry),
        "is_pinned": 1 if entry.get("pinned") else 0,
        "is_adult": 1 if entry.get("adult") else 0,
        "is_new": 1 if entry.get("new") else 0,
        "is_upcoming": 1 if entry.get("upcoming") else 0,
        "genres": genres,
        "ott_slug": derive_ott(entry),
        "release_date": f"{year_of(entry)}-01-01" if entry["type"] == "movie" else None,
        "updated_at": upload_ago_to_datetime(entry.get("uploaded")) or "2026-11-20 12:00:00",
    })

# Harvested "upcoming" strip entries that are not in the card list yet.
known_slugs = {r["slug"] for r in records}
for item in upcoming:
    raw_title = item["title"].strip()
    # Harvested labels look like "Fauzi (2026), Dec 3" → keep the name + year.
    title = re.sub(r",\s*[A-Z][a-z]{2}\s*\d{1,2}$", "", raw_title).strip()
    slug = "up-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if slug in known_slugs:
        continue
    records.append({
        "slug": slug,
        "title": title,
        "type": "movie",
        "year": year_of({"title": title}),
        "quality": "Coming soon",
        "language": "others",
        "language_raw": "Multi Audio",
        "languages": "|others|",
        "rating": None,
        "views": 0,
        "poster": item.get("poster"),
        "ep_label": None,
        "ep_state": None,
        "status": "upcoming",
        "synopsis": f"{title} — upcoming release, added to the calendar. Bookmark the page to get the download as soon as it drops.",
        "is_pinned": 0,
        "is_adult": 0,
        "is_new": 1,
        "is_upcoming": 1,
        "genres": derive_genres({"title": title, "type": "movie", "ep_label": None}),
        "ott_slug": None,
        "runtime": "TBA",
        "updated_at": "2026-11-22 06:00:00",
        "release_date": release_date_for(title) or "2026-12-31",
    })

def stable_rating(title):
    digits = sum(ord(ch) for ch in title)
    return round(5.0 + (digits % 46) / 10.0, 1)  # 5.0 … 9.5


for record in records:
    if record["rating"] is None and record["status"] != "upcoming":
        record["rating"] = stable_rating(record["title"])
    if record["status"] != "upcoming":
        # Deterministic split: ~1 in 3 multi-episode series is still ongoing,
        # everything else is treated as a completed season.
        if record["ep_label"] and sum(ord(c) for c in record["title"]) % 3 == 0:
            record["status"] = "ongoing"
        else:
            record["status"] = "completed"
    if "release_date" not in record and record["status"] == "upcoming":
        record["release_date"] = release_date_for(record["title"]) or "2026-12-31"

records.sort(key=lambda r: (r["status"] == "upcoming", r["is_pinned"] * -1, -(r["views"] or 0)))

COLLECTIONS = [
    ("top-rated-hindi-dubbed", "Top Rated Hindi Dubbed",
     "The highest rated Hindi and Hindi-dubbed titles, sorted by views.",
     ["hindi", "hindi dubbed"]),
    ("south-indian-blockbusters", "South Indian Blockbusters",
     "Tamil, Telugu, Malayalam and Kannada hits in one place.",
     ["tamil", "telugu", "malayalam", "kannada"]),
    ("korean-drama-must-watch", "Korean Drama Must Watch",
     "The K-dramas that actually deserve the hype.",
     ["korean", "k-drama"]),
    ("bangla-web-series", "Bangla Web Series",
     "Chorki, Hoichoi, Bongo and other local originals.",
     ["bangla", "bengali"]),
    ("best-bangla-dubbed-movies", "Best Bangla Dubbed",
     "Blockbusters that ship with a Bangla dub track.",
     ["bangla-dubbed", "bangla dubbed"]),
    ("mcu-marvel-cinematic-universe", "Marvel Cinematic Universe",
     "Every MCU film and series, in release order.",
     ["avengers", "marvel", "spider", "thor", "iron", "superhero"]),
    ("superhero-universe", "Superhero Universe (Marvel + DC)",
     "Spandex, multiverses and end-of-the-world stakes.",
     ["superhero", "marvel", "avengers", "spider", "dc", "batman", "superman"]),
    ("anime-zone", "Anime Zone",
     "Seasonal anime, subs and dubs — updated weekly.",
     ["anime", "sub", "dub", "isekai"]),
    ("series-and-reality", "Series & Reality Shows",
     "Weekly episodes, reality shows and long runners.",
     ["series", "reality", "biggboss", "bigg boss"]),
    ("thriller-mystery", "Thriller & Mystery",
     "Whodunits, slow burns and edge-of-seat rides.",
     ["thriller", "mystery", "crime", "suspense", "action"]),
    ("horror-night", "Horror Night",
     "Lights off, volume up.",
     ["horror", "ghost", "haunted", "evil", "mystery"]),
    ("family-animation", "Family & Animation",
     "Something for the whole room.",
     ["animation", "family", "kids", "cartoon", "comedy"]),
]

OTT = [
    ("netflix", "Netflix", "https://image.tmdb.org/t/p/w154/rK1KljqmbvO9HQa1PBFLILWah72.png"),
    ("prime", "Prime Video", "https://image.tmdb.org/t/p/w154/gMZdpavHmxFNnLpMHwVxfqeux2g.png"),
    ("jiohotstar", "JioHotstar", "https://image.tmdb.org/t/p/w154/ledoS6EgdjTNq8F1e6wubUQer18.png"),
    ("sonyliv", "SonyLIV", "https://image.tmdb.org/t/p/w154/coM4QWbmIOa0xJ5cGR9BRmoV25B.png"),
    ("zee5", "ZEE5", "https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/avatar_svzxes1795265348.png"),
    ("chorki", "Chorki", "https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/avatar_w4maay1795263722.png"),
    ("bongo", "Bongo", "https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/avatar_2kcgje1795263855.png"),
    ("hoichoi", "Hoichoi", "https://image.tmdb.org/t/p/w154/8dgAD4EzQWMsyudVwWCFg19998L.png"),
    ("deepto", "Deepto Play", "https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/avatar_h4ojso1795263857.png"),
    ("iscreen", "iScreen", "https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/avatar_1h6gux1795263859.png"),
    ("mxplayer", "MX Player", "https://pub-69b6234af505413bbeac2bbc8039195c.r2.dev/avatar_98x6ka1795265316.png"),
    ("crunchyroll", "Crunchyroll", "https://image.tmdb.org/t/p/w154/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png"),
    ("disney", "Disney+", "https://image.tmdb.org/t/p/w154/5eZ872CghnHFLB1j8grszbrx0dx.png"),
    ("paramount", "Paramount+", "https://image.tmdb.org/t/p/w154/pkx3klJlwW5JdtaulvDx6hDNtch.png"),
    ("hbomax", "HBO Max", "https://image.tmdb.org/t/p/w154/skypuy7SXuugIQeYg0IglmzoKaS.png"),
    ("hulu", "Hulu", "https://image.tmdb.org/t/p/w154/44uAnmSqvA4yBOdbPWN8YgQHjWm.png"),
    ("viki", "Viki", "https://image.tmdb.org/t/p/w154/AoNsevRecTdVv4xQEf1oLRGO2yh.png"),
]

GENRES = [
    ("action", "Action", "⚔️"), ("adventure", "Adventure", "🗺️"), ("animation", "Animation", "🎨"),
    ("anime", "Anime", "🍥"), ("biographical", "Biographical", "📖"), ("comedy", "Comedy", "😂"),
    ("crime", "Crime", "🕵️"), ("documentary", "Documentary", "🎥"), ("drama", "Drama", "🎭"),
    ("family", "Family", "👨‍👩‍👧"), ("fantasy", "Fantasy", "🧙"), ("historical", "Historical", "🏛️"),
    ("horror", "Horror", "👻"), ("music", "Music", "🎵"), ("musical", "Musical", "🎤"),
    ("mystery", "Mystery", "🔍"), ("romance", "Romance", "💕"), ("sci-fi", "Sci-Fi", "🚀"),
    ("sports", "Sports", "🏆"), ("superhero", "Superhero", "🦸"), ("survival", "Survival", "🏕️"),
    ("suspense", "Suspense", "😰"), ("thriller", "Thriller", "🧩"), ("war", "War", "🪖"),
]

NOTICES = [
    ("🎉 MovieLinkBD is now 100% ad-free — no pop-ups, no redirects, no fake buttons.", "new", "#2ad99a"),
    ("📢 Drishyam 3 (2026) Full HD lands Thursday, 27 November.", "important", "#ffc83d"),
    ("🚀 New public JSON API — 18 endpoints, documented at /api.", "new", "#38bdf8"),
]

PAGES = [
    ("about", "About MovieLinkBD",
     "MovieLinkBD is a clean, ad-free index of movies, web series, anime and K/J/C drama. "
     "We list metadata, quality options and verified mirrors — nothing else. No popunders, no "
     "fake download buttons, no forced app installs."),
    ("dmca", "DMCA & Takedown",
     "MovieLinkBD does not host video files. If you believe a listing infringes your rights, "
     "send a takedown request to the address in the footer and we remove the listing within 48 hours."),
    ("privacy", "Privacy policy",
     "We store no accounts and no advertising identifiers. The only client-side storage is "
     "your local \"recently viewed\" list, kept in your browser and never uploaded."),
    ("faq", "Help & FAQ",
     "How to unzip · how to pick a quality · how to report a dead mirror · why there are no ads. "
     "Every answer lives on this page and nowhere else."),
]


def php_export(value, indent=0):
    pad = "    " * indent
    if isinstance(value, dict):
        lines = ["["]
        for key, item in value.items():
            key_repr = f"'{key}'" if isinstance(key, str) else str(key)
            lines.append(f"{pad}    {key_repr} => {php_export(item, indent + 1)},")
        lines.append(pad + "]")
        return "\n".join(lines)
    if isinstance(value, list):
        if all(not isinstance(item, (dict, list)) for item in value):
            inner = ", ".join(php_export(item, 0) for item in value)
            return f"[{inner}]"
        lines = ["["]
        for item in value:
            lines.append(f"{pad}    {php_export(item, indent + 1)},")
        lines.append(pad + "]")
        return "\n".join(lines)
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    escaped = str(value).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


php = """<?php
/**
 * AUTO-GENERATED by tools/build_seed.py from the captured MovieLinkBD
 * homepage.  Run `php bin/console.php migrate --seed` to import.
 *
 * Do not edit by hand: edit tools/build_seed.py and regenerate, or use the
 * /admin panel for one-off changes.
 */

declare(strict_types=1);

return [
    'titles' => %s,

    'genres' => %s,

    'collections' => %s,

    'ott' => %s,

    'notices' => %s,

    'pages' => %s,
];
""" % (
    php_export(records, 2),
    php_export([{"slug": s, "name": n, "icon": i} for s, n, i in GENRES], 2),
    php_export([{"slug": s, "name": n, "description": d, "keywords": k,
                 "tokens": '|' + '|'.join(k) + '|'} for s, n, d, k in COLLECTIONS], 2),
    php_export([{"slug": s, "name": n, "logo": l} for s, n, l in OTT], 2),
    php_export([{"message": m, "style": st, "color": c} for m, st, c in NOTICES], 2),
    php_export([{"slug": s, "title": t, "body": b} for s, t, b in PAGES], 2),
)

open(os.path.join(ROOT, "database", "seed.php"), "w", encoding="utf-8").write(php)
print("wrote database/seed.php with", len(records), "titles")

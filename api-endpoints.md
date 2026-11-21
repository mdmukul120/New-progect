# ChinFetcher API — যাচাইকৃত এন্ডপয়েন্ট

**Base URL:** `https://chinfetcher.duckdns.org`
সব রেসপন্স JSON: `{ "success": true, "data": … }`

---

## ✅ লাইভ টেস্টে নিশ্চিত হওয়া এন্ডপয়েন্ট

| # | এন্ডপয়েন্ট | স্ট্যাটাস | নোট |
|---|---|---|---|
| 1 | `GET /` | ✅ 200 | `{"message":"works"}` |
| 2 | `GET /api/health` | ✅ 200 | `{"success":true,"message":"Moviesmod Extractor API is running"}` |
| 3 | `GET /api/providers` | ✅ 200 | **১৪টি** প্রোভাইডার |
| 4 | `GET /api/catalog?provider=` | ✅ 200 | প্রোভাইডারের ক্যাটাগরি/ফিল্টার লিস্ট |
| 5 | `GET /api/posts?provider=&filter=&page=` | ✅ 200 | পোস্ট লিস্ট (title, link, image) |
| 6 | `GET /api/search?q=&provider=` | ✅ 200 | সার্চ |
| 7 | `GET /api/info`, `/api/meta` | ⚠️ 404 | GET-এ "Endpoint not found" — প্যারামিটার/মেথড ভিন্ন |
| 8 | `GET /api/stream` | ⚠️ 404 | একই |
| 9 | `GET /api/episodes` | ⚠️ 404 | একই |

### প্রোভাইডার (১৪টি)
`moviesmod`, `topmovies`, `vega`, `hdhub4u`, `uhd`, `moviesdrive`, `lux`,
`gokuhd`, `4kHdHhub`, `movies4u`, `eonmovies`, `kat`, `castle`, `onexbet`

`nonStreamableServer` (যেগুলো স্ট্রিম হবে না, শুধু ডাউনলোড):
- **vega** → `filepress`, `hubcloud`, `HubCdn`
- **uhd** → `Gdrive-Instant`

### রেসপন্স শেপ

```jsonc
// GET /api/providers
{ "success": true, "data": [ { "id": "moviesmod", "name": "Moviesmod", "nonStreamableServer": [] } ] }

// GET /api/catalog?provider=moviesmod
{ "success": true, "data": [
    { "title": "Latest", "filter": "" },
    { "title": "Netflix", "filter": "/ott/netflix" },
    { "title": "HBO Max", "filter": "/ott/hbo-max" },
    { "title": "Amazon Prime", "filter": "/ott/amazon-prime-video" } ],
  "provider": "moviesmod" }

// GET /api/posts?provider=moviesmod&filter=&page=1
{ "success": true, "data": [
    { "title": "The Blue Road (Season 1) Multi Audio {Hindi-English-Korean} WeB-DL 480p [170MB] || 720p [300MB] || 1080p [1.3GB]",
      "link": "/download-the-blue-road-season-1-hindi-480p-720p-1080p/",
      "image": "https://moviesmod.fi/wp-content/uploads/2026/11/Download-The-Blue-Road-Hindi-English.webp" } ],
  "page": 1, "filter": "", "provider": "moviesmod" }
```

### অফিসিয়াল স্পেক (ডকুমেন্টেড, একই আর্কিটেকচার)
সোর্স: `DHR-Store/provider-checker` README — একই ধরনের Vega-প্রোভাইডার API।

| এন্ডপয়েন্ট | প্যারামিটার |
|---|---|
| `/api/catalog` | `provider` |
| `/api/posts` | `provider`, `filter`, `page` |
| `/api/meta` | `provider`, `link` |
| `/api/episodes` | `provider`, `url` (এপিসোড লিস্ট লিংক) |
| `/api/stream` | `provider`, `link`, `type` (`movie` \| `series` \| `episode`) |
| `/api/search` | `provider`, `query`, `page` |

`/api/meta` রেসপন্স: `{ title, synopsis, image, imdbId, type, linkList: [...] }`
`/api/stream` রেসপন্স: `[{ server, link, type, quality }]`

→ লাইভ সার্ভারে `/api/info` নামে আছে (স্পেকের `/api/meta`-র সমতুল্য) কিন্তু GET-এ 404,
তাই পেজটি **info → meta → url ভ্যারিয়েন্ট → POST** ক্রমে চেষ্টা করে এবং ব্যর্থ হলে
"Open source page" ফলব্যাক দেখায়।

---

## ⚠️ স্যান্ডবক্স নেটওয়ার্ক নোট

স্যান্ডবক্সের `bash`/`curl` এই ডোমেইনে পৌঁছায় না (`SSL_ERROR_SYSCALL`, HTTP 000)।
`fetch_page` টুল ও `api.allorigins.win` রিলে কাজ করে — তাই পেজের `assets/api.js`-এ
ডাইরেক্ট কল ব্যর্থ হলে **allorigins/corsproxy রিলে** স্বয়ংক্রিয়ভাবে ব্যবহৃত হয়।

---

## পেজ আর্কিটেকচার

```
index.html            shell (header, hero, views, modals)
assets/app.css        ডিজাইন সিস্টেম (dark/light, responsive, skeletons)
assets/api.js         API ক্লায়েন্ট (cache, retry, relay, normaliser, parsePost)
assets/app.js         UI লজিক (home/browse/search/series, detail, player, favorites)
index-tvmaze.html     আগের TVmaze ভার্সন (ব্যাকআপ)
```

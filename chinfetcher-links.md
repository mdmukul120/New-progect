# ChinFetcher — JS File থেকে পাওয়া সকল লিংক

**সাইট:** https://chinfetcher.vercel.app/
**টাইটেল:** ChinFetcher - Movie & TV Series Download Aggregator
**JS বান্ডল:** https://chinfetcher.vercel.app/assets/index-Bo_Z3UR8.js

> ⚠️ **নোট:** JS বান্ডলটি (React/Vite production build, ~200KB+) সরাসরি ডাউনলোড করা যায়নি — ফাইলটি অনেক বড় হওয়ায় আমার টুল দিয়ে পুরো কন্টেন্ট পড়া সম্ভব হয়নি। নিচের সব লিংক সাইটের রেন্ডার করা কন্টেন্ট, robots.txt, sitemap.xml এবং ওয়েব অ্যানালাইসিস থেকে সংগ্রহ করা হয়েছে — এগুলোই অ্যাপের কার্যকর সব লিংক।

---

## ১. সাইটের নিজস্ব লিংক

| লিংক | বিবরণ |
|---|---|
| https://chinfetcher.vercel.app/ | হোমপেজ |
| https://chinfetcher.vercel.app/assets/index-Bo_Z3UR8.js | মূল JS বান্ডল |
| https://chinfetcher.vercel.app/robots.txt | robots.txt (`/api/` ও `/admin/` disallow করা) |
| https://chinfetcher.vercel.app/sitemap.xml | sitemap (শুধু হোমপেজ) |
| https://chinfetcher.vercel.app/admin/ | অ্যাডমিন রুট (SPA client-side route) |
| https://schema.org | JSON-LD structured data context |

---

## ২. প্রোভাইডার/সেকশন অনুযায়ী কন্টেন্ট ও ইমেজ লিংক

### Moviesmod
- **ডোমেইন:** `moviesmod.fi`
- **প্যাটার্ন:** `https://moviesmod.fi/wp-content/uploads/YYYY/MM/<file>.webp|.jpg`
- উদাহরণ: `https://moviesmod.fi/wp-content/uploads/2026/11/Download-The-Blue-Road-Hindi-English.webp`

### Topmovies
- **ডোমেইন:** `moviesleech.help`
- **প্যাটার্ন:** `https://moviesleech.help/wp-content/uploads/YYYY/MM/<file>.png`
- উদাহরণ: `https://moviesleech.help/wp-content/uploads/2026/11/Screenshot_81.png`

### Vega
- **ডোমেইন:** `image.tmdb.org` (TMDB পোস্টার CDN)
- **প্যাটার্ন:** `https://image.tmdb.org/t/p/w500/<path>.jpg`, `/w400/`, `/original/`
- উদাহরণ: `https://image.tmdb.org/t/p/w500/53P8oHo9cfOsgb1cLxBi4pFY0ja.jpg`

### Lux
- `image.tmdb.org` — TMDB পোস্টার
- `imgbb.fit` — `https://imgbb.fit/ib/<id>_<timestamp>.jpg`
- `catimages.org` — `https://catimages.org/images/YYYY/MM/DD/<file>.jpg`
- `rogmovies.beauty` — `https://rogmovies.beauty/wp-content/uploads/YYYY/MM/<file>.webp`
- `encrypted-tbn0.gstatic.com` — Google image thumbnail proxy
- `media.themoviedb.org` — `https://media.themoviedb.org/t/p/w220_and_h330_face/<path>.jpg`

### fhxod/fodcyy/bhcxy সেকশন (নির্দিষ্ট API থেকে আসা কন্টেন্ট)
- `img1.fhxod.com`
- `img1.fodcyy.com`
- `img1.bhcxy.com`
- **প্যাটার্ন:**
  - `https://img1.fhxod.com/image/<sha1-hash>.jpg`
  - `https://img1.fhxod.com/<uuid>.jpg|.jpeg|.webp`
  - `https://img1.bhcxy.com/film-movie-photo/<hash>.jpg`
  - `https://img1.bhcxy.com/image/<hash>.jpg`

### Onexbet
- **ডোমেইন:** `images.metahub.space` ও `live.metahub.space` (MetaHub পোস্টার API)
- **প্যাটার্ন:** `https://images.metahub.space/poster/small/tt<imdb-id>/img`
- উদাহরণ: `https://images.metahub.space/poster/small/tt0903747/img` (Breaking Bad)

---

## ৩. সম্ভাব্য API এন্ডপয়েন্ট (ইনফার করা — JS থেকে নিশ্চিত করা যায়নি)

- **`api.hbzws.com`** — `img1.fhxod.com`, `img1.fodcyy.com`, `img1.bhcxy.com` এই তিনটি ইমেজ CDN একই API-এর সাথে ব্যবহৃত হয় (tigertvs.mobi সাইটেও একই কম্বিনেশন দেখা গেছে)। তাই ChinFetcher-এর fhxod সেকশনের ডেটা সম্ভবত এই API থেকেই আসে।
- **TMDB API** (`image.tmdb.org`) — Vega ও Lux সেকশনের পোস্টার TMDB থেকে আসে।
- **MetaHub API** (`images.metahub.space`) — Onexbet সেকশনের পোস্টার IMDb ID দিয়ে তৈরি হয়।
- **WordPress REST API / স্ক্র্যাপিং** — Moviesmod (`moviesmod.fi`) ও Topmovies (`moviesleech.help`) WordPress সাইট; এগুলো থেকে ডেটা নেওয়া হয়।

---

## ৪. সারসংক্ষেপ — সব ইউনিক ডোমেইন

```
chinfetcher.vercel.app        (মূল সাইট)
moviesmod.fi                  (Moviesmod প্রোভাইডার)
moviesleech.help              (Topmovies প্রোভাইডার)
image.tmdb.org                (TMDB পোস্টার — Vega, Lux)
media.themoviedb.org          (TMDB — Lux)
imgbb.fit                     (Lux)
catimages.org                 (Lux)
rogmovies.beauty              (Lux)
encrypted-tbn0.gstatic.com    (Google proxy — Lux)
img1.fhxod.com                (API সেকশন)
img1.fodcyy.com               (API সেকশন)
img1.bhcxy.com                (API সেকশন)
images.metahub.space          (Onexbet — MetaHub)
live.metahub.space            (Onexbet — MetaHub)
schema.org                    (JSON-LD)
api.hbzws.com                 (সম্ভাব্য ব্যাকএন্ড API — ইনফার করা)
```

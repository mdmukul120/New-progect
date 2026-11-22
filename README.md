# SiteHub — ব্যক্তিগত সাইট হোস্টিং প্যানেল

জিপ আপলোড করে সাইট চালু করুন, ব্রাউজারেই কোড এডিট / ডিলিট করুন, প্রতিটি সাইট আলাদা
সাবডোমেইনে সার্ভ করুন। Vercel + (ঐচ্ছিক) Supabase Storage-এ চলে, আবার লোকাল/VPS-এও চলে।

## ফিচার

- 🔐 পাসওয়ার্ড লগইন (HttpOnly signed cookie, HMAC-SHA256)
- 📦 **জিপ আপলোড** — ব্রাউজারেই unzip (`fflate`), তাই Vercel-এর ৪.৫ MB বডি লিমিট কোনো বাধা নয়
- ✏️ **কোড এডিটর** — CodeMirror 6, HTML/CSS/JS/MD সিনট্যাক্স হাইলাইট, `Ctrl/⌘+S` সেভ
- 🗂 ফাইল ম্যানেজার — নতুন ফাইল, রিনেম, ডিলিট, সাবফোল্ডার
- 🌐 Host-ভিত্তিক রাউটিং — `hello.yourdomain.com` → সাইট `hello`
- 🧱 Path traversal, কঠোর নাম-ভ্যালিডেশন, প্রতি-ফাইল ১ MB ও ৪০০ ফাইল লিমিট

## দ্রুত শুরু

```bash
npm install
cp .env.example .env.local   # ADMIN_PASSWORD সেট করুন
npm run dev                  # http://localhost:3000
```

লগইন → নতুন সাইট বানান → জিপ ফেলে দিন → `/s/<site>` প্রিভিউতে দেখুন।

## env ভেরিয়েবল

| কী | কাজ |
|---|---|
| `ADMIN_PASSWORD` | প্যানেলের পাসওয়ার্ড (আবশ্যক) |
| `AUTH_SECRET` | সেশন সাইন করার গোপন কী (লম্বা র‍্যান্ডম) |
| `STORAGE_DRIVER` | `local` (ডিফল্ট) বা `supabase` |
| `DATA_DIR` | লোকাল ড্রাইভারের ডাটা ফোল্ডার (`.data`) |
| `ROOT_DOMAIN` | wildcard রুট, যেমন `yoursite.xyz` → `*.yoursite.xyz` |
| `DEFAULT_SITE` | সাবডোমেইন না থাকলে কোন সাইট দেখাবে (একক-ডোমেইন মোড) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_BUCKET` | Supabase স্টোরেজ |

## ডোমেইন বসানো

1. Vercel → Project → **Settings → Domains** → `yoursite.xyz`, `www`, `*.yoursite.xyz`
2. DNS: `A @ → Vercel IP`, `CNAME www → cname.vercel-dns.com.`,
   `CNAME * → cname.vercel-dns.com.`, wildcard SSL-এর জন্য
   `NS _acme-challenge → Vercel-এর দেওয়া nameserver`
3. একক ডোমেইনে (যেমন `মুকুল.পাতা.বাংলা`) চালাতে চাইলে `DEFAULT_SITE=<site>` দিন এবং
   সেই ডোমেইনে `CNAME → cname.vercel-dns.com.`

## ⚠️ সীমা

- Vercel-এর ফাইল সিস্টেম read-only → Vercel-এ চালাতে **Supabase স্টোরেজ আবশ্যক**
- Supabase free tier: ১ GB স্টোরেজ (কম্প্রেসড HTML/CSS সাইটের জন্য যথেষ্ট)
- Vercel Hobby: শুধু ব্যক্তিগত/নন-কমার্শিয়াল ব্যবহার

## লাইভ ইনস্টল (আপনার অ্যাকাউন্টে)

| কী | মান |
|---|---|
| Vercel প্রজেক্ট | `sitehub` (`prj_Uw9mJXBI57Bm6oahwnLbVZdXHZkc`) |
| Supabase প্রজেক্ট | `movielinkbd` (`otdrcsarfklukhuhfpzi`), bucket `sitehub` |
| কাস্টম ডোমেইন | `মুকুল.পাতা.বাংলা` → `xn--p5b3cn2db.xn--45bl4db.xn--54b7fta0cc` |

### DNS রেকর্ড (ready.bd → DNS Records)

| Type | Name | Value |
|---|---|---|
| TXT | `_vercel` | `vc-domain-verify=xn--p5b3cn2db.xn--45bl4db.xn--54b7fta0cc,855a1cf26df5bc3a1a3c` |
| CNAME | `মুকুল` (অথবা `xn--p5b3cn2db`) | `cname.vercel-dns.com.` |

Vercel → Settings → Domains → Refresh → "Valid Configuration" দেখলেই লাইভ, SSL অটো।

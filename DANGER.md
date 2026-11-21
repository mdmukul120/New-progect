# ⚠️ DANGER — CRICFy_v7.4.3.zip

**এই APK স্বাক্ষরবিহীন/রিপ্যাকড সন্দেহ এবং অজানা সার্ভারের সাথে যোগাযোগ করে। ইন্সটল করবেন না।**

- মূল ফাইল: `CRICFy_v7.4.3.zip`
- SHA256: `b5a78589bc1d9cddb6542e2ee2e82b7daf8b408ffaac0db595e2b12f80ff2ed3`
- ফোল্ডার: [`output/danger/`](output/danger/) — `DANGER.md`, `DANGEROUS_FILES.md`, `DANGEROUS_LINKS.md`, `INVALID_LINKS.txt`, `DANGER_REPORT.csv`

## মূল লাল পতাকা

| # | সেভারিটি | সমস্যা |
|---|---|---|
| 1 | CRITICAL | META-INF-এ APK স্বাক্ষর (MANIFEST.MF/.SF/.RSA) অনুপস্থিত — রিপ্যাকড/অবিশ্বস্ত বিল্ড |
| 2 | HIGH | `https://dokoplay.xyz/server_lookup.php?channel_id=premium` — অজানা প্রিমিয়াম সার্ভার lookup |
| 3 | HIGH | `https://pub-9610baca6bf84734bf9d40546dc754a6.r2.dev/config.txt` — রিমোট কনফিগ (চলন্ত অবস্থায় আচরণ পরিবর্তনযোগ্য) |
| 4 | HIGH | `https://cfygsjsgdj141.top/`, `rtstv.xyz`, `newembedplay.xyz`, `pscp.tv` — র‍্যান্ডম/অজানা ডোমেইন |
| 5 | HIGH | `classes.dex` (10.1 MB) + `classes2.dex` (3.1 MB) — অবফাসকেটেড কোড |
| 6 | HIGH | অজানা `libnative-lib.so` (সব ABI-তে) — সোর্স ছাড়া আচরণ যাচাই অসম্ভব |
| 7 | MEDIUM | CashRaven consent SDK + Unity Ads + Firebase Remote Config/FCM — ট্র্যাকিং ও রিমোট কনফিগ |
| 8 | MEDIUM | Hotstar/Cricbuzz/vk.com — কপিরাইটকৃত প্রিমিয়াম কনটেন্টের সম্ভাব্য অননুমোদিত স্ট্রিমিং (আইনি ঝুঁকি) |

## ঝুঁকিপূর্ণ পারমিশন

- ⚠️ `android.permission.FOREGROUND_SERVICE` — ফোরগ্রাউন্ড সার্ভিস — স্ট্রিমিং অ্যাপের জন্য স্বাভাবিক
- ⚠️ `android.permission.POST_NOTIFICATIONS` — নোটিফিকেশন
- ⚠️ `android.permission.QUERY_ALL_PACKAGES` — ইন্সটল করা সব অ্যাপ দেখা — বিজ্ঞাপন টার্গেটিং/প্রোফাইলিং
- ⚠️ `android.permission.RECEIVE_BOOT_COMPLETED` — বুটে চালু — ব্যাকগ্রাউন্ড persistence
- ⚠️ `android.permission.REQUEST_INSTALL_PACKAGES` — নতুন/আপডেটেড APK ইনস্টল করার অনুমতি — পার্শ্ব-লোড + অটো-আপডেট ম্যালওয়্যারের পথ
- ⚠️ `android.permission.SYSTEM_ALERT_WINDOW` — অন্যান্য অ্যাপের ওপর ওভারলে — ফিশিং/ক্লিক-জালিয়াতি সম্ভব
- ⚠️ `android.permission.WAKE_LOCK` — স্ক্রিন জাগিয়ে রাখা — ভিডিওর জন্য স্বাভাবিক

## বিস্তারিত

পূর্ণ রিপোর্ট: **[output/danger/DANGER.md](output/danger/DANGER.md)**

> দ্রষ্টব্য: এটি স্বয়ংক্রিয় স্ট্যাটিক বিশ্লেষণ; চূড়ান্ত সিদ্ধান্ত নয়।

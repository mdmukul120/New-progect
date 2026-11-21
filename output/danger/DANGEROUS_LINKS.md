# সন্দেহজনক / সম্ভাব্য ক্ষতিকর লিংক

মূল ZIP-এর SHA256: `b5a78589bc1d9cddb6542e2ee2e82b7daf8b408ffaac0db595e2b12f80ff2ed3`

মোট ফ্ল্যাগড লিংক: **27** (HIGH 7, MEDIUM 16, LOW 4)

| # | উৎস | লিংক | কারণ | উৎস ফাইল |
|---|---|---|---|---|
| 1 | HIGH | `https://cfygsjsgdj141.top/` | র‍্যান্ডম-দেখানো .top ডোমেইন — স্ট্যান্ডার্ড API নয়, সন্দেহজনক C2/কনফিগ হোস্ট | CRICFy_v7.4 (3)/dl/dl.xml |
| 2 | HIGH | `https://dokoplay.xyz` | অজানা ডোমেইনে server_lookup.php?channel_id=premium — প্রিমিয়াম স্ট্রিম সোর্স খোঁজার endpoint, অবৈধ স্ট্রিমিং সন্দেহ | CRICFy_v7.4 (3)/classes.dex |
| 3 | HIGH | `https://dokoplay.xyz/server_lookup.php?channel_id=premium` | অজানা ডোমেইনে server_lookup.php?channel_id=premium — প্রিমিয়াম স্ট্রিম সোর্স খোঁজার endpoint, অবৈধ স্ট্রিমিং সন্দেহ | CRICFy_v7.4 (3)/classes.dex |
| 4 | HIGH | `https://newembedplay.xyz` | অজানা .xyz ডোমেইন — এম্বেড প্লেয়ার/স্ট্রিম হোস্ট সন্দেহ | CRICFy_v7.4 (3)/classes.dex |
| 5 | HIGH | `https://pscp.tv` | অজানা ভিডিও হোস্ট — কনটেন্ট উৎস যাচাই করা অসম্ভব | CRICFy_v7.4 (3)/classes.dex |
| 6 | HIGH | `https://pub-9610baca6bf84734bf9d40546dc754a6.r2.dev/config.txt` | ক্লাউডফ্লেয়ার R2-তে হোস্ট করা রিমোট কনফিগ (config.txt) — অ্যাপ চালু হলে ডাউনলোড হয়; RCE/রিডাইরেক্ট প্রক্সি হতে পারে | CRICFy_v7.4 (3)/classes.dex |
| 7 | HIGH | `https://rtstv.xyz` | অজানা .xyz ডোমেইন — সন্দেহজনক কনটেন্ট/স্ট্রিম হোস্ট | CRICFy_v7.4 (3)/classes.dex |
| 8 | MEDIUM | `https://app-measurement.com/a` | Google Analytics/Firebase App Measurement — বিশ্লেষণ ট্র্যাকিং | CRICFy_v7.4 (3)/classes.dex |
| 9 | MEDIUM | `https://app-measurement.com/s/d` | Google Analytics/Firebase App Measurement — বিশ্লেষণ ট্র্যাকিং | CRICFy_v7.4 (3)/classes.dex |
| 10 | MEDIUM | `https://cashraven.io/legal/eula` | CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে | CRICFy_v7.4 (3)/lib/armeabi-v7a/libcr_android.so |
| 11 | MEDIUM | `https://cashraven.io/legal/privacy` | CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে | CRICFy_v7.4 (3)/lib/armeabi-v7a/libcr_android.so |
| 12 | MEDIUM | `https://cashraven.io/legal/terms-of-use` | CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে | CRICFy_v7.4 (3)/lib/arm64-v8a/libcr_android.so | CRICFy_v7.4 (3)/lib/armeabi-v7a/libcr_android.so | CRICFy_v7.4 (3)/lib/x86_64/libcr_android.so |
| 13 | MEDIUM | `https://developers.cashraven.io` | CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে | CRICFy_v7.4 (3)/classes.dex | CRICFy_v7.4 (3)/classes2.dex |
| 14 | MEDIUM | `https://fcmregistrations.googleapis.com/v1/projects/` | Firebase Cloud Messaging registration — পুশ টোকেন নিবন্ধন | CRICFy_v7.4 (3)/classes.dex |
| 15 | MEDIUM | `https://firebaseinstallations.googleapis.com/v1/` | Firebase Installations — ডিভাইস/ইনস্ট্যান্স আইডি নিবন্ধন ও ট্র্যাকিং | CRICFy_v7.4 (3)/classes.dex |
| 16 | MEDIUM | `https://firebaseremoteconfig.googleapis.com/v1/projects/` | Firebase Remote Config — সার্ভার থেকে অ্যাপ আচরণ (URL/পতাকা) পরিবর্তনযোগ্য; হাইজ্যাকিং ঝুঁকি | CRICFy_v7.4 (3)/classes.dex |
| 17 | MEDIUM | `https://firebaseremoteconfigrealtime.googleapis.com/v1/projects/` | Firebase Remote Config Realtime — রিয়েলটাইম সার্ভার কনফিগ | CRICFy_v7.4 (3)/classes.dex |
| 18 | MEDIUM | `https://gateway.unityads.unity3d.com/v1` | Unity Ads গেটওয়ে — বিজ্ঞাপন সিস্টেম, ডিভাইস ID ও ইউসেজ ডেটা আদান-প্রদান করে | CRICFy_v7.4 (3)/classes.dex |
| 19 | MEDIUM | `https://pagead2.googlesyndication.com/pagead/gen_204?id=gmob-apps` | Google AdSense/Google syndication — বিজ্ঞাপন পরিবেশনা + ট্র্যাকিং | CRICFy_v7.4 (3)/classes.dex |
| 20 | MEDIUM | `https://vk.com` | Vkontakte (vk.com) — রুশ সোশ্যাল/ভিডিও; অননুমোদিত ভিডিও এম্বেড উৎস হতে পারে | CRICFy_v7.4 (3)/classes.dex |
| 21 | MEDIUM | `https://www.cricbuzz.com/` | Cricbuzz — কপিরাইটকৃত ক্রিকেট কনটেন্ট; অ্যাপে ব্যবহার অননুমোদিত স্ট্রিমিং হতে পারে | CRICFy_v7.4 (3)/ai/ai.xml | CRICFy_v7.4 (3)/classes.dex |
| 22 | MEDIUM | `https://www.googleadservices.com/pagead/conversion/app/deeplink?id_type=adid&sdk_version=` | Google Ads conversion/deeplink — বিজ্ঞাপন রূপান্তর ট্র্যাকিং | CRICFy_v7.4 (3)/classes.dex |
| 23 | MEDIUM | `https://www.hotstar.com/` | Disney+ Hotstar — কপিরাইটকৃত প্রিমিয়াম ক্রিকেট কনটেন্ট; অননুমোদিত স্ট্রিমিং হতে পারে (LEGAL RISK) | CRICFy_v7.4 (3)/classes.dex |
| 24 | LOW | `https://firebase.google.com/support/guides/disable-analytics` | Firebase সমর্থন পেজ — SDK-সংশ্লিষ্ট, সরাসরি ক্ষতি নয় | CRICFy_v7.4 (3)/classes.dex |
| 25 | LOW | `https://firebase.google.com/support/privacy/init-options` | Firebase সমর্থন পেজ — SDK-সংশ্লিষ্ট, সরাসরি ক্ষতি নয় | CRICFy_v7.4 (3)/classes.dex |
| 26 | LOW | `https://google.com/search` | hardcoded Google Search URL — অ্যাপের ভেতরে অস্বাভাবিক, কিন্তু ক্ষতিকর নয় | CRICFy_v7.4 (3)/classes.dex |
| 27 | LOW | `https://streams.videolan.org/upload/` | VLC মিডিয়া স্ট্রিম রেফারেন্স — ডকুমেন্টেশন/নমুনা | CRICFy_v7.4 (3)/lib/arm64-v8a/libffmpegJNI.so | CRICFy_v7.4 (3)/lib/armeabi-v7a/libffmpegJNI.so | CRICFy_v7.4 (3)/lib/x86/libffmpegJNI.so | CRICFy_v7.4 (3)/lib/x86_64/libffmpegJNI.so |

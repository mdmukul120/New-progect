# ⚠️ DANGER — CRICFy_v7.4.3.zip (সম্পূর্ণ রিপোর্ট)

> এটি স্বয়ংক্রিয় **স্ট্যাটিক বিশ্লেষণ** — চূড়ান্ত ম্যালওয়্যার/আইনি প্রমাণ নয়। ইনস্টল/ব্যবহারের আগে VirusTotal/Google Play Protect দিয়ে যাচাই করুন।

## সংক্ষেপ

- মূল ZIP: `CRICFy_v7.4.3.zip`
- SHA256: `b5a78589bc1d9cddb6542e2ee2e82b7daf8b408ffaac0db595e2b12f80ff2ed3`
- মোট ফাইল: **1501**, আনজিপ করা সাইজ: **40,312,264 bytes**
- মোট ফ্ল্যাগড: **50** (CRITICAL 5, HIGH 15, MEDIUM 30, LOW বাদে)
- সন্দেহজনক লিংক: **27**, অবৈধ/ভাঙা URL: **3**

## 🔴 CRITICAL — APK স্বাক্ষর নেই

- **META-INF-এ APK স্বাক্ষর নেই (MANIFEST.MF / *.SF / *.RSA অনুপস্থিত) — অ্যাপটি স্বাক্ষরবিহীন বা স্বাক্ষর কেটে দেওয়া হয়েছে; Play-স্টোর বিল্ড নয়, ডেভেলপার কর্তৃক রিপ্যাক/মডিফাই করা সন্দেহ**
- শনাক্ত signature ফাইল: কোনোটিই নেই

## সন্দেহজনক লিংক (সারাংশ)

- **[HIGH]** `https://cfygsjsgdj141.top/` — র‍্যান্ডম-দেখানো .top ডোমেইন — স্ট্যান্ডার্ড API নয়, সন্দেহজনক C2/কনফিগ হোস্ট
- **[HIGH]** `https://dokoplay.xyz` — অজানা ডোমেইনে server_lookup.php?channel_id=premium — প্রিমিয়াম স্ট্রিম সোর্স খোঁজার endpoint, অবৈধ স্ট্রিমিং সন্দেহ
- **[HIGH]** `https://dokoplay.xyz/server_lookup.php?channel_id=premium` — অজানা ডোমেইনে server_lookup.php?channel_id=premium — প্রিমিয়াম স্ট্রিম সোর্স খোঁজার endpoint, অবৈধ স্ট্রিমিং সন্দেহ
- **[HIGH]** `https://newembedplay.xyz` — অজানা .xyz ডোমেইন — এম্বেড প্লেয়ার/স্ট্রিম হোস্ট সন্দেহ
- **[HIGH]** `https://pscp.tv` — অজানা ভিডিও হোস্ট — কনটেন্ট উৎস যাচাই করা অসম্ভব
- **[HIGH]** `https://pub-9610baca6bf84734bf9d40546dc754a6.r2.dev/config.txt` — ক্লাউডফ্লেয়ার R2-তে হোস্ট করা রিমোট কনফিগ (config.txt) — অ্যাপ চালু হলে ডাউনলোড হয়; RCE/রিডাইরেক্ট প্রক্সি হতে পারে
- **[HIGH]** `https://rtstv.xyz` — অজানা .xyz ডোমেইন — সন্দেহজনক কনটেন্ট/স্ট্রিম হোস্ট
- **[MEDIUM]** `https://app-measurement.com/a` — Google Analytics/Firebase App Measurement — বিশ্লেষণ ট্র্যাকিং
- **[MEDIUM]** `https://app-measurement.com/s/d` — Google Analytics/Firebase App Measurement — বিশ্লেষণ ট্র্যাকিং
- **[MEDIUM]** `https://cashraven.io/legal/eula` — CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে
- **[MEDIUM]** `https://cashraven.io/legal/privacy` — CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে
- **[MEDIUM]** `https://cashraven.io/legal/terms-of-use` — CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে
- **[MEDIUM]** `https://developers.cashraven.io` — CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে
- **[MEDIUM]** `https://fcmregistrations.googleapis.com/v1/projects/` — Firebase Cloud Messaging registration — পুশ টোকেন নিবন্ধন
- **[MEDIUM]** `https://firebaseinstallations.googleapis.com/v1/` — Firebase Installations — ডিভাইস/ইনস্ট্যান্স আইডি নিবন্ধন ও ট্র্যাকিং
- **[MEDIUM]** `https://firebaseremoteconfig.googleapis.com/v1/projects/` — Firebase Remote Config — সার্ভার থেকে অ্যাপ আচরণ (URL/পতাকা) পরিবর্তনযোগ্য; হাইজ্যাকিং ঝুঁকি
- **[MEDIUM]** `https://firebaseremoteconfigrealtime.googleapis.com/v1/projects/` — Firebase Remote Config Realtime — রিয়েলটাইম সার্ভার কনফিগ
- **[MEDIUM]** `https://gateway.unityads.unity3d.com/v1` — Unity Ads গেটওয়ে — বিজ্ঞাপন সিস্টেম, ডিভাইস ID ও ইউসেজ ডেটা আদান-প্রদান করে
- **[MEDIUM]** `https://pagead2.googlesyndication.com/pagead/gen_204?id=gmob-apps` — Google AdSense/Google syndication — বিজ্ঞাপন পরিবেশনা + ট্র্যাকিং
- **[MEDIUM]** `https://vk.com` — Vkontakte (vk.com) — রুশ সোশ্যাল/ভিডিও; অননুমোদিত ভিডিও এম্বেড উৎস হতে পারে
- **[MEDIUM]** `https://www.cricbuzz.com/` — Cricbuzz — কপিরাইটকৃত ক্রিকেট কনটেন্ট; অ্যাপে ব্যবহার অননুমোদিত স্ট্রিমিং হতে পারে
- **[MEDIUM]** `https://www.googleadservices.com/pagead/conversion/app/deeplink?id_type=adid&sdk_version=` — Google Ads conversion/deeplink — বিজ্ঞাপন রূপান্তর ট্র্যাকিং
- **[MEDIUM]** `https://www.hotstar.com/` — Disney+ Hotstar — কপিরাইটকৃত প্রিমিয়াম ক্রিকেট কনটেন্ট; অননুমোদিত স্ট্রিমিং হতে পারে (LEGAL RISK)
- **[LOW]** `https://firebase.google.com/support/guides/disable-analytics` — Firebase সমর্থন পেজ — SDK-সংশ্লিষ্ট, সরাসরি ক্ষতি নয়
- **[LOW]** `https://firebase.google.com/support/privacy/init-options` — Firebase সমর্থন পেজ — SDK-সংশ্লিষ্ট, সরাসরি ক্ষতি নয়
- **[LOW]** `https://google.com/search` — hardcoded Google Search URL — অ্যাপের ভেতরে অস্বাভাবিক, কিন্তু ক্ষতিকর নয়
- **[LOW]** `https://streams.videolan.org/upload/` — VLC মিডিয়া স্ট্রিম রেফারেন্স — ডকুমেন্টেশন/নমুনা

## অবৈধ/ভাঙা URL

- `https://cashraven.io/legal/eulacreatecr_androidcreate_brandedcreate_headlesscreate_with_brandingversionapp_idapply_consent_configauth_stateauth_statusautostart_enabledautostart_supportedbattery` — বাইনারি string-pool সাইড-বা-সাইড concat — 'eula' এর সাথে SDK মেথড নাম লেগে গেছে
- `https://default.url` — প্লেসহোল্ডার হোস্ট 'default.url' — বাইনারির ডিফল্ট ভ্যালু, আসল URL নয়
- `https://docs.rs/getrandom#nodejs-es-module-supportErrorinternal_codedescriptionunknown_code` — ডক্স URL এর সাথে error payload concatenated — কার্যকরী লিংক নয়

## AndroidManifest.xml — শনাক্ত পারমিশন

- `android.permission.A`
- `android.permission.ACCESS_ADSERVICES_AD_ID`
- `android.permission.ACCESS_ADSERVICES_ATTRIBUTION`
- `android.permission.ACCESS_ADSERVICES_TOPICS`
- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.ACCESS_WIFI_STATE`
- `android.permission.BIND_JOB_SERVICE`
- `android.permission.BLUETOOTH`
- `android.permission.BLUETOOTH_PRIVILEGED`
- `android.permission.DUMP`
- `android.permission.FOREGROUND_SERVICE` ⚠️
- `android.permission.FOREGROUND_SERVICE_DATA_SYNC`
- `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- `android.permission.INTERNET`
- `android.permission.POST_NOTIFICATIONS` ⚠️
- `android.permission.QUERY_ALL_PACKAGES` ⚠️
- `android.permission.RECEIVE_BOOT_COMPLETED` ⚠️
- `android.permission.REQUEST_DELETE_PACKAGES`
- `android.permission.REQUEST_INSTALL_PACKAGES` ⚠️
- `android.permission.SYSTEM_ALERT_WINDOW` ⚠️
- `android.permission.WAKE_LOCK` ⚠️

## ফ্ল্যাগড ফাইল (সারাংশ)

- **[HIGH]** `CRICFy_v7.4 (3)/classes.dex` (10,115,456 B) — অবাধা bytecode — মিনিফাই/অবফাসকেটেড অ্যাপ কোড; আচরণ যাচাই ছাড়া ভরসা করা যায় না
- **[HIGH]** `CRICFy_v7.4 (3)/classes2.dex` (3,143,576 B) — অবাধা bytecode — মিনিফাই/অবফাসকেটেড অ্যাপ কোড; আচরণ যাচাই ছাড়া ভরসা করা যায় না
- **[HIGH]** `CRICFy_v7.4 (3)/lib/arm64-v8a/libnative-lib.so` (919,992 B) — ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব
- **[HIGH]** `CRICFy_v7.4 (3)/lib/armeabi-v7a/libnative-lib.so` (597,832 B) — ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব
- **[HIGH]** `CRICFy_v7.4 (3)/lib/x86/libnative-lib.so` (826,652 B) — ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব
- **[HIGH]** `CRICFy_v7.4 (3)/lib/x86_64/libnative-lib.so` (904,144 B) — ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব
- **[MEDIUM]** `CRICFy_v7.4 (3)/AndroidManifest.xml` (49,724 B) — পারমিশন তালিকা যাচাই করুন (নীচে দেখুন)
- **[MEDIUM]** `CRICFy_v7.4 (3)/assets/ad-viewer/omid-session-client-v1.js` (68,100 B) — IAB Open Measurement (OMID/OM) জাভাস্ক্রিপ্ট — বিজ্ঞাপন ইম্প্রেশন যাচাই/ট্র্যাকিং
- **[MEDIUM]** `CRICFy_v7.4 (3)/assets/ad-viewer/omsdk-v1.js` (43,924 B) — IAB Open Measurement (OMID/OM) জাভাস্ক্রিপ্ট — বিজ্ঞাপন ইম্প্রেশন যাচাই/ট্র্যাকিং
- **[MEDIUM]** `CRICFy_v7.4 (3)/assets/adi-registration.properties` (27 B) — Ad Identification (ADI) রেজিস্ট্রেশন আইডি — বিজ্ঞাপন অ্যাট্রিবিউশন; ডিভাইস-স্তরের ট্র্যাকিং
- **[MEDIUM]** `CRICFy_v7.4 (3)/dk/dk.json` (9,508 B) — অজ্ঞাত বৃহৎ JSON ডিকশনারি (p=166 KB, dk=9.5 KB) — অবফাসকেটেড কনফিগ/ডেটা হতে পারে
- **[MEDIUM]** `CRICFy_v7.4 (3)/lib/arm64-v8a/libcr_android.so` (1,753,336 B) — বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই
- **[MEDIUM]** `CRICFy_v7.4 (3)/lib/arm64-v8a/libunitycoherencenative.so` (514,424 B) — বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই
- **[MEDIUM]** `CRICFy_v7.4 (3)/lib/armeabi-v7a/libcr_android.so` (1,287,144 B) — বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই
- **[MEDIUM]** `CRICFy_v7.4 (3)/lib/armeabi-v7a/libunitycoherencenative.so` (368,308 B) — বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই
- **[MEDIUM]** `CRICFy_v7.4 (3)/lib/x86/libunitycoherencenative.so` (542,920 B) — বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই
- **[MEDIUM]** `CRICFy_v7.4 (3)/lib/x86_64/libcr_android.so` (1,934,880 B) — বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই
- **[MEDIUM]** `CRICFy_v7.4 (3)/lib/x86_64/libunitycoherencenative.so` (544,240 B) — বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই
- **[MEDIUM]** `CRICFy_v7.4 (3)/p/p.json` (166,490 B) — অজ্ঞাত বৃহৎ JSON ডিকশনারি (p=166 KB, dk=9.5 KB) — অবফাসকেটেড কনফিগ/ডেটা হতে পারে
- **[LOW]** `CRICFy_v7.4 (3)/META-INF/AL2.0` (10,174 B) — অপ্রচলিত extension — অরফ্যান/ভাঙা ফাইল হতে পারে
- **[LOW]** `CRICFy_v7.4 (3)/META-INF/LGPL2.1` (24,389 B) — অপ্রচলিত extension — অরফ্যান/ভাঙা ফাইল হতে পারে
- **[LOW]** `CRICFy_v7.4 (3)/lib/arm64-v8a/libandroidx.graphics.path.so` (10,096 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/arm64-v8a/libdatastore_shared_counter.so` (7,112 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/arm64-v8a/libdav1dJNI.so` (1,094,800 B) — মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়
- **[LOW]** `CRICFy_v7.4 (3)/lib/arm64-v8a/libffmpegJNI.so` (1,718,968 B) — মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়
- **[LOW]** `CRICFy_v7.4 (3)/lib/arm64-v8a/libjnidispatch.so` (157,720 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/armeabi-v7a/libandroidx.graphics.path.so` (7,252 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/armeabi-v7a/libdatastore_shared_counter.so` (4,416 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/armeabi-v7a/libdav1dJNI.so` (914,236 B) — মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়
- **[LOW]** `CRICFy_v7.4 (3)/lib/armeabi-v7a/libffmpegJNI.so` (1,590,096 B) — মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়
- **[LOW]** `CRICFy_v7.4 (3)/lib/armeabi-v7a/libjnidispatch.so` (112,188 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/armeabi/libjnidispatch.so` (122,784 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/mips/libjnidispatch.so` (150,924 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/mips64/libjnidispatch.so` (141,904 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86/libandroidx.graphics.path.so` (9,284 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86/libdatastore_shared_counter.so` (5,148 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86/libdav1dJNI.so` (1,301,180 B) — মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86/libffmpegJNI.so` (1,735,972 B) — মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86/libjnidispatch.so` (112,108 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86_64/libandroidx.graphics.path.so` (10,760 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86_64/libdatastore_shared_counter.so` (6,224 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86_64/libdav1dJNI.so` (1,982,888 B) — মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86_64/libffmpegJNI.so` (1,838,240 B) — মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়
- **[LOW]** `CRICFy_v7.4 (3)/lib/x86_64/libjnidispatch.so` (108,632 B) — Native library — সোর্স ছাড়া আচরণ অজানা
- **[LOW]** `CRICFy_v7.4 (3)/resources.arsc` (1,867,244 B) — কম্পাইল করা রিসোর্স টেবিল — কনটেন্ট যাচাই ছাড়া আইডেন্টিফাই করা যায় না

## সুপারিশ

1. এই APK কাউকে ইন্সটল/শেয়ার করবেন না।
2. অজানা ডোমেইন (`dokoplay.xyz`, `cfygsjsgdj141.top`, `rtstv.xyz`, `newembedplay.xyz`, `pscp.tv`) এবং `pub-...r2.dev/config.txt` ব্লক করুন।
3. সংশয়: Hotstar/Cricbuzz সরাসরি লিংকের অর্থ অননুমোদিত স্ট্রিমিং হতে পারে — আইনি ঝুঁকি।
4. CashRaven/UnityAds/Firebase — ব্যক্তিগত ডেটা সংগ্রহ; ব্যবহারকারীকে অজানা।
5. স্বাক্ষরবিহীন/রিপ্যাকড APK — Play Store-এ নেই, Play Protect স্ক্যান করুন।

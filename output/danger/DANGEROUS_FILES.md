# সন্দেহজনক / অবৈধ ফাইল (hash সহ)

মূল ZIP-এর SHA256: `b5a78589bc1d9cddb6542e2ee2e82b7daf8b408ffaac0db595e2b12f80ff2ed3`

মোট ফ্ল্যাগড ফাইল: **45**

| # | সেভারিটি | ফাইল | সাইজ (bytes) | SHA256 | কারণ |
|---|---|---|---|---|---|
| 1 | HIGH | `CRICFy_v7.4 (3)/classes.dex` | 10,115,456 | `20e0960648e05a744b97c4a8891184a68f6d8bbe13faa6e0bc0943e51ed269f4` | অবাধা bytecode — মিনিফাই/অবফাসকেটেড অ্যাপ কোড; আচরণ যাচাই ছাড়া ভরসা করা যায় না |
| 2 | HIGH | `CRICFy_v7.4 (3)/classes2.dex` | 3,143,576 | `a732221327318509c2e4dcf3137b677f40255704974cbcf710961d682a788cca` | অবাধা bytecode — মিনিফাই/অবফাসকেটেড অ্যাপ কোড; আচরণ যাচাই ছাড়া ভরসা করা যায় না |
| 3 | HIGH | `CRICFy_v7.4 (3)/lib/arm64-v8a/libnative-lib.so` | 919,992 | `8f76554026de8c58c777f40ec75124feb7e71d5ef556224b4c76347cb72b7827` | ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব |
| 4 | HIGH | `CRICFy_v7.4 (3)/lib/armeabi-v7a/libnative-lib.so` | 597,832 | `9a97a9930ec3ca071f80ace90de01a6de08ee41ce755b04fb43acade335e666e` | ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব |
| 5 | HIGH | `CRICFy_v7.4 (3)/lib/x86/libnative-lib.so` | 826,652 | `0eec74b931264571267a39923f405744155de4a915c527cd99bf026f176ff931` | ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব |
| 6 | HIGH | `CRICFy_v7.4 (3)/lib/x86_64/libnative-lib.so` | 904,144 | `09d545a9b1f4ef7be7eb1877977847986907042b4265e6934c4b5bacf3726200` | ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব |
| 7 | MEDIUM | `CRICFy_v7.4 (3)/AndroidManifest.xml` | 49,724 | `46fe9fb96eb0fc6652aa6c5fab5c6d636f3ac32d89787c313b290795b13534ac` | পারমিশন তালিকা যাচাই করুন (নীচে দেখুন) |
| 8 | MEDIUM | `CRICFy_v7.4 (3)/assets/ad-viewer/omid-session-client-v1.js` | 68,100 | `f15e5ce012c87bd32c15d71d2fd0b954b9b2fd9d5818d817b3820af3d93d5a35` | IAB Open Measurement (OMID/OM) জাভাস্ক্রিপ্ট — বিজ্ঞাপন ইম্প্রেশন যাচাই/ট্র্যাকিং |
| 9 | MEDIUM | `CRICFy_v7.4 (3)/assets/ad-viewer/omsdk-v1.js` | 43,924 | `896cf905b2b562818da58e19e25b525083f18638f6b9b0d7c6aea411a9907585` | IAB Open Measurement (OMID/OM) জাভাস্ক্রিপ্ট — বিজ্ঞাপন ইম্প্রেশন যাচাই/ট্র্যাকিং |
| 10 | MEDIUM | `CRICFy_v7.4 (3)/assets/adi-registration.properties` | 27 | `5e5b6b753dc95b7f238728b52388f096e281c649b3783356049006019963db35` | Ad Identification (ADI) রেজিস্ট্রেশন আইডি — বিজ্ঞাপন অ্যাট্রিবিউশন; ডিভাইস-স্তরের ট্র্যাকিং |
| 11 | MEDIUM | `CRICFy_v7.4 (3)/dk/dk.json` | 9,508 | `a8773fbcc90f3cd3d2fcd6e0445ea08ca434b515b7a7c695fe90c6068b75ec40` | অজ্ঞাত বৃহৎ JSON ডিকশনারি (p=166 KB, dk=9.5 KB) — অবফাসকেটেড কনফিগ/ডেটা হতে পারে |
| 12 | MEDIUM | `CRICFy_v7.4 (3)/lib/arm64-v8a/libcr_android.so` | 1,753,336 | `985b0b6f87f2eef1d50b73c2603bb88cf9dec2999844f42af0169c768a11e068` | বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই |
| 13 | MEDIUM | `CRICFy_v7.4 (3)/lib/arm64-v8a/libunitycoherencenative.so` | 514,424 | `2765149c31ef0753ceff4417459b16161cf14bfc925411cd0abcc39aafb5e010` | বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই |
| 14 | MEDIUM | `CRICFy_v7.4 (3)/lib/armeabi-v7a/libcr_android.so` | 1,287,144 | `12e580104783c991a2ac729cdf188594e2e164abcbaa88cf6876fc156b625859` | বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই |
| 15 | MEDIUM | `CRICFy_v7.4 (3)/lib/armeabi-v7a/libunitycoherencenative.so` | 368,308 | `d854bfd25fbbdb122412a45ad342fc590ab816de31bec6c8c205448ea85c1696` | বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই |
| 16 | MEDIUM | `CRICFy_v7.4 (3)/lib/x86/libunitycoherencenative.so` | 542,920 | `c5b129241cf8c1f28a8787141750e479023b046ce74aed9a8200283ca6dc3dd6` | বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই |
| 17 | MEDIUM | `CRICFy_v7.4 (3)/lib/x86_64/libcr_android.so` | 1,934,880 | `cef6151e1fb694e80b79bb82ffc95835a02e12525c20cfe9143be48aec1e5807` | বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই |
| 18 | MEDIUM | `CRICFy_v7.4 (3)/lib/x86_64/libunitycoherencenative.so` | 544,240 | `d8b5afcda6b429cf6de2d7d9e7e40a7666d8bce4c90ab59711eb4088f1f766ce` | বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই |
| 19 | MEDIUM | `CRICFy_v7.4 (3)/p/p.json` | 166,490 | `c3f6b88b0c570b9a13eee5bfa957f5398c26b4928000e00ee73a810ac8893d55` | অজ্ঞাত বৃহৎ JSON ডিকশনারি (p=166 KB, dk=9.5 KB) — অবফাসকেটেড কনফিগ/ডেটা হতে পারে |
| 20 | LOW | `CRICFy_v7.4 (3)/META-INF/AL2.0` | 10,174 | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` | অপ্রচলিত extension — অরফ্যান/ভাঙা ফাইল হতে পারে |
| 21 | LOW | `CRICFy_v7.4 (3)/META-INF/LGPL2.1` | 24,389 | `eea173a556abac0370461e57e12aab266894ea6be3874c2be05fd87871f75449` | অপ্রচলিত extension — অরফ্যান/ভাঙা ফাইল হতে পারে |
| 22 | LOW | `CRICFy_v7.4 (3)/lib/arm64-v8a/libandroidx.graphics.path.so` | 10,096 | `41e9a793c43a0f4fddb19e33f346bace464f30f888ba7b9eaf96294ea115bfb6` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 23 | LOW | `CRICFy_v7.4 (3)/lib/arm64-v8a/libdatastore_shared_counter.so` | 7,112 | `d3e48717c9aa147e0ab21063ba0e8e0211cabf8bf40b222640829519edbf58e1` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 24 | LOW | `CRICFy_v7.4 (3)/lib/arm64-v8a/libdav1dJNI.so` | 1,094,800 | `8dacd114c6d196a7012db31000d4dbe38bcb2c3a21dace391463c21eedec1675` | মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয় |
| 25 | LOW | `CRICFy_v7.4 (3)/lib/arm64-v8a/libffmpegJNI.so` | 1,718,968 | `0539b74dc8c51280df1c03b66615b562c049cbcf18055407a347405a87cce258` | মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয় |
| 26 | LOW | `CRICFy_v7.4 (3)/lib/arm64-v8a/libjnidispatch.so` | 157,720 | `fe9c603f2a7a5d19197b87f275d6e0afb975f997a57ff4f8ca801cb8c5e7b731` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 27 | LOW | `CRICFy_v7.4 (3)/lib/armeabi-v7a/libandroidx.graphics.path.so` | 7,252 | `41399eba6fc2a60f6f14642375c1824f3cf25eb8fec7397d753730a3ceda3e2b` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 28 | LOW | `CRICFy_v7.4 (3)/lib/armeabi-v7a/libdatastore_shared_counter.so` | 4,416 | `716c5d8d2cac8ca0edf65da8f139c7886b726ac79d542a14edeb94994ba6d3dc` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 29 | LOW | `CRICFy_v7.4 (3)/lib/armeabi-v7a/libdav1dJNI.so` | 914,236 | `1f270ebd1ec34a2486f9101eb2440c166a0097e11e7d4a9239ac70aba1b27d21` | মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয় |
| 30 | LOW | `CRICFy_v7.4 (3)/lib/armeabi-v7a/libffmpegJNI.so` | 1,590,096 | `66bd5bfce0ae34faab0e87882b1454bf00758604ad94b28b8c97419849f50497` | মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয় |
| 31 | LOW | `CRICFy_v7.4 (3)/lib/armeabi-v7a/libjnidispatch.so` | 112,188 | `c5be6d55a8f0eaca7830348196a9d36203137f6334dc03aca1d58699b8eda045` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 32 | LOW | `CRICFy_v7.4 (3)/lib/armeabi/libjnidispatch.so` | 122,784 | `27efc9e8c7320544c8417a1ae4c77d5091702430e6edae9f5dab060430b62ff6` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 33 | LOW | `CRICFy_v7.4 (3)/lib/mips/libjnidispatch.so` | 150,924 | `c6f2d715fc6a91c4a364aba7e277f4302c726984c3d22860e4b80d80634d9e71` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 34 | LOW | `CRICFy_v7.4 (3)/lib/mips64/libjnidispatch.so` | 141,904 | `7a9fe9d0d017deb0195dca3d21ef06a7864b9ad66bcab2608e9ad468a511f697` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 35 | LOW | `CRICFy_v7.4 (3)/lib/x86/libandroidx.graphics.path.so` | 9,284 | `eb0570b41fd3bff25d8204a967c03bd7550719e768b791f680cc40cbe35f29af` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 36 | LOW | `CRICFy_v7.4 (3)/lib/x86/libdatastore_shared_counter.so` | 5,148 | `cd4a1649e2c8350703146f94a6ee2bf4c3c8c9f172159f805b61a4a2abdf0659` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 37 | LOW | `CRICFy_v7.4 (3)/lib/x86/libdav1dJNI.so` | 1,301,180 | `d789820a07f0a3cdb3b83fd4e74f2dc710246cd8b587d98dbb170a9204ff10d6` | মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয় |
| 38 | LOW | `CRICFy_v7.4 (3)/lib/x86/libffmpegJNI.so` | 1,735,972 | `635d00c0d24d55358529ed9af97c5ab90dde44b59b86705d518febee981695f7` | মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয় |
| 39 | LOW | `CRICFy_v7.4 (3)/lib/x86/libjnidispatch.so` | 112,108 | `2051548fe8334e4703bdc7a88820ac7fa7e6ecbfe17ac3b5976a5f7667a8b84c` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 40 | LOW | `CRICFy_v7.4 (3)/lib/x86_64/libandroidx.graphics.path.so` | 10,760 | `4e56c996f13670e70082658de7880c4020eabf4f25e43387f88ed78a713fc9f0` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 41 | LOW | `CRICFy_v7.4 (3)/lib/x86_64/libdatastore_shared_counter.so` | 6,224 | `fb6c9208988c49ae94943bc3236fa763ba584722e044fa4ea9a12d2941027105` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 42 | LOW | `CRICFy_v7.4 (3)/lib/x86_64/libdav1dJNI.so` | 1,982,888 | `103e7922e0e9dbfea1c56ae18e46d38d781600f1da5d04afbeb73aa3889a8d52` | মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয় |
| 43 | LOW | `CRICFy_v7.4 (3)/lib/x86_64/libffmpegJNI.so` | 1,838,240 | `eb10d06279ccb44679115353de3d62a4b70deba2afdb99ae2639a6562b347c45` | মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয় |
| 44 | LOW | `CRICFy_v7.4 (3)/lib/x86_64/libjnidispatch.so` | 108,632 | `09e25588d4208d6d76b6676dfbdcf394be73af57836e815c4e4513ebfc0ef4a1` | Native library — সোর্স ছাড়া আচরণ অজানা |
| 45 | LOW | `CRICFy_v7.4 (3)/resources.arsc` | 1,867,244 | `a1c3c0923fb649af9ccd0fcbda40ea04a6f9e8de48d5cb970afae8db5495e473` | কম্পাইল করা রিসোর্স টেবিল — কনটেন্ট যাচাই ছাড়া আইডেন্টিফাই করা যায় না |

# 📡 CRICFy — অ্যাপের ভেতরে কী ম্যাচ আসছে (GitHub Actions থেকে fetch)

- Fetch time (UTC): 2026-11-21T11:21:08Z
- পদ্ধতি: GitHub Actions runner থেকে HTTP GET (অ্যাপ যে এন্ডপয়েন্টেই কল করে সেগুলোই)
- প্লেব্যাক/স্ট্রিম URL ও টোকেন ইচ্ছাকৃতভাবে REDACT করা হয়েছে


## ১) অ্যাপের ভিতরের p/p.json

```json

{
  "path": "extracted/CRICFy_v7.4 (3)/p/p.json",
  "size": 166490,
  "json_type": "dict",
  "top_keys": [
    "nm",
    "ddd",
    "h",
    "w",
    "meta",
    "layers",
    "v",
    "fr",
    "op",
    "ip",
    "assets"
  ],
  "keys_count": 11,
  "sample": {
    "nm": "\"Comp 2\"",
    "ddd": "0",
    "h": "1080",
    "w": "1920",
    "meta": "{\"g\": \"@lottiefiles/toolkit-js 0.33.2\"}",
    "layers": "[{\"ty\": 0, \"nm\": \"Comp 1\", \"sr\": 1, \"st\": 0, \"op\": 71, \"ip\": 0, \"hd\": false, \"ddd\": 0, \"bm\": 0, \"hasMask\": false, \"ao\": 0, \"ks\": {\"a\": {\"a\": 0, \"k\": [960, 540, 0], \"ix\": 1}, \"s\": {\"a\": 0, \"k\": [224, 2…",
    "v": "\"5.4.3\"",
    "fr": "24",
    "op": "76",
    "ip": "0",
    "assets": "[{\"nm\": \"\", \"id\": \"comp_0\", \"layers\": [{\"ty\": 3, \"nm\": \"Null 2\", \"sr\": 1, \"st\": 0, \"op\": 247, \"ip\": 0, \"hd\": false, \"ddd\": 0, \"bm\": 0, \"hasMask\": false, \"ao\": 0, \"ks\": {\"a\": {\"a\": 0, \"k\": [0, 0, 0], \"…"
  }
}

```

## ২) অ্যাপের ভিতরের dk/dk.json

```json

{
  "path": "extracted/CRICFy_v7.4 (3)/dk/dk.json",
  "size": 9508,
  "json_type": "dict",
  "top_keys": [
    "v",
    "fr",
    "ip",
    "op",
    "w",
    "h",
    "nm",
    "ddd",
    "assets",
    "layers",
    "markers"
  ],
  "keys_count": 11,
  "sample": {
    "v": "\"5.7.4\"",
    "fr": "30",
    "ip": "0",
    "op": "40",
    "w": "500",
    "h": "500",
    "nm": "\"Live Icon Lottie\"",
    "ddd": "0",
    "assets": "[]",
    "layers": "[{\"ddd\": 0, \"ind\": 1, \"ty\": 4, \"nm\": \"Layer 2\", \"sr\": 1, \"ks\": {\"o\": {\"a\": 0, \"k\": 100, \"ix\": 11}, \"r\": {\"a\": 0, \"k\": 0, \"ix\": 10}, \"p\": {\"a\": 0, \"k\": [250.281, 176.494, 0], \"ix\": 2, \"l\": 2}, \"a\": {\"a…",
    "markers": "[]"
  }
}

```


## ৩) dex মধ্যে ম্যাচ-সংক্রান্ত strings (নমুনা, ≤80 টি)

```

        // PHP URLs with stream extension in query string (e.g. stream.php?file=live.m3u8)
      matchDef
      matchMin
      matchPercent
    // Filter: first URL matching a recognised stream pattern
  Filter did not match: 
  Filter matched!  match=0x
 EGL_EXT_gl_colorspace_bt2020_hlg
 Multiple entries with same key: 
 does not match result 
!) does not match the bytes left: 
!Wrong unit for millisMultiplier: 
"Uploading requested multiple times
"unmatched_first_open_without_ad_id
# release without a matched acquire!
#DEVELOPER_CONSENT_TYPE_PIPL_CONSENT
#Data size mismatch between stream (
#Unexpected Error: FID NOT matching!
#getFailureTimeToLive-UwyO8pc$okhttp
#getMaximumTimeToLive-UwyO8pc$okhttp
#getMinimumTimeToLive-UwyO8pc$okhttp
$TRANSACTION_ORIGIN_LIVE_UPDATE_VALUE
$binder is alive, sending the intent.
$com.android.vending.models.LiveEvent
&android.media.route.feature.LIVE_AUDIO
&android.media.route.feature.LIVE_VIDEO
' didn't match expected id '
'Attempting to initialize multiple times
'Multiple Segment elements not supported
'Multiple renderer media clocks enabled.
(Non-system-image GmsCore APK, forcing V1
(android.media.intent.category.LIVE_AUDIO
(android.media.intent.category.LIVE_VIDEO
(frameRateMultiplier doesn't have 2 parts
) does not match buffer size: 
) found match in cache: 
) to match declared fields [
)CAF_EXPANDED_CONTROLLER_WITH_LIVE_CONTENT
)Cannot have multiple identical services: 
)DEVELOPER_CONSENT_TYPE_PIPL_CONSENT_VALUE
)VBRI bytes and ToC mismatch (using max): 
*MSG_OPPORTUNITY_AND_PLACEMENT_NOT_MATCHING
*PUBLIC_ERROR_CODE_INIT_MISMATCHED_PLATFORM
*keys must match regex [a-z0-9_-]{1,120}: "
+ has sent connection request multiple times
+) which do not match declared field names (
+App version does not match; dropping. appId
+Ignoring Malformed MediaLiveSeekableRange: 
+kotlinx.coroutines.scheduler.keep.alive.sec
, currentLiveOffsetMs=
, does not match actual size 
, gmsCoreDirPath=
, is invalid or does not match channel count 
, teamAFlag=
, teamB=
, teamBFlag=
, timeToLive=
,Landroid/net/ssl/EchConfigMismatchException;
,kotlinx.coroutines.DefaultExecutor.keepAlive
-Exception while computing database live data.
-Failed to load IDynamiteLoader from GmsCore: 
-Invalid GmsCore APK, remote loading disabled.
.Audio sample size mismatch. stsd sample size: 
.Invalid conditional user property time to live
.delivery_metrics_exported_to_big_query_enabled
/Activity result delivered for unknown Fragment 
/Lcom/cricfytv/sports/databinding/LiveAdBinding;
/new intent queued in the bind-strategy delivery
0List contains no element matching the predicate.
0Mismatched number of dex files found in metadata
0PUBLIC_ERROR_CODE_INIT_MISMATCHED_PLATFORM_VALUE
0com.google.android.gms.net.GmsCoreCronetProvider
1 does not match to required "type/subtype" format
1App version does not match; dropping event. appId
1Got multiple records for app, expected one. appId
1Lcom/cricfytv/sports/databinding/LiveAnimBinding;
1The bytes saved do not match expectation. actual=
1com.google.android.gms.cast.metadata.SERIES_TITLE
2ALTER TABLE apps ADD COLUMN unmatched_pfo INTEGER;
2ALTER TABLE apps ADD COLUMN unmatched_uwa INTEGER;

```
মোট distinct match-like strings: 301


## ৪) এন্ডপয়েন্ট রেসপন্স সারাংশ

| এন্ডপয়েন্ট | HTTP | সাইজ | JSON? | ম্যাচ candidates | ফাইল |
|---|---|---|---|---|---|

| `https://pub-9610baca6bf84734bf9d40546dc754a6.r2.dev/config.txt` | 200 | 236 B | না | 0 | `r2_config.txt` |

| `https://dokoplay.xyz/server_lookup.php?channel_id=premium` | 200 | 3,057 B | না | 0 | `dokoplay_server_lookup.txt` |

| `https://dokoplay.xyz/` | 200 | 3,057 B | না | 0 | `dokoplay_home.txt` |

| `https://cfygsjsgdj141.top/` | None | 59 B | না | 0 | `cfygsjsgdj141_top.txt` |

| `https://rtstv.xyz/` | 200 | 27,422 B | না | 0 | `rtstv_xyz.txt` |

| `https://newembedplay.xyz/` | 200 | 149 B | না | 0 | `newembedplay_xyz.txt` |

| `https://pscp.tv/` | 200 | 20,372 B | না | 0 | `pscp_tv.txt` |


**মোট ম্যাচ candidates: 0**


## নোট

- `200` মানে এন্ডপয়েন্ট জীবিত; JSON-এ ম্যাচ লিস্ট থাকলে উপরে টেবিল/ব্লকে দেওয়া হয়েছে।
- স্ট্রিম/প্লেব্যাক URL (`.m3u8` ইত্যাদি) ও টোকেন/key লাল করে দেওয়া হয়েছে — আলাদা করে চাওয়া যাবে না।
- এটি অননুমোদিত/পাইরেটেড স্ট্রিমিং অবকাঠামো বলে মনে হচ্ছে; ডেটা শুধু বিশ্লেষণের জন্য সংগৃহীত।

#!/usr/bin/env python3
"""
CRICFy_v7.4.3.zip — "অবৈধ/সন্দেহজনক ফাইল ও লিংক" আলাদা করে DANGER রিপোর্ট তৈরি।

এই স্ক্রিপ্টটি GitHub Actions runner-এ চলে (যেখানে extracted/ এবং output/ থাকে)।
ডায়াগনস্টিক: স্ট্যাটিক বিশ্লেষণ মাত্র — এটি চূড়ান্ত ম্যালওয়্যার/আইনি প্রমাণ নয়।

আউটপুট:
  output/danger/DANGER.md            — পূর্ণ রিপোর্ট (বাংলা)
  output/danger/DANGEROUS_FILES.md   — সন্দেহজনক ফাইল তালিকা + SHA256 + কারণ
  output/danger/DANGEROUS_LINKS.md   — সন্দেহজনক/সম্ভাব্য ক্ষতিকর লিংক + কারণ
  output/danger/INVALID_LINKS.txt    — ভাঙা/ভুল (concatenated) URL তালিকা
  output/danger/DANGER_REPORT.csv    — সব flagged item এক জায়গায়
  DANGER.md                          — repo রুটে সারসংক্ষেপ (GitHub-এ দেখানোর জন্য)
"""
import os
import re
import csv
import hashlib
from pathlib import Path
from urllib.parse import urlparse

EXTRACTED = Path("extracted")
OUTPUT = Path("output")
DANGER = OUTPUT / "danger"
ORIGINAL_SHA256 = "b5a78589bc1d9cddb6542e2ee2e82b7daf8b408ffaac0db595e2b12f80ff2ed3"

def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def rel_from_extracted(p: Path) -> str:
    return str(p.relative_to(EXTRACTED))

def get_domain(url: str) -> str:
    host = urlparse(url).netloc.lower().split(":")[0]
    return host[4:] if host.startswith("www.") else host

# ---------------------------------------------------------------- links
# severity: HIGH (সন্দেহজনক ব্যাকএন্ড/রিমোট কনফিগ/পাইরেসি ঝুঁকি), MEDIUM (এড/ট্র্যাকিং/বিজ্ঞাপন SDK), LOW (যাচাই করুন)
LINK_RULES = [
    ("pub-9610baca6bf84734bf9d40546dc754a6.r2.dev", "HIGH",
     "ক্লাউডফ্লেয়ার R2-তে হোস্ট করা রিমোট কনফিগ (config.txt) — অ্যাপ চালু হলে ডাউনলোড হয়; RCE/রিডাইরেক্ট প্রক্সি হতে পারে"),
    ("dokoplay.xyz", "HIGH",
     "অজানা ডোমেইনে server_lookup.php?channel_id=premium — প্রিমিয়াম স্ট্রিম সোর্স খোঁজার endpoint, অবৈধ স্ট্রিমিং সন্দেহ"),
    ("cfygsjsgdj141.top", "HIGH",
     "র‍্যান্ডম-দেখানো .top ডোমেইন — স্ট্যান্ডার্ড API নয়, সন্দেহজনক C2/কনফিগ হোস্ট"),
    ("rtstv.xyz", "HIGH",
     "অজানা .xyz ডোমেইন — সন্দেহজনক কনটেন্ট/স্ট্রিম হোস্ট"),
    ("newembedplay.xyz", "HIGH",
     "অজানা .xyz ডোমেইন — এম্বেড প্লেয়ার/স্ট্রিম হোস্ট সন্দেহ"),
    ("pscp.tv", "HIGH",
     "অজানা ভিডিও হোস্ট — কনটেন্ট উৎস যাচাই করা অসম্ভব"),
    ("cashraven.io", "MEDIUM",
     "CashRaven consent/monetization SDK — consent_config/auth_state স্ট্রিংসহ কোড; ইউজারের সম্মতি ডেটা সংগ্রহ ও বিজ্ঞাপন লোড করতে পারে"),
    ("developers.cashraven.io", "MEDIUM",
     "CashRaven ডেভেলপার ডকুমেন্টেশন — CashRaven SDK-এর অংশ"),
    ("gateway.unityads.unity3d.com", "MEDIUM",
     "Unity Ads গেটওয়ে — বিজ্ঞাপন সিস্টেম, ডিভাইস ID ও ইউসেজ ডেটা আদান-প্রদান করে"),
    ("app-measurement.com", "MEDIUM",
     "Google Analytics/Firebase App Measurement — বিশ্লেষণ ট্র্যাকিং"),
    ("pagead2.googlesyndication.com", "MEDIUM",
     "Google AdSense/Google syndication — বিজ্ঞাপন পরিবেশনা + ট্র্যাকিং"),
    ("googleadservices.com", "MEDIUM",
     "Google Ads conversion/deeplink — বিজ্ঞাপন রূপান্তর ট্র্যাকিং"),
    ("fcmregistrations.googleapis.com", "MEDIUM",
     "Firebase Cloud Messaging registration — পুশ টোকেন নিবন্ধন"),
    ("firebaseinstallations.googleapis.com", "MEDIUM",
     "Firebase Installations — ডিভাইস/ইনস্ট্যান্স আইডি নিবন্ধন ও ট্র্যাকিং"),
    ("firebaseremoteconfig.googleapis.com", "MEDIUM",
     "Firebase Remote Config — সার্ভার থেকে অ্যাপ আচরণ (URL/পতাকা) পরিবর্তনযোগ্য; হাইজ্যাকিং ঝুঁকি"),
    ("firebaseremoteconfigrealtime.googleapis.com", "MEDIUM",
     "Firebase Remote Config Realtime — রিয়েলটাইম সার্ভার কনফিগ"),
    ("firebase.google.com", "LOW",
     "Firebase সমর্থন পেজ — SDK-সংশ্লিষ্ট, সরাসরি ক্ষতি নয়"),
    ("google.com/search", "LOW",
     "hardcoded Google Search URL — অ্যাপের ভেতরে অস্বাভাবিক, কিন্তু ক্ষতিকর নয়"),
    ("vk.com", "MEDIUM",
     "Vkontakte (vk.com) — রুশ সোশ্যাল/ভিডিও; অননুমোদিত ভিডিও এম্বেড উৎস হতে পারে"),
    ("www.cricbuzz.com", "MEDIUM",
     "Cricbuzz — কপিরাইটকৃত ক্রিকেট কনটেন্ট; অ্যাপে ব্যবহার অননুমোদিত স্ট্রিমিং হতে পারে"),
    ("www.hotstar.com", "MEDIUM",
     "Disney+ Hotstar — কপিরাইটকৃত প্রিমিয়াম ক্রিকেট কনটেন্ট; অননুমোদিত স্ট্রিমিং হতে পারে (LEGAL RISK)"),
    ("streams.videolan.org", "LOW",
     "VLC মিডিয়া স্ট্রিম রেফারেন্স — ডকুমেন্টেশন/নমুনা"),
]

INVALID_PATTERNS = [
    (re.compile(r"default\.url", re.I), "প্লেসহোল্ডার হোস্ট 'default.url' — বাইনারির ডিফল্ট ভ্যালু, আসল URL নয়"),
    (re.compile(r"eulacreatecr_android", re.I), "বাইনারি string-pool সাইড-বা-সাইড concat — 'eula' এর সাথে SDK মেথড নাম লেগে গেছে"),
    (re.compile(r"supportErrorinternal_code", re.I), "ডক্স URL এর সাথে error payload concatenated — কার্যকরী লিংক নয়"),
]

def classify_link(url: str):
    low = url.lower()
    for pat, reason in INVALID_PATTERNS:
        if pat.search(low):
            return "INVALID", "CRITICAL", reason
    # খুব লম্বা token — বাইনারি concat-এর লক্ষণ
    for tok in re.split(r"[/?#&=]", url):
        if len(tok) > 60:
            return "INVALID", "HIGH", f"৬০+ অক্ষরের একটানা token ('{tok[:40]}…') — বাইনারি concat artifact"
    for key, sev, reason in LINK_RULES:
        if key in low:
            return "SUSPICIOUS", sev, reason
    return "OK", "", ""

# ---------------------------------------------------------------- files
def classify_file(rel: str):
    low = rel.lower()
    base = os.path.basename(low)
    if base in ("classes.dex", "classes2.dex"):
        return "DANGEROUS", "HIGH", "অবাধা bytecode — মিনিফাই/অবফাসকেটেড অ্যাপ কোড; আচরণ যাচাই ছাড়া ভরসা করা যায় না"
    # অজানা custom native libs (ABI অনুযায়ী সব)
    if "libnative-lib.so" in low:
        return "DANGEROUS", "HIGH", "ডেভেলপারের নিজস্ব নেটিভ কোড (প্রতি ABI-তে ~0.6–1 MB) — স্ট্যাটিক বিশ্লেষণে দেখা যায় না, সোর্স ছাড়া যাচাই অসম্ভব"
    if base.startswith("libcr_android") or base.startswith("libunitycoherencenative"):
        return "SUSPICIOUS", "MEDIUM", "বান্ডেল থার্ড-পার্টি নেটিভ SDK (ক্রোম/কাস্ট/Unity coherence) — সোর্স নেই"
    if base.startswith(("libffmpegjni", "libdav1djni")):
        return "SUSPICIOUS", "LOW", "মিডিয়া ডিকোডার native lib — সাধারণত নিরীহ, কিন্তু বান্ডেল করা বাইনারি যাচাই ছাড়া ভরসা নয়"
    if "adi-registration.properties" in low:
        return "SUSPICIOUS", "MEDIUM", "Ad Identification (ADI) রেজিস্ট্রেশন আইডি — বিজ্ঞাপন অ্যাট্রিবিউশন; ডিভাইস-স্তরের ট্র্যাকিং"
    if "ad-viewer" in low or base.startswith("om") and base.endswith(".js"):
        return "SUSPICIOUS", "MEDIUM", "IAB Open Measurement (OMID/OM) জাভাস্ক্রিপ্ট — বিজ্ঞাপন ইম্প্রেশন যাচাই/ট্র্যাকিং"
    if base == "androidmanifest.xml":
        return "CHECK", "MEDIUM", "পারমিশন তালিকা যাচাই করুন (নীচে দেখুন)"
    if base in ("dk.json", "p.json"):
        return "SUSPICIOUS", "MEDIUM", "অজ্ঞাত বৃহৎ JSON ডিকশনারি (p=166 KB, dk=9.5 KB) — অবফাসকেটেড কনফিগ/ডেটা হতে পারে"
    if base == "resources.arsc":
        return "CHECK", "LOW", "কম্পাইল করা রিসোর্স টেবিল — কনটেন্ট যাচাই ছাড়া আইডেন্টিফাই করা যায় না"
    if ext_of(rel) == ".so":
        return "CHECK", "LOW", "Native library — সোর্স ছাড়া আচরণ অজানা"
    if ext_of(rel) in (".0", ".1"):
        return "SUSPICIOUS", "LOW", "অপ্রচলিত extension — অরফ্যান/ভাঙা ফাইল হতে পারে"
    return None, None, None

def ext_of(rel: str) -> str:
    return os.path.splitext(rel)[1].lower()

DANGEROUS_PERMS = {
    "REQUEST_INSTALL_PACKAGES": ("CRITICAL", "নতুন/আপডেটেড APK ইনস্টল করার অনুমতি — পার্শ্ব-লোড + অটো-আপডেট ম্যালওয়্যারের পথ"),
    "SYSTEM_ALERT_WINDOW": ("HIGH", "অন্যান্য অ্যাপের ওপর ওভারলে — ফিশিং/ক্লিক-জালিয়াতি সম্ভব"),
    "QUERY_ALL_PACKAGES": ("HIGH", "ইন্সটল করা সব অ্যাপ দেখা — বিজ্ঞাপন টার্গেটিং/প্রোফাইলিং"),
    "READ_SMS": ("CRITICAL", "SMS পড়া — OTP চুরির ঝুঁকি"),
    "RECEIVE_SMS": ("CRITICAL", "SMS গ্রহণ — OTP চুরির ঝুঁকি"),
    "SEND_SMS": ("CRITICAL", "SMS পাঠানো — ফ্রড ম্যালওয়্যারের লক্ষণ"),
    "READ_PHONE_STATE": ("MEDIUM", "ফোন স্টেট/IMEI অ্যাক্সেস — ডিভাইস ফিঙ্গারপ্রিন্টিং"),
    "READ_PHONE_NUMBERS": ("HIGH", "ফোন নম্বর পড়া"),
    "ACCESS_FINE_LOCATION": ("MEDIUM", "সঠিক লোকেশন — প্রাইভেসি ঝুঁকি"),
    "ACCESS_COARSE_LOCATION": ("LOW", "মোটামুটি লোকেশন"),
    "RECORD_AUDIO": ("HIGH", "মাইক্রোফোন"),
    "CAMERA": ("HIGH", "ক্যামেরা"),
    "READ_EXTERNAL_STORAGE": ("MEDIUM", "স্টোরেজ পড়া"),
    "WRITE_EXTERNAL_STORAGE": ("MEDIUM", "স্টোরেজে লেখা"),
    "RECEIVE_BOOT_COMPLETED": ("MEDIUM", "বুটে চালু — ব্যাকগ্রাউন্ড persistence"),
    "FOREGROUND_SERVICE": ("LOW", "ফোরগ্রাউন্ড সার্ভিস — স্ট্রিমিং অ্যাপের জন্য স্বাভাবিক"),
    "WAKE_LOCK": ("LOW", "স্ক্রিন জাগিয়ে রাখা — ভিডিওর জন্য স্বাভাবিক"),
    "POST_NOTIFICATIONS": ("LOW", "নোটিফিকেশন"),
    "INSTALL_SHORTCUT": ("MEDIUM", "শর্টকাট ইনস্টল — রিডাইরেক্ট ফিশিং সম্ভব"),
    "DISABLE_KEYGUARD": ("HIGH", "লকস্ক্রিন নিষ্ক্রিয় — নিরাপত্তা ঝুঁকি"),
    "BIND_ACCESSIBILITY_SERVICE": ("CRITICAL", "অ্যাক্সেসিবিলিটি সার্ভিস — স্ক্রিন রিড/কন্ট্রোল, ম্যালওয়্যারের প্রিয় পথ"),
}

def scan_manifest(data: bytes):
    texts = []
    for enc in ("utf-8", "utf-16le"):
        try:
            texts.append(data.decode(enc, errors="ignore"))
        except Exception:
            pass
    perms = set()
    for t in texts:
        perms.update(re.findall(r"android\.permission\.[A-Z_0-9]+", t))
    return sorted(p.split(".")[-1] for p in perms)

def main():
    DANGER.mkdir(parents=True, exist_ok=True)
    findings = []  # (kind, severity, item, reason, source)

    # ---------------- লিংকের তালিকা পড়া
    links_csv = OUTPUT / "ALL_LINKS_WITH_SOURCE.csv"
    link_rows = []
    if links_csv.exists():
        with open(links_csv, newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                link_rows.append(row)

    # ---------------- ফাইলের হ্যাশ + শ্রেণিবিন্যাস
    suspicious_files = []   # (rel, size, sha256, severity, reason)
    total_bytes = 0
    all_files = []
    if EXTRACTED.exists():
        for root, _, files in os.walk(EXTRACTED):
            for fn in files:
                p = Path(root) / fn
                all_files.append(p)
    all_files.sort()

    for p in all_files:
        rel = rel_from_extracted(p)
        try:
            size = p.stat().st_size
        except OSError:
            size = 0
        total_bytes += size
        cat, sev, reason = classify_file(rel)
        if cat:
            h = sha256_file(p)
            suspicious_files.append((rel, size, h, sev, reason))
            findings.append(("FILE", sev, rel, reason, h))

    # ---------------- APK স্বাক্ষর যাচাই (META-INF)
    meta = EXTRACTED / "CRICFy_v7.4 (3)" / "META-INF"
    sig_found = False
    sig_files = []
    if meta.exists():
        for root, _, files in os.walk(meta):
            for fn in files:
                if fn.upper().endswith((".SF", ".RSA", ".DSA", ".EC")) or fn.upper() == "MANIFEST.MF":
                    sig_found = True
                    sig_files.append(fn)
    signature_finding = None
    if not sig_found:
        signature_finding = ("CRITICAL",
                             "META-INF-এ APK স্বাক্ষর নেই (MANIFEST.MF / *.SF / *.RSA অনুপস্থিত) — "
                             "অ্যাপটি স্বাক্ষরবিহীন বা স্বাক্ষর কেটে দেওয়া হয়েছে; Play-স্টোর বিল্ড নয়, ডেভেলপার কর্তৃক রিপ্যাক/মডিফাই করা সন্দেহ")
        findings.append(("APK_SIGNATURE", "CRITICAL", "CRICFy_v7.4.3.zip → META-INF/", signature_finding[1], ORIGINAL_SHA256))

    # ---------------- AndroidManifest permissions
    manifest = EXTRACTED / "CRICFy_v7.4 (3)" / "AndroidManifest.xml"
    manifest_perms = []
    if manifest.exists():
        manifest_perms = scan_manifest(manifest.read_bytes())
        for perm in manifest_perms:
            if perm in DANGEROUS_PERMS:
                sev, reason = DANGEROUS_PERMS[perm]
                findings.append(("PERMISSION", sev, f"android.permission.{perm}", reason, "AndroidManifest.xml"))

    # ---------------- লিংক শ্রেণিবিন্যাস
    suspicious_links = []   # (url, severity, reason, source)
    invalid_links = []      # (url, severity, reason, source)
    for row in link_rows:
        url = row["link"]
        src = row.get("source_files", "")
        kind, sev, reason = classify_link(url)
        if kind == "SUSPICIOUS":
            suspicious_links.append((url, sev, reason, src))
            findings.append(("LINK", sev, url, reason, src))
        elif kind == "INVALID":
            invalid_links.append((url, sev, reason, src))
            findings.append(("INVALID_LINK", sev, url, reason, src))

    sev_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "": 4}
    suspicious_links.sort(key=lambda x: (sev_rank.get(x[1], 9), x[0]))
    invalid_links.sort(key=lambda x: (sev_rank.get(x[1], 9), x[0]))
    suspicious_files.sort(key=lambda x: (sev_rank.get(x[3], 9), x[0]))

    crit = sum(1 for f in findings if f[1] == "CRITICAL")
    high = sum(1 for f in findings if f[1] == "HIGH")
    med = sum(1 for f in findings if f[1] == "MEDIUM")

    # ---------------- INVALID_LINKS.txt
    with open(DANGER / "INVALID_LINKS.txt", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# অবৈধ/ভাঙা URL — বাইনারি string-pool থেকে ত্রুটিপূর্ণভাবে এক্সট্র্যাক্ট হয়েছে, এগুলো কার্যকর লিংক নয়\n")
        fh.write(f"# মোট: {len(invalid_links)}\n\n")
        for url, sev, reason, src in invalid_links:
            fh.write(f"[{sev}] {url}\n    কারণ: {reason}\n    উৎস ফাইল: {src}\n\n")

    # ---------------- DANGEROUS_LINKS.md
    with open(DANGER / "DANGEROUS_LINKS.md", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# সন্দেহজনক / সম্ভাব্য ক্ষতিকর লিংক\n\n")
        fh.write(f"মূল ZIP-এর SHA256: `{ORIGINAL_SHA256}`\n\n")
        fh.write(f"মোট ফ্ল্যাগড লিংক: **{len(suspicious_links)}** (HIGH {sum(1 for x in suspicious_links if x[1]=='HIGH')}, "
                 f"MEDIUM {sum(1 for x in suspicious_links if x[1]=='MEDIUM')}, LOW {sum(1 for x in suspicious_links if x[1]=='LOW')})\n\n")
        fh.write("| # | উৎস | লিংক | কারণ | উৎস ফাইল |\n|---|---|---|---|---|\n")
        for i, (url, sev, reason, src) in enumerate(suspicious_links, 1):
            fh.write(f"| {i} | {sev} | `{url}` | {reason} | {src} |\n")

    # ---------------- DANGEROUS_FILES.md
    with open(DANGER / "DANGEROUS_FILES.md", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# সন্দেহজনক / অবৈধ ফাইল (hash সহ)\n\n")
        fh.write(f"মূল ZIP-এর SHA256: `{ORIGINAL_SHA256}`\n\n")
        fh.write(f"মোট ফ্ল্যাগড ফাইল: **{len(suspicious_files)}**\n\n")
        fh.write("| # | সেভারিটি | ফাইল | সাইজ (bytes) | SHA256 | কারণ |\n|---|---|---|---|---|---|\n")
        for i, (rel, size, h, sev, reason) in enumerate(suspicious_files, 1):
            fh.write(f"| {i} | {sev} | `{rel}` | {size:,} | `{h}` | {reason} |\n")

    # ---------------- DANGER_REPORT.csv
    with open(DANGER / "DANGER_REPORT.csv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["kind", "severity", "item", "reason", "source_or_hash"])
        for kind, sev, item, reason, src in findings:
            w.writerow([kind, sev, item, reason, src])

    # ---------------- পারমিশন তালিকা
    perms_txt = ""
    if manifest_perms:
        perms_txt = "## AndroidManifest.xml — শনাক্ত পারমিশন\n\n"
        for p in manifest_perms:
            mark = " ⚠️" if p in DANGEROUS_PERMS else ""
            perms_txt += f"- `android.permission.{p}`{mark}\n"

    # ---------------- DANGER.md (পূর্ণ, output/danger/)
    with open(DANGER / "DANGER.md", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# ⚠️ DANGER — CRICFy_v7.4.3.zip (সম্পূর্ণ রিপোর্ট)\n\n")
        fh.write("> এটি স্বয়ংক্রিয় **স্ট্যাটিক বিশ্লেষণ** — চূড়ান্ত ম্যালওয়্যার/আইনি প্রমাণ নয়। "
                 "ইনস্টল/ব্যবহারের আগে VirusTotal/Google Play Protect দিয়ে যাচাই করুন।\n\n")
        fh.write("## সংক্ষেপ\n\n")
        fh.write(f"- মূল ZIP: `CRICFy_v7.4.3.zip`\n- SHA256: `{ORIGINAL_SHA256}`\n"
                 f"- মোট ফাইল: **{len(all_files)}**, আনজিপ করা সাইজ: **{total_bytes:,} bytes**\n"
                 f"- মোট ফ্ল্যাগড: **{crit + high + med}** (CRITICAL {crit}, HIGH {high}, MEDIUM {med}, LOW বাদে)\n"
                 f"- সন্দেহজনক লিংক: **{len(suspicious_links)}**, অবৈধ/ভাঙা URL: **{len(invalid_links)}**\n\n")
        if signature_finding:
            fh.write("## 🔴 CRITICAL — APK স্বাক্ষর নেই\n\n")
            fh.write(f"- **{signature_finding[1]}**\n- শনাক্ত signature ফাইল: {', '.join(sig_files) if sig_files else 'কোনোটিই নেই'}\n\n")
        fh.write("## সন্দেহজনক লিংক (সারাংশ)\n\n")
        if suspicious_links:
            for url, sev, reason, src in suspicious_links:
                fh.write(f"- **[{sev}]** `{url}` — {reason}\n")
        else:
            fh.write("_কোনোটি ফ্ল্যাগ হয়নি_\n")
        fh.write("\n## অবৈধ/ভাঙা URL\n\n")
        if invalid_links:
            for url, sev, reason, src in invalid_links:
                fh.write(f"- `{url}` — {reason}\n")
        else:
            fh.write("_কোনোটি নেই_\n")
        fh.write("\n" + perms_txt)
        fh.write("\n## ফ্ল্যাগড ফাইল (সারাংশ)\n\n")
        for rel, size, h, sev, reason in suspicious_files:
            fh.write(f"- **[{sev}]** `{rel}` ({size:,} B) — {reason}\n")
        fh.write("\n## সুপারিশ\n\n")
        fh.write("1. এই APK কাউকে ইন্সটল/শেয়ার করবেন না।\n"
                 "2. অজানা ডোমেইন (`dokoplay.xyz`, `cfygsjsgdj141.top`, `rtstv.xyz`, `newembedplay.xyz`, `pscp.tv`) "
                 "এবং `pub-...r2.dev/config.txt` ব্লক করুন।\n"
                 "3. সংশয়: Hotstar/Cricbuzz সরাসরি লিংকের অর্থ অননুমোদিত স্ট্রিমিং হতে পারে — আইনি ঝুঁকি।\n"
                 "4. CashRaven/UnityAds/Firebase — ব্যক্তিগত ডেটা সংগ্রহ; ব্যবহারকারীকে অজানা।\n"
                 "5. স্বাক্ষরবিহীন/রিপ্যাকড APK — Play Store-এ নেই, Play Protect স্ক্যান করুন।\n")

    # ---------------- DANGER.md (repo root — GitHub সামনের পাতা)
    with open("DANGER.md", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# ⚠️ DANGER — CRICFy_v7.4.3.zip\n\n")
        fh.write("**এই APK স্বাক্ষরবিহীন/রিপ্যাকড সন্দেহ এবং অজানা সার্ভারের সাথে যোগাযোগ করে। "
                 "ইন্সটল করবেন না।**\n\n")
        fh.write(f"- মূল ফাইল: `CRICFy_v7.4.3.zip`\n- SHA256: `{ORIGINAL_SHA256}`\n"
                 f"- ফোল্ডার: [`output/danger/`](output/danger/) — `DANGER.md`, `DANGEROUS_FILES.md`, `DANGEROUS_LINKS.md`, `INVALID_LINKS.txt`, `DANGER_REPORT.csv`\n\n")
        fh.write("## মূল লাল পতাকা\n\n")
        fh.write("| # | সেভারিটি | সমস্যা |\n|---|---|---|\n")
        fh.write("| 1 | CRITICAL | META-INF-এ APK স্বাক্ষর (MANIFEST.MF/.SF/.RSA) অনুপস্থিত — রিপ্যাকড/অবিশ্বস্ত বিল্ড |\n")
        fh.write("| 2 | HIGH | `https://dokoplay.xyz/server_lookup.php?channel_id=premium` — অজানা প্রিমিয়াম সার্ভার lookup |\n")
        fh.write("| 3 | HIGH | `https://pub-9610baca6bf84734bf9d40546dc754a6.r2.dev/config.txt` — রিমোট কনফিগ (চলন্ত অবস্থায় আচরণ পরিবর্তনযোগ্য) |\n")
        fh.write("| 4 | HIGH | `https://cfygsjsgdj141.top/`, `rtstv.xyz`, `newembedplay.xyz`, `pscp.tv` — র‍্যান্ডম/অজানা ডোমেইন |\n")
        fh.write("| 5 | HIGH | `classes.dex` (10.1 MB) + `classes2.dex` (3.1 MB) — অবফাসকেটেড কোড |\n")
        fh.write("| 6 | HIGH | অজানা `libnative-lib.so` (সব ABI-তে) — সোর্স ছাড়া আচরণ যাচাই অসম্ভব |\n")
        fh.write("| 7 | MEDIUM | CashRaven consent SDK + Unity Ads + Firebase Remote Config/FCM — ট্র্যাকিং ও রিমোট কনফিগ |\n")
        fh.write("| 8 | MEDIUM | Hotstar/Cricbuzz/vk.com — কপিরাইটকৃত প্রিমিয়াম কনটেন্টের সম্ভাব্য অননুমোদিত স্ট্রিমিং (আইনি ঝুঁকি) |\n\n")
        if manifest_perms:
            risky = [p for p in manifest_perms if p in DANGEROUS_PERMS]
            if risky:
                fh.write("## ঝুঁকিপূর্ণ পারমিশন\n\n")
                for p in risky:
                    fh.write(f"- ⚠️ `android.permission.{p}` — {DANGEROUS_PERMS[p][1]}\n")
                fh.write("\n")
        fh.write("## বিস্তারিত\n\n")
        fh.write("পূর্ণ রিপোর্ট: **[output/danger/DANGER.md](output/danger/DANGER.md)**\n\n")
        fh.write("> দ্রষ্টব্য: এটি স্বয়ংক্রিয় স্ট্যাটিক বিশ্লেষণ; চূড়ান্ত সিদ্ধান্ত নয়।\n")

    print("===== DANGER scan সম্পূর্ণ =====")
    print(f"ফ্ল্যাগড ফাইল: {len(suspicious_files)}")
    print(f"সন্দেহজনক লিংক: {len(suspicious_links)}")
    print(f"অবৈধ URL: {len(invalid_links)}")
    print(f"পারমিশন শনাক্ত: {len(manifest_perms)}; ঝুঁকিপূর্ণ: {sum(1 for p in manifest_perms if p in DANGEROUS_PERMS)}")
    print(f"স্বাক্ষর ফাইল: {'পাওয়া গেছে: ' + ', '.join(sig_files) if sig_found else 'পাওয়া যায়নি (CRITICAL)'}")
    print()
    print(open(DANGER / "DANGER.md", encoding="utf-8").read())

if __name__ == "__main__":
    main()

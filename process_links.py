#!/usr/bin/env python3
"""
CRICFy_v7.4.3.zip থেকে সকল লিংক বের করে ক্যাটাগরি অনুযায়ী সাজানো। (v2)

v2 উন্নতি:
- Binary (dex/so/axml) থেকে printable ASCII + UTF-16LE string বের করে URL খোঁজে,
  যাতে null-byte দিয়ে জোড়া লেগে যাওয়া garbage URL না হয়।
- শুধু বৈধ URL character ব্যবহার করে, domain validate করে।
- by_domain/ + by_type/ + by_category/ (উদ্দেশ্য অনুযায়ী) তিন ধরনের ফোল্ডার।
"""
import os
import re
import csv
import zipfile
from pathlib import Path
from urllib.parse import urlparse
from collections import defaultdict, Counter

ZIP_PATH = Path("CRICFy_v7.4.3.zip")
EXTRACTED = Path("extracted")
OUTPUT = Path("output")

# শুধু বৈধ URL character — control char, space, quote, <>, backslash, ^, `, {, }, | বাদ
URL_RE = re.compile(r'https?://[A-Za-z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]+', re.IGNORECASE)
URL_RE2 = re.compile(r'\b(?:ftp|ws|wss)://[A-Za-z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]+', re.IGNORECASE)
HOST_RE = re.compile(r'^[A-Za-z0-9.-]+$')

TRAILING = ".,;:!?'\"()]}>"

def clean_url(u: str) -> str:
    u = u.strip().strip("\x00")
    while u and u[-1] in TRAILING:
        # শেষে ) থাকলে balance check — সহজভাবে ছাঁটো যদি unmatched হয়
        if u[-1] == ')' and u.count('(') >= u.count(')'):
            break
        u = u[:-1]
    return u

def valid_url(u: str) -> bool:
    if len(u) < 8 or len(u) > 2000:
        return False
    if any(ord(c) < 32 or ord(c) > 126 for c in u):
        return False
    try:
        p = urlparse(u)
    except Exception:
        return False
    host = p.netloc.split(':')[0]
    if not host or '.' not in host:
        return False
    if not HOST_RE.match(host):
        return False
    # TLD অন্তত ২ অক্ষর
    tld = host.rsplit('.', 1)[-1]
    if len(tld) < 2 or not tld.isalpha():
        return False
    # host-এ পরপর দুইবার http/https ঢুকে গেছে কিনা (merged garbage)
    if 'http://' in host or 'https://' in host:
        return False
    return True

def extract_urls_from_bytes(data: bytes):
    urls = set()
    texts = []
    # 1) UTF-8 / ASCII
    try:
        texts.append(data.decode('utf-8', errors='ignore'))
    except Exception:
        pass
    # 2) UTF-16LE (Android binary XML / resources.arsc-এর string pool)
    try:
        texts.append(data.decode('utf-16le', errors='ignore'))
    except Exception:
        pass
    for text in texts:
        for m in URL_RE.findall(text) + URL_RE2.findall(text):
            u = clean_url(m)
            if valid_url(u):
                urls.add(u)
    # 3) printable ASCII string আলাদা করে (dex string pool-এর জন্য অতিরিক্ত নিরাপত্তা)
    for s in re.findall(rb'[\x20-\x7e]{4,}', data):
        try:
            t = s.decode('ascii')
        except Exception:
            continue
        for m in URL_RE.findall(t):
            u = clean_url(m)
            if valid_url(u):
                urls.add(u)
    return sorted(urls)

def get_domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower().split(':')[0]
        if host.startswith("www."):
            host = host[4:]
        return host or "unknown_domain"
    except Exception:
        return "unknown_domain"

def get_type(url: str) -> str:
    low = url.lower()
    path = urlparse(url).path.lower()
    host = get_domain(url)
    if path.endswith(".m3u8") or ".m3u8?" in low:
        return "m3u8_stream"
    if path.endswith(".mpd"):
        return "mpd_stream"
    if path.endswith(".apk"):
        return "apk_download"
    if path.endswith((".zip", ".rar", ".7z", ".tar", ".gz")):
        return "archive_download"
    if path.endswith(".json"):
        return "json"
    if path.endswith(".xml"):
        return "xml"
    if path.endswith(".txt"):
        return "txt"
    if path.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico")):
        return "image"
    if path.endswith((".mp4", ".mkv", ".webm", ".ts", ".mov")):
        return "video"
    if path.endswith((".mp3", ".m4a", ".aac", ".ogg")):
        return "audio"
    if "/api/" in path or host.startswith("api."):
        return "api"
    if path.endswith(".php"):
        return "php_endpoint"
    if path.endswith((".js", ".css")):
        return "static_resource"
    if path.endswith((".html", ".htm", "/")) or path == "":
        return "web_page"
    return "other_http"

# --- উদ্দেশ্য অনুযায়ী ক্যাটাগরি ---
CATEGORY_RULES = [
    ("01_app_backend_and_config", [
        "cashraven.io", "cfygsjsgdj141.top", "r2.dev", "dokoplay.xyz",
        "newembedplay.xyz", "rtstv.xyz", "pscp.tv",
    ]),
    ("02_streaming_and_media", [
        "videolan.org", "dashif.org", "aomedia.org", "hotstar.com",
        "cricbuzz.com", "vk.com",
    ]),
    ("03_ads_analytics_tracking", [
        "googleadservices.com", "googlesyndication.com", "unityads",
        "unity3d.com", "app-measurement.com", "firebase", "fcmregistrations",
        "firebaseinstallations", "firebaseremoteconfig", "google.com/search",
        "google.com/pagead", "doubleclick", "appsflyer", "adjust.com",
    ]),
    ("04_xml_namespace_and_schema", [
        "schemas.android.com", "ns.adobe.com", "w3.org", "schemas.microsoft.com",
        "apache.org", "ietf.org", "semver.org",
    ]),
    ("05_docs_library_license", [
        "developer.android.com", "developers.google.com", "cloud.google.com",
        "github.com", "developer.mozilla.org", "docs.python.org", "docs.rs",
        "issuetracker.google.com", "support.google.com", "youtrack.jetbrains.com",
        "android.googlesource.com", "joda-time.sourceforge.net", "goo.gl", "g.co",
    ]),
]

def get_category(url: str) -> str:
    host = get_domain(url)
    low = url.lower()
    # streaming type আগে দেখো
    t = get_type(url)
    if t in ("m3u8_stream", "mpd_stream", "video"):
        return "02_streaming_and_media"
    for cat, keys in CATEGORY_RULES:
        for k in keys:
            if k in host or k in low:
                return cat
    return "06_other_web"

def safe_folder(name: str) -> str:
    return re.sub(r'[^A-Za-z0-9._-]', '_', name)[:120] or "unknown"

def write_links(folder: Path, links, link_to_sources, extra=None):
    folder.mkdir(parents=True, exist_ok=True)
    with open(folder / "links.txt", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(sorted(links)) + ("\n" if links else ""))
    with open(folder / "links_with_source.csv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["link", "domain", "type", "category", "source_files"])
        for u in sorted(links):
            w.writerow([u, get_domain(u), get_type(u), get_category(u),
                        " | ".join(sorted(link_to_sources[u]))])

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    by_domain_dir = OUTPUT / "by_domain"
    by_type_dir = OUTPUT / "by_type"
    by_category_dir = OUTPUT / "by_category"
    for d in (by_domain_dir, by_type_dir, by_category_dir):
        d.mkdir(parents=True, exist_ok=True)

    inventory = []
    link_to_sources = defaultdict(set)
    all_links_counter = Counter()

    def add_links(urls, source):
        for u in urls:
            link_to_sources[u].add(source)
            all_links_counter[u] += 1

    files = []
    if EXTRACTED.exists():
        for root, dirs, filenames in os.walk(EXTRACTED):
            for fn in filenames:
                files.append(Path(root) / fn)
    else:
        print(f"extracted/ পাওয়া যায়নি, {ZIP_PATH} আনজিপ করছি...")
        with zipfile.ZipFile(ZIP_PATH) as z:
            z.extractall(EXTRACTED)
        for root, dirs, filenames in os.walk(EXTRACTED):
            for fn in filenames:
                files.append(Path(root) / fn)

    files.sort()
    print(f"মোট ফাইল পাওয়া গেছে: {len(files)}")

    for f in files:
        rel = str(f.relative_to(EXTRACTED))
        try:
            size = f.stat().st_size
        except Exception:
            size = 0
        ext = f.suffix.lower()
        before = sum(all_links_counter.values())
        try:
            data = f.read_bytes()
            urls = extract_urls_from_bytes(data)
            add_links(urls, rel)
        except Exception as e:
            print(f"  ! পড়া যায়নি {rel}: {e}")
            data = b""
        if ext in (".zip", ".apk", ".jar"):
            try:
                with zipfile.ZipFile(f) as z:
                    for entry in z.namelist():
                        if entry.endswith("/"):
                            continue
                        try:
                            edata = z.read(entry)
                            add_links(extract_urls_from_bytes(edata), f"{rel}!/{entry}")
                        except Exception:
                            pass
            except Exception:
                pass
        after = sum(all_links_counter.values())
        inventory.append((rel, size, ext, after - before))

    unique_links = sorted(link_to_sources.keys())
    print(f"ইউনিক লিংক: {len(unique_links)}")
    print(f"মোট লিংক occurrence: {sum(all_links_counter.values())}")
    for u in unique_links:
        print(f"  {u}")

    domain_to_links = defaultdict(list)
    type_to_links = defaultdict(list)
    category_to_links = defaultdict(list)
    for u in unique_links:
        domain_to_links[get_domain(u)].append(u)
        type_to_links[get_type(u)].append(u)
        category_to_links[get_category(u)].append(u)

    for domain, links in sorted(domain_to_links.items()):
        write_links(by_domain_dir / safe_folder(domain), links, link_to_sources)
    for typ, links in sorted(type_to_links.items()):
        write_links(by_type_dir / safe_folder(typ), links, link_to_sources)
    for cat, links in sorted(category_to_links.items()):
        write_links(by_category_dir / safe_folder(cat), links, link_to_sources)

    with open(OUTPUT / "ALL_LINKS_UNIQUE.txt", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(unique_links) + ("\n" if unique_links else ""))

    with open(OUTPUT / "ALL_LINKS_WITH_SOURCE.csv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["link", "domain", "type", "category", "occurrences", "source_files"])
        for u in unique_links:
            w.writerow([u, get_domain(u), get_type(u), get_category(u),
                        all_links_counter[u], " | ".join(sorted(link_to_sources[u]))])

    with open(OUTPUT / "file_inventory.csv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["file", "size_bytes", "extension", "links_found_in_file"])
        for rel, size, ext, cnt in inventory:
            w.writerow([rel, size, ext, cnt])

    total_size = sum(s for _, s, _, _ in inventory)
    with open(OUTPUT / "summary.md", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# CRICFy_v7.4.3.zip — সকল লিংক ক্যাটাগরি অনুযায়ী\n\n")
        fh.write(f"- মূল ZIP: `CRICFy_v7.4.3.zip`\n")
        fh.write(f"- মোট ফাইল (আনজিপের পর): **{len(files)}**\n")
        fh.write(f"- আনজিপ করা মোট সাইজ: **{total_size:,} bytes**\n")
        fh.write(f"- মোট লিংক occurrence: **{sum(all_links_counter.values()):,}**\n")
        fh.write(f"- ইউনিক লিংক: **{len(unique_links):,}**\n")
        fh.write(f"- ডোমেইন ক্যাটাগরি: **{len(domain_to_links)}**\n")
        fh.write(f"- টাইপ ক্যাটাগরি: **{len(type_to_links)}**\n")
        fh.write(f"- উদ্দেশ্য ক্যাটাগরি: **{len(category_to_links)}**\n\n")

        fh.write("## উদ্দেশ্য অনুযায়ী ক্যাটাগরি (by_category/)\n\n")
        fh.write("| # | ক্যাটাগরি | লিংক সংখ্যা |\n|---|---|---|\n")
        for i, (c, links) in enumerate(sorted(category_to_links.items(), key=lambda x: -len(x[1])), 1):
            fh.write(f"| {i} | {c} | {len(links)} |\n")

        fh.write("\n## ডোমেইন অনুযায়ী ক্যাটাগরি (by_domain/)\n\n")
        fh.write("| # | ডোমেইন | লিংক সংখ্যা |\n|---|---|---|\n")
        for i, (d, links) in enumerate(sorted(domain_to_links.items(), key=lambda x: -len(x[1])), 1):
            fh.write(f"| {i} | {d} | {len(links)} |\n")

        fh.write("\n## টাইপ অনুযায়ী ক্যাটাগরি (by_type/)\n\n")
        fh.write("| # | টাইপ | লিংক সংখ্যা |\n|---|---|---|\n")
        for i, (t, links) in enumerate(sorted(type_to_links.items(), key=lambda x: -len(x[1])), 1):
            fh.write(f"| {i} | {t} | {len(links)} |\n")

        fh.write("\n## সকল ইউনিক লিংক\n\n")
        for u in unique_links:
            fh.write(f"- {u}\n")

        fh.write("\n## ফোল্ডার কাঠামো\n\n")
        fh.write("```\noutput/\n")
        fh.write("├── summary.md\n")
        fh.write("├── ALL_LINKS_UNIQUE.txt\n")
        fh.write("├── ALL_LINKS_WITH_SOURCE.csv\n")
        fh.write("├── file_inventory.csv\n")
        fh.write("├── by_domain/<domain>/links.txt\n")
        fh.write("├── by_type/<type>/links.txt\n")
        fh.write("├── by_category/<category>/links.txt\n")
        fh.write("└── CRICFy_links_categorized.zip\n")
        fh.write("```\n")

    print((OUTPUT / "summary.md").read_text(encoding="utf-8")[:6000])

    zip_out = OUTPUT / "CRICFy_links_categorized.zip"
    if zip_out.exists():
        zip_out.unlink()
    with zipfile.ZipFile(zip_out, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, filenames in os.walk(OUTPUT):
            for fn in filenames:
                p = Path(root) / fn
                if p == zip_out:
                    continue
                z.write(p, p.relative_to(OUTPUT))
    print(f"\nZIP তৈরি: {zip_out} ({zip_out.stat().st_size:,} bytes)")

    with open(OUTPUT / "explore.txt", "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"files: {len(files)}\nunique_links: {len(unique_links)}\n")
        fh.write(f"domains: {len(domain_to_links)}\ntypes: {len(type_to_links)}\ncategories: {len(category_to_links)}\n\n")
        for rel, size, ext, cnt in inventory:
            fh.write(f"{size:>12}  {ext:<10} links={cnt:<5} {rel}\n")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
CRICFy_v7.4.3.zip থেকে সকল লিংক বের করে ক্যাটাগরি অনুযায়ী সাজানো।

- extracted/ ফোল্ডারের প্রতিটি ফাইল স্ক্যান করে URL বের করে
- nested zip/apk/jar এর ভেতরেও ঢুকে লিংক বের করে
- ডোমেইন অনুযায়ী (by_domain/) এবং টাইপ অনুযায়ী (by_type/) আলাদা ফোল্ডারে সাজায়
- output/ ফোল্ডারে সব আউটপুট + CRICFy_links_categorized.zip তৈরি করে
"""
import os
import re
import csv
import zipfile
import hashlib
from pathlib import Path
from urllib.parse import urlparse
from collections import defaultdict, Counter

ZIP_PATH = Path("CRICFy_v7.4.3.zip")
EXTRACTED = Path("extracted")
OUTPUT = Path("output")

# scheme://... জাতীয় লিংক
URL_RE = re.compile(r'https?://[^\s"\'<>\\)\]\}]+', re.IGNORECASE)
# ftp / অন্য scheme
URL_RE2 = re.compile(r'\b(?:ftp|ws|wss)://[^\s"\'<>\\)\]\}]+', re.IGNORECASE)

TRAILING = ".,;:!?'\")]}>"

def clean_url(u: str) -> str:
    u = u.strip()
    # trailing punctuation ছাঁটো (কিন্তু .m3u8?token=... এর মতো query নষ্ট কোরো না)
    while u and u[-1] in TRAILING:
        # যদি শেষে .m3u8/.json ইত্যাদি থাকে, তার পরের punctuation ছাঁটো
        u = u[:-1]
    return u

def extract_urls_from_bytes(data: bytes):
    # latin-1 decode যাতে binary (dex/so/apk) এর ভেতরের ASCII string ও পাওয়া যায়
    try:
        text = data.decode('utf-8', errors='ignore')
    except Exception:
        text = ""
    urls = URL_RE.findall(text) + URL_RE2.findall(text)
    return [clean_url(u) for u in urls if len(clean_url(u)) > 7]

def get_domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
        # port ছাঁটো
        host = host.split(':')[0]
        if host.startswith("www."):
            host = host[4:]
        return host or "unknown_domain"
    except Exception:
        return "unknown_domain"

def get_type(url: str) -> str:
    low = url.lower()
    # query strip করে path দেখো
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

def safe_folder(name: str) -> str:
    # ফোল্ডার নামের জন্য unsafe char বদলাও
    return re.sub(r'[^A-Za-z0-9._-]', '_', name)[:120] or "unknown"

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    by_domain_dir = OUTPUT / "by_domain"
    by_type_dir = OUTPUT / "by_type"
    by_domain_dir.mkdir(parents=True, exist_ok=True)
    by_type_dir.mkdir(parents=True, exist_ok=True)

    # --- zip inventory ---
    inventory = []  # (rel_path, size, ext, link_count)
    link_to_sources = defaultdict(set)  # url -> set(source)
    all_links_counter = Counter()  # url -> total occurrences

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
        count_before = sum(all_links_counter.values())
        urls = []
        # সাধারণ ফাইল পড়ো
        try:
            data = f.read_bytes()
            urls = extract_urls_from_bytes(data)
            add_links(urls, rel)
        except Exception as e:
            print(f"  ! পড়া যায়নি {rel}: {e}")
            data = b""

        # nested archive হলে ভেতরে ঢোকো
        if ext in (".zip", ".apk", ".jar"):
            try:
                with zipfile.ZipFile(f) as z:
                    for entry in z.namelist():
                        if entry.endswith("/"):
                            continue
                        try:
                            edata = z.read(entry)
                            eurls = extract_urls_from_bytes(edata)
                            add_links(eurls, f"{rel}!/{entry}")
                        except Exception:
                            pass
            except Exception:
                pass

        count_after = sum(all_links_counter.values())
        inventory.append((rel, size, ext, count_after - count_before))

    unique_links = sorted(link_to_sources.keys())
    print(f"ইউনিক লিংক: {len(unique_links)}")
    print(f"মোট লিংক occurrence: {sum(all_links_counter.values())}")

    # --- categorization ---
    domain_to_links = defaultdict(list)
    type_to_links = defaultdict(list)
    for u in unique_links:
        domain_to_links[get_domain(u)].append(u)
        type_to_links[get_type(u)].append(u)

    # by_domain ফোল্ডার
    for domain, links in sorted(domain_to_links.items()):
        folder = by_domain_dir / safe_folder(domain)
        folder.mkdir(parents=True, exist_ok=True)
        with open(folder / "links.txt", "w", encoding="utf-8") as fh:
            fh.write("\n".join(sorted(links)) + "\n")
        with open(folder / "links_with_source.csv", "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["link", "domain", "type", "source_files"])
            for u in sorted(links):
                w.writerow([u, domain, get_type(u), " | ".join(sorted(link_to_sources[u]))])

    # by_type ফোল্ডার
    for typ, links in sorted(type_to_links.items()):
        folder = by_type_dir / safe_folder(typ)
        folder.mkdir(parents=True, exist_ok=True)
        with open(folder / "links.txt", "w", encoding="utf-8") as fh:
            fh.write("\n".join(sorted(links)) + "\n")
        with open(folder / "links_with_source.csv", "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["link", "domain", "type", "source_files"])
            for u in sorted(links):
                w.writerow([u, get_domain(u), typ, " | ".join(sorted(link_to_sources[u]))])

    # --- top-level files ---
    with open(OUTPUT / "ALL_LINKS_UNIQUE.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(unique_links) + ("\n" if unique_links else ""))

    with open(OUTPUT / "ALL_LINKS_WITH_SOURCE.csv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["link", "domain", "type", "occurrences", "source_files"])
        for u in unique_links:
            w.writerow([u, get_domain(u), get_type(u), all_links_counter[u],
                        " | ".join(sorted(link_to_sources[u]))])

    with open(OUTPUT / "file_inventory.csv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["file", "size_bytes", "extension", "links_found_in_file"])
        for rel, size, ext, cnt in inventory:
            w.writerow([rel, size, ext, cnt])

    # summary.md
    total_size = sum(s for _, s, _, _ in inventory)
    with open(OUTPUT / "summary.md", "w", encoding="utf-8") as fh:
        fh.write("# CRICFy_v7.4.3.zip — সকল লিংক ক্যাটাগরি অনুযায়ী\n\n")
        fh.write(f"- মূল ZIP: `CRICFy_v7.4.3.zip`\n")
        fh.write(f"- মোট ফাইল (আনজিপের পর): **{len(files)}**\n")
        fh.write(f"- আনজিপ করা মোট সাইজ: **{total_size:,} bytes**\n")
        fh.write(f"- মোট লিংক occurrence: **{sum(all_links_counter.values()):,}**\n")
        fh.write(f"- ইউনিক লিংক: **{len(unique_links):,}**\n")
        fh.write(f"- ডোমেইন ক্যাটাগরি: **{len(domain_to_links)}**\n")
        fh.write(f"- টাইপ ক্যাটাগরি: **{len(type_to_links)}**\n\n")

        fh.write("## ডোমেইন অনুযায়ী ক্যাটাগরি (by_domain/)\n\n")
        fh.write("| # | ডোমেইন | লিংক সংখ্যা |\n|---|---|---|\n")
        for i, (d, links) in enumerate(sorted(domain_to_links.items(), key=lambda x: -len(x[1])), 1):
            fh.write(f"| {i} | {d} | {len(links)} |\n")

        fh.write("\n## টাইপ অনুযায়ী ক্যাটাগরি (by_type/)\n\n")
        fh.write("| # | টাইপ | লিংক সংখ্যা |\n|---|---|---|\n")
        for i, (t, links) in enumerate(sorted(type_to_links.items(), key=lambda x: -len(x[1])), 1):
            fh.write(f"| {i} | {t} | {len(links)} |\n")

        fh.write("\n## ফোল্ডার কাঠামো\n\n")
        fh.write("```\noutput/\n")
        fh.write("├── summary.md\n")
        fh.write("├── ALL_LINKS_UNIQUE.txt          # সব ইউনিক লিংক এক ফাইলে\n")
        fh.write("├── ALL_LINKS_WITH_SOURCE.csv     # লিংক + কোন ফাইলে পাওয়া গেছে\n")
        fh.write("├── file_inventory.csv            # মূল ZIP-এর প্রতিটি ফাইলের তালিকা\n")
        fh.write("├── by_domain/                    # ডোমেইন অনুযায়ী আলাদা ফোল্ডার\n")
        fh.write("│   └── <domain>/links.txt\n")
        fh.write("├── by_type/                      # টাইপ অনুযায়ী আলাদা ফোল্ডার\n")
        fh.write("│   └── <type>/links.txt\n")
        fh.write("└── CRICFy_links_categorized.zip  # উপরের সবকিছুর ZIP\n")
        fh.write("```\n")

        fh.write("\n## নমুনা লিংক (প্রথম ৫০টি)\n\n")
        for u in unique_links[:50]:
            fh.write(f"- {u}\n")

    print((OUTPUT / "summary.md").read_text(encoding="utf-8")[:4000])

    # --- categorized zip তৈরি ---
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

    # explore.txt — ফাইল তালিকা
    with open(OUTPUT / "explore.txt", "w", encoding="utf-8") as fh:
        fh.write(f"files: {len(files)}\nunique_links: {len(unique_links)}\n")
        fh.write(f"domains: {len(domain_to_links)}\ntypes: {len(type_to_links)}\n\n")
        for rel, size, ext, cnt in inventory:
            fh.write(f"{size:>12}  {ext:<10} links={cnt:<5} {rel}\n")

if __name__ == "__main__":
    main()

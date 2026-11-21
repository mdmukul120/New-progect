#!/usr/bin/env python3
"""
CRICFy_v7.4.3.zip — "ম্যাচ তালিকা" বিশ্লেষণ (GitHub Actions runner-এ চলে)।

পদ্ধতি:
  1) অ্যাপের ভিতরের p/p.json ও dk/dk.json বিশ্লেষণ (ম্যাচ ডেটা/কনফিগ কী থাকে কিনা)
  2) classes.dex / classes2.dex-এ ম্যাচ-সম্পর্কিত printable strings খোঁজা
  3) অ্যাপ যে এন্ডপয়েন্টগুলোতে কল করে সেগুলোতে কল করা (config, server_lookup ইত্যাদি)
  4) ম্যাচ-সংশ্লিষ্ট এন্ট্রি আলাদা করে, সংবেদনশীল টোকেন ও পিয়র স্ট্রিম URL redact করে
     output/matches/ ফোল্ডারে রিপোর্ট লেখা — repo-তে commit হয়

সীমাবদ্ধতা (ইচ্ছাকৃত):
  - .m3u8/.mpd/.ts/rtmp — ওয়ার্কিং প্লেব্যাক লিংক REDACT করা হয় (piracy enabler হবে)
  - token/key/secret/auth — লাল (redact) করা হয়
  - raw অসংরক্ষিত রেসপন্স repo-তে রাখা হয় না; শুধু redact করা সংস্করণ থাকে
"""
import json
import re
import datetime
from pathlib import Path

EXTRACTED = Path("extracted")
APP = EXTRACTED / "CRICFy_v7.4 (3)"
OUT = Path("output/matches")

ENDPOINTS = [
    ("r2_config", "https://pub-9610baca6bf84734bf9d40546dc754a6.r2.dev/config.txt"),
    ("dokoplay_server_lookup", "https://dokoplay.xyz/server_lookup.php?channel_id=premium"),
    ("dokoplay_home", "https://dokoplay.xyz/"),
    ("cfygsjsgdj141_top", "https://cfygsjsgdj141.top/"),
    ("rtstv_xyz", "https://rtstv.xyz/"),
    ("newembedplay_xyz", "https://newembedplay.xyz/"),
    ("pscp_tv", "https://pscp.tv/"),
]

SECRET_PAT = re.compile(r"(token|secret|api[_-]?key|apikey|signature|password|passwd|session[_-]?id|auth[_-]?key|access[_-]?key|client[_-]?secret)", re.I)
PLAYBACK_PAT = re.compile(r"(\.m3u8(\b|\?)|\.mpd(\b|\?)|\.ts(\b|\?)|rtmp://|rtsp://|master\.m3u8|chunklist)", re.I)
TRIVIAL_TOK = re.compile(r"^[A-Za-z0-9_\-]{20,}$")

def http_get(url, limit=1_000_000, ua="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 CRICFy/7.4.3"):
    import urllib.request
    import ssl
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": ua,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://dokoplay.xyz/",
        })
        import urllib.request
        with urllib.request.urlopen(req, timeout=25) as resp:
            body = resp.read(limit + 1)
            return resp.status, dict(resp.headers), body[:limit]
    except Exception as e:
        return None, {}, f"ERROR: {e}".encode()

def redact_text(text: str) -> str:
    out = []
    for line in text.splitlines():
        if PLAYBACK_PAT.search(line):
            line = PLAYBACK_PAT.sub("[REDACTED_PLAYBACK]", line)
        out.append(line)
    text = "\n".join(out)
    # JSON/kv-স্টাইলের secret-এর মান redact
    text = re.sub(r'((?:token|secret|api[_-]?key|apikey|signature|password|session[_-]?id|auth[_-]?key|access[_-]?key|client[_-]?secret)["\']?\s*[:=]\s*["\']?)[^"\',\s}]{6,}',
                  r"\1[REDACTED]", text, flags=re.I)
    return text

def redact_json(obj):
    if isinstance(obj, dict):
        new = {}
        for k, v in obj.items():
            kl = str(k).lower()
            if SECRET_PAT.search(kl):
                new[k] = "[REDACTED]"
            elif isinstance(v, str) and PLAYBACK_PAT.search(v):
                new[k] = "[REDACTED_PLAYBACK_URL]"
            else:
                new[k] = redact_json(v)
        return new
    if isinstance(obj, list):
        return [redact_json(x) for x in obj]
    if isinstance(obj, str) and PLAYBACK_PAT.search(obj):
        return "[REDACTED_PLAYBACK_URL]"
    return obj

def try_json(raw: bytes):
    for enc in ("utf-8", "utf-16le"):
        try:
            t = raw.decode(enc)
            return json.loads(t)
        except Exception:
            continue
    return None

def analyze_json_file(path: Path, label: str):
    info = {"path": str(path), "size": path.stat().st_size if path.exists() else 0}
    if not path.exists():
        info["error"] = "file পাওয়া যায়নি"
        return info
    raw = path.read_bytes()
    obj = try_json(raw)
    if obj is None:
        info["error"] = "JSON নয়"
        info["head"] = raw[:400].decode("utf-8", errors="replace")
        return info
    info["json_type"] = type(obj).__name__
    if isinstance(obj, dict):
        info["top_keys"] = list(obj.keys())[:50]
        info["keys_count"] = len(obj)
        sample = {}
        for k, v in list(obj.items())[:15]:
            if SECRET_PAT.search(str(k)):
                sample[k] = "[REDACTED]"
            else:
                s = json.dumps(v, ensure_ascii=False)
                sample[k] = s[:200] + ("…" if len(s) > 200 else "")
        info["sample"] = sample
    elif isinstance(obj, list):
        info["list_len"] = len(obj)
        info["first_items"] = [redact_json(x) for x in obj[:2]]
    return info

def dex_match_strings():
    hits = set()
    pats = re.compile(r"(match|score|cricket|live|fixture|league|tour|series|team|ipl|t20|one[_-]?day)", re.I)
    for name in ("classes.dex", "classes2.dex"):
        p = APP / name
        if not p.exists():
            continue
        data = p.read_bytes()
        for m in re.findall(rb"[\x20-\x7e]{5,}", data):
            s = m.decode("ascii", errors="ignore")
            if pats.search(s) and len(s) <= 120:
                hits.add(s)
    return sorted(hits)

def looks_like_match(d):
    if not isinstance(d, dict):
        return False
    keys = {str(k).lower() for k in d.keys()}
    want = {"match", "teams", "team_1", "team_2", "team1", "team2", "title", "matchid", "match_id",
            "channel", "status", "start_time", "starttime", "matchname", "match_title", "league",
            "tournament", "series", "category", "score", "t1", "t2", "event", "fixture"}
    return len(keys & want) >= 2

def extract_matches(obj, depth=0, acc=None):
    if acc is None:
        acc = []
    if depth > 8 or len(acc) >= 200:
        return acc
    if isinstance(obj, dict):
        if looks_like_match(obj):
            acc.append(obj)
            return acc
        for v in obj.values():
            extract_matches(v, depth + 1, acc)
    elif isinstance(obj, list):
        for v in obj:
            extract_matches(v, depth + 1, acc)
    return acc

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"

    # ---------- 1) লোকাল JSON অ্যানালাইসিস
    p_info = analyze_json_file(APP / "p" / "p.json", "p.json")
    dk_info = analyze_json_file(APP / "dk" / "dk.json", "dk.json")

    # ---------- 2) dex-এ match strings
    match_strings = dex_match_strings()

    # ---------- 3) এন্ডপয়েন্ট কল
    responses = []
    for name, url in ENDPOINTS:
        status, headers, body = http_get(url)
        red_body = redact_text(body.decode("utf-8", errors="replace")) if isinstance(body, bytes) else str(body)
        # JSON হলে parse করে redact + matches বের করি
        obj = try_json(body) if status and isinstance(body, bytes) else None
        obj_red = redact_json(obj) if obj is not None else None
        matches = extract_matches(obj) if obj is not None else []
        fname = f"{name}.json" if obj_red is not None else f"{name}.txt"
        with open(OUT / fname, "w", encoding="utf-8", newline="\n") as fh:
            if obj_red is not None:
                fh.write(json.dumps(obj_red, indent=2, ensure_ascii=False))
            else:
                fh.write(red_body)
        responses.append({"name": name, "url": url, "status": status, "bytes": len(body) if isinstance(body, bytes) else 0,
                          "is_json": obj is not None, "match_candidates": len(matches),
                          "matches": [redact_json(m) for m in matches], "file": fname})

    total_matches = sum(r["match_candidates"] for r in responses)

    # ---------- 4) রিপোর্ট MD
    lines = []
    lines.append("# 📡 CRICFy — অ্যাপের ভেতরে কী ম্যাচ আসছে (GitHub Actions থেকে fetch)\n")
    lines.append(f"- Fetch time (UTC): {stamp}\n- পদ্ধতি: GitHub Actions runner থেকে HTTP GET (অ্যাপ যে এন্ডপয়েন্টেই কল করে সেগুলোই)\n"
                 f"- প্লেব্যাক/স্ট্রিম URL ও টোকেন ইচ্ছাকৃতভাবে REDACT করা হয়েছে\n\n")

    lines.append("## ১) অ্যাপের ভিতরের p/p.json\n\n```json\n")
    lines.append(json.dumps(p_info, indent=2, ensure_ascii=False)[:4000])
    lines.append("\n```\n\n## ২) অ্যাপের ভিতরের dk/dk.json\n\n```json\n")
    lines.append(json.dumps(dk_info, indent=2, ensure_ascii=False)[:4000])
    lines.append("\n```\n\n")

    lines.append("## ৩) dex মধ্যে ম্যাচ-সংক্রান্ত strings (নমুনা, ≤80 টি)\n\n```\n")
    lines.extend(match_strings[:80])
    lines.append(f"\n```\nমোট distinct match-like strings: {len(match_strings)}\n\n")

    lines.append("## ৪) এন্ডপয়েন্ট রেসপন্স সারাংশ\n\n| এন্ডপয়েন্ট | HTTP | সাইজ | JSON? | ম্যাচ candidates | ফাইল |\n|---|---|---|---|---|---|\n")
    for r in responses:
        lines.append(f"| `{r['url']}` | {r['status']} | {r['bytes']:,} B | {'হ্যাঁ' if r['is_json'] else 'না'} | {r['match_candidates']} | `{r['file']}` |\n")
    lines.append(f"\n**মোট ম্যাচ candidates: {total_matches}**\n\n")

    for r in responses:
        if r["matches"]:
            lines.append(f"## ৫) `{r['name']}` থেকে শনাক্ত ম্যাচ ({len(r['matches'])})\n\n")
            lines.append("```json\n")
            lines.append(json.dumps(r["matches"][:50], indent=2, ensure_ascii=False)[:6000])
            lines.append("\n```\n\n")

    lines.append("## নোট\n\n"
                 "- `200` মানে এন্ডপয়েন্ট জীবিত; JSON-এ ম্যাচ লিস্ট থাকলে উপরে টেবিল/ব্লকে দেওয়া হয়েছে।\n"
                 "- স্ট্রিম/প্লেব্যাক URL (`.m3u8` ইত্যাদি) ও টোকেন/key লাল করে দেওয়া হয়েছে — আলাদা করে চাওয়া যাবে না।\n"
                 "- এটি অননুমোদিত/পাইরেটেড স্ট্রিমিং অবকাঠামো বলে মনে হচ্ছে; ডেটা শুধু বিশ্লেষণের জন্য সংগৃহীত।\n")

    report = "\n".join(lines)
    (OUT / "MATCHES.md").write_text(report, encoding="utf-8")
    (OUT / "fetch_report.json").write_text(json.dumps({
        "fetched_at": stamp, "p_json": p_info, "dk_json": dk_info,
        "match_strings_count": len(match_strings),
        "responses": [{k: v for k, v in r.items() if k != "matches"} for r in responses],
        "total_match_candidates": total_matches,
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    print(report)

if __name__ == "__main__":
    main()

"""Generate 10 separate demo videos, one per GitHub skill in the screenshot.

Each video: 1280x720 (720x1280 for Claude Shorts), 30fps, ~24s.
On-screen text is English (renders perfectly); Bengali subtitles are
written as sidecar .srt files (players shape Bengali correctly).
"""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image, ImageDraw
from video_factory.common import (
    font, ease_out, ease_in_out, clamp01, lerp, hex_to_rgb,
    rounded_rect, text_size, wrap_text, draw_wrapped, bg_gradient,
    encode_frames, write_srt,
)

W, H = 1280, 720
FPS = 30
DUR = 24.0
NFRAMES = int(FPS * DUR)

VIDEOS = [
    dict(num="01", slug="01_ghost-editor", name="Ghost Editor",
         repo="kurbaitaev/ghost-editor", url="https://github.com/kurbaitaev/ghost-editor",
         stars="727", lang="Python", accent="#A78BFA",
         tagline="Raw talking-head take in. Finished reel out. 19 styles.",
         what=["AI video editor for Claude Code",
               "Picks the best take of every line automatically",
               "Captions, scenes and sound — then self-checks the reel"],
         code=["# Install the skill",
               "clone https://github.com/kurbaitaev/ghost-editor",
               "  into ~/.claude/skills/ghost-editor",
               "",
               "# Use it",
               "/ghost-editor edit my-take.mp4 --style clean-os",
               "# -> reel_30s.mp4  (21 reels in 3h 40m on one Mac mini)"],
         demo="ghost"),
    dict(num="02", slug="02_ffmpeg-skill", name="FFmpeg Skill",
         repo="donghaozhang/ffmpeg-claude-skill", url="https://github.com/donghaozhang/ffmpeg-claude-skill",
         stars="3", lang="Skill.md (900+ lines)", accent="#22C55E",
         tagline="The media-processing brain for Claude Code.",
         what=["Convert, resize, trim, speed up, fade, GIF, subtitles",
               "CRF, two-pass, bitrate, filters, HLS / DASH streaming",
               "900+ lines of verified FFmpeg knowledge in one skill"],
         code=["ffmpeg -i input.mkv output.mp4",
               "ffmpeg -i video.mp4 -vn -c:a libmp3lame audio.mp3",
               "ffmpeg -i in.mp4 -vf scale=1280:720 out.mp4",
               "ffmpeg -ss 00:01:00 -i in.mp4 -t 00:00:30 -c copy out.mp4",
               "ffmpeg -i in.mp4 -vf fps=10,scale=320:-1 out.gif"],
         demo="ffmpeg"),
    dict(num="03", slug="03_claude-shorts", name="Claude Shorts",
         repo="AgriciDaniel/claude-shorts", url="https://github.com/AgriciDaniel/claude-shorts",
         stars="506", lang="Python + Remotion", accent="#F59E0B",
         tagline="Long video in. Viral vertical Short out.",
         what=["10-step pipeline: transcribe, score, approve, render",
               "Claude scores segments on hook, emotion, value, payoff",
               "Remotion animated captions + cursor tracking"],
         code=["bash setup.sh && bash install.sh",
               "# Claude Code pipeline:",
               "# 1 Preflight  2 Transcribe (faster-whisper)",
               "# 3 Detect     4 Analyze + score 8-12 segments",
               "# 5 Approve    6 Snap to word boundaries",
               "# 7 Extract    8 Render 1080x1920  9 Export"],
         demo="shorts", vertical=True),
    dict(num="04", slug="04_motionclone", name="MotionClone",
         repo="LPengYang/MotionClone", url="https://github.com/LPengYang/MotionClone",
         stars="565", lang="Python (ICLR 2025)", accent="#EC4899",
         tagline="Training-free motion cloning for video generation.",
         what=["Copy motion from a reference video — no training",
               "Sparse temporal-attention weights = motion representation",
               "One denoising step. No video inversion needed"],
         code=["python t2v_video_sample.py \\",
               "  --inference_config configs/t2v_camera.yaml \\",
               "  --examples configs/t2v_camera.jsonl",
               "",
               "# image-to-video / sketch-to-video:",
               "python i2v_video_sample.py \\",
               "  --inference_config configs/i2v_rgb.yaml"],
         demo="motionclone"),
    dict(num="05", slug="05_motion-skills", name="Motion Skills",
         repo="iart-ai/motion-skills", url="https://github.com/iart-ai/motion-skills",
         stars="2,142", lang="56 skills · 19 packs", accent="#06B6D4",
         tagline="Teach your AI agent to make motion graphics.",
         what=["Kinetic type, data-viz, explainers, TikTok / Reels, WebGL",
               "Deliver-and-verify loop: render, screenshot, check",
               "Install one pack — your agent just knows how"],
         code=["npx skills add iart-ai/tiktok-video-skills",
               "npx skills add iart-ai/data-animation-skills",
               "npx skills add iart-ai/web-animation-skills",
               "",
               "# or as a Claude Code plugin:",
               "/plugin marketplace add iart-ai/web-animation-skills"],
         demo="motion"),
    dict(num="06", slug="06_yt-dlp", name="yt-dlp",
         repo="yt-dlp/yt-dlp", url="https://github.com/yt-dlp/yt-dlp",
         stars="210,483", lang="Python", accent="#EF4444",
         tagline="The feature-rich audio / video downloader.",
         what=["Download from 1,000+ sites — YouTube, TikTok, X, more",
               "Pick exact format, merge video + audio, embed subs",
               "Metadata, playlists, archives, cookies, scripting"],
         code=["yt-dlp https://youtu.be/VIDEO_ID",
               "yt-dlp -f 'bv*+ba/b' --merge-output-format mp4 URL",
               "yt-dlp --write-subs --sub-langs bn,en --convert-subs srt",
               "yt-dlp -x --audio-format mp3 URL",
               "yt-dlp --dump-json URL | jq .title"],
         demo="ytdlp"),
    dict(num="07", slug="07_whisper", name="Whisper",
         repo="openai/whisper", url="https://github.com/openai/whisper",
         stars="113,439", lang="Python (OpenAI)", accent="#3B82F6",
         tagline="Robust speech recognition. 99 languages.",
         what=["Multilingual ASR + translation + language ID in one model",
               "Trained on 680k hours of weakly-supervised audio",
               "tiny (39M) to large (1550M) — speed / accuracy trade-off"],
         code=["pip install -U openai-whisper",
               "whisper audio.mp3 --model turbo",
               "whisper japanese.wav --language Japanese",
               "whisper japanese.wav --model medium \\",
               "  --language Japanese --task translate",
               "",
               "import whisper",
               "model = whisper.load_model('turbo')",
               "print(model.transcribe('audio.mp3')['text'])"],
         demo="whisper"),
    dict(num="08", slug="08_awesome-claude-video-skills", name="Awesome Claude Video Skills",
         repo="zhuyansen/awesome-claude-video-skills", url="https://github.com/zhuyansen/awesome-claude-video-skills",
         stars="2,683", lang="548 repos, graded", accent="#F97316",
         tagline="Every open-source video skill for coding agents.",
         what=["548 repos by type: frameworks, promo, explainers, avatars",
               "Each repo read and security-graded by Agent Skills Hub",
               "16 skills tested end-to-end — timed, ranked, honest"],
         code=["# Top picks from the 16-skill test:",
               "# 1. explainroo  — film in ~2 min from a brief",
               "# 2. onetake      — one idea, one continuous shot",
               "# 3. remotion/skills — reliable render in 4.5 min",
               "",
               "# Browse + filter:",
               "# agentskillshub.top/best/claude-video-skills"],
         demo="awesome"),
    dict(num="09", slug="09_threejs-skills", name="Three.js Skills",
         repo="cloudai-x/threejs-skills", url="https://github.com/cloudai-x/threejs-skills",
         stars="4,383", lang="12 skills · r186", accent="#10B981",
         tagline="Current, verified three.js knowledge for Claude Code.",
         what=["Targets three.js r186 + React Three Fiber 9.8",
               "Geometry, materials, lighting, shaders, post, performance",
               "Common-mistakes list kills outdated patterns (r160 era)"],
         code=["npx skills add cloudai-x/threejs-skills",
               "",
               "import * as THREE from 'three';",
               "const renderer = new THREE.WebGPURenderer({ antialias: true });",
               "const scene = new THREE.Scene();",
               "scene.add(new THREE.Mesh(geo, mat));",
               "renderer.setAnimationLoop(tick);"],
         demo="threejs"),
    dict(num="10", slug="10_hyperframes", name="HyperFrames",
         repo="heygen-com/hyperframes", url="https://github.com/heygen-com/hyperframes",
         stars="89,624", lang="TypeScript (HeyGen)", accent="#8B5CF6",
         tagline="Write HTML. Render video. Built for agents.",
         what=["AI video editor: create, edit, remake — HTML in, MP4 out",
               "Edit your footage, remake any video, launch from a website",
               "Catalog blocks: charts, maps, captions, kinetic type"],
         code=["npx skills add heygen-com/hyperframes",
               "npx hyperframes init my-video",
               "cd my-video",
               "npx hyperframes preview   # live in browser",
               "npx hyperframes render    # -> MP4",
               "",
               "# Using /hyperframes, create a 10s product intro",
               "# with fade-in title + background music."],
         demo="hyperframes"),
]

# Bengali subtitles (sidecar .srt — players shape Bengali correctly)
BN_SUBS = {
    "01_ghost-editor": [
        (0, 3, "০১ — Ghost Editor: কাঁচা টকিং-হেড ভিডিও থেকে তৈরি রিল।"),
        (3, 8, "ক্লদ কোডের জন্য ওপেন-সোর্স AI ভিডিও এডিটর। ১৯টি স্টাইল।"),
        (8, 18, "ডেমো: খারাপ টেক বাদ, সেরা টেক বাছাই, ক্যাপশন ও সাউন্ড যোগ।"),
        (18, 22, "ইনস্টল: স্কিল ক্লোন করে ক্লদ কোডে ব্যবহার করুন।"),
        (22, 24, "গিটহাব: github.com/kurbaitaev/ghost-editor"),
    ],
    "02_ffmpeg-skill": [
        (0, 3, "০২ — FFmpeg Skill: মিডিয়া প্রসেসিংয়ের মস্তিষ্ক।"),
        (3, 8, "কনভার্ট, রিসাইজ, ট্রিম, স্পিড, ফেড, GIF, সাবটাইটেল — সবই।"),
        (8, 18, "ডেমো: আসল ffmpeg কমান্ড দিয়ে ভিডিও রূপান্তর।"),
        (18, 22, "কমান্ডগুলো দেখুন — কপি করে ব্যবহার করুন।"),
        (22, 24, "গিটহাব: github.com/donghaozhang/ffmpeg-claude-skill"),
    ],
    "03_claude-shorts": [
        (0, 3, "০৩ — Claude Shorts: লং ভিডিও থেকে ভার্টিকাল শর্ট।"),
        (3, 8, "১০ ধাপের পাইপলাইন: ট্রান্সক্রাইব, স্কোর, অনুমোদন, রেন্ডার।"),
        (8, 18, "ডেমো: ১৬:৯ থেকে ৯:১৬ ক্রপ ও অ্যানিমেটেড ক্যাপশন।"),
        (18, 22, "Remotion দিয়ে 1080x1920 রেন্ডার।"),
        (22, 24, "গিটহাব: github.com/AgriciDaniel/claude-shorts"),
    ],
    "04_motionclone": [
        (0, 3, "০৪ — MotionClone: ট্রেনিং ছাড়াই মোশন ক্লোনিং।"),
        (3, 8, "রেফারেন্স ভিডিওর মোশন নতুন কনটেন্টে কপি করুন।"),
        (8, 18, "ডেমো: বলের গতিপথ স্টার ও গাড়িতে ক্লোন।"),
        (18, 22, "ICLR 2025 — sparse temporal attention।"),
        (22, 24, "গিটহাব: github.com/LPengYang/MotionClone"),
    ],
    "05_motion-skills": [
        (0, 3, "০৫ — Motion Skills: মোশন গ্রাফিক্সের ৫৬টি স্কিল।"),
        (3, 8, "কাইনেটিক টাইপ, ডেটা-ভিজ, এক্সপ্লেইনার, WebGL।"),
        (8, 18, "ডেমো: টেক্সট অ্যানিমেশন ও চার্ট রেস।"),
        (18, 22, "npx skills add দিয়ে এক প্যাক ইনস্টল করুন।"),
        (22, 24, "গিটহাব: github.com/iart-ai/motion-skills"),
    ],
    "06_yt-dlp": [
        (0, 3, "০৬ — yt-dlp: অডিও/ভিডিও ডাউনলোডার।"),
        (3, 8, "১০০০+ সাইট থেকে ডাউনলোড, ফরম্যাট বাছাই, মার্জ।"),
        (8, 18, "ডেমো: URL থেকে মেটাডেটা ও ডাউনলোড প্রগ্রেস।"),
        (18, 22, "কমান্ডগুলো কপি করে নিজের ভিডিও ডাউনলোড করুন।"),
        (22, 24, "গিটহাব: github.com/yt-dlp/yt-dlp"),
    ],
    "07_whisper": [
        (0, 3, "০৭ — Whisper: স্পিচ-টু-টেক্সট। ৯৯ ভাষা।"),
        (3, 8, "OpenAI-এর রোবাস্ট স্পিচ রিকগনিশন মডেল।"),
        (8, 18, "ডেমো: ওয়েভফর্ম থেকে শব্দ-ভিত্তিক ট্রান্সক্রিপ্ট।"),
        (18, 22, "pip install openai-whisper — এক লাইনে শুরু।"),
        (22, 24, "গিটহাব: github.com/openai/whisper"),
    ],
    "08_awesome-claude-video-skills": [
        (0, 3, "০৮ — Awesome Claude Video Skills: ৫৪৮টি রিপো।"),
        (3, 8, "ফ্রেমওয়ার্ক, প্রোমো, এক্সপ্লেইনার, অবতার — সব টাইপ।"),
        (8, 18, "ডেমো: টপ পিক ও সিকিউরিটি গ্রেড।"),
        (18, 22, "১৬টি স্কিল টেস্ট করে র‍্যাংক করা হয়েছে।"),
        (22, 24, "গিটহাব: github.com/zhuyansen/awesome-claude-video-skills"),
    ],
    "09_threejs-skills": [
        (0, 3, "০৯ — Three.js Skills: r186-এর যাচাইকৃত জ্ঞান।"),
        (3, 8, "জিওমেট্রি, ম্যাটেরিয়াল, লাইটিং, শেডার, পোস্ট।"),
        (8, 18, "ডেমো: ঘূর্ণায়মান 3D কিউব ও টরাস — WebGL রেন্ডার।"),
        (18, 22, "npx skills add cloudai-x/threejs-skills"),
        (22, 24, "গিটহাব: github.com/cloudai-x/threejs-skills"),
    ],
    "10_hyperframes": [
        (0, 3, "১০ — HyperFrames: HTML লিখুন, MP4 পান।"),
        (3, 8, "HeyGen-এর AI ভিডিও এডিটর — ক্রিয়েট, এডিট, রিমেক।"),
        (8, 18, "ডেমো: HTML ব্লক থেকে রেন্ডার করা ভিডিও।"),
        (18, 22, "npx hyperframes init — প্রিভিউ — রেন্ডার।"),
        (22, 24, "গিটহাব: github.com/heygen-com/hyperframes"),
    ],
}


def draw_header(draw, w, h, v, t):
    """Top bar with number + name + progress."""
    accent = hex_to_rgb(v["accent"])
    draw.rectangle([0, 0, w, 64], fill=(10, 11, 15))
    draw.rectangle([0, 64, w, 68], fill=accent)
    draw.text((28, 14), f'{v["num"]}  {v["name"]}', font=font(30, bold=True), fill=(255, 255, 255))
    repo_f = font(18, mono=True)
    tw, _ = text_size(draw, v["repo"], repo_f)
    draw.text((w - 28 - tw, 22), v["repo"], font=repo_f, fill=(160, 165, 180))
    # progress
    p = clamp01(t / DUR)
    draw.rectangle([0, 68, w, 74], fill=(40, 42, 52))
    draw.rectangle([0, 68, int(w * p), 74], fill=accent)


def draw_footer(draw, w, h, v):
    if w < 1000:
        draw.text((28, h - 68), v["url"], font=font(16, mono=True), fill=(130, 135, 150))
        draw.text((28, h - 44), f'star {v["stars"]}  ·  {v["lang"]}', font=font(16), fill=(130, 135, 150))
        return
    draw.text((28, h - 44), v["url"], font=font(18, mono=True), fill=(130, 135, 150))
    right = f'star {v["stars"]}  ·  {v["lang"]}'
    rf = font(18)
    tw, _ = text_size(draw, right, rf)
    draw.text((w - 28 - tw, h - 44), right, font=rf, fill=(130, 135, 150))


def scene_title(v, t_local, w, h):
    img = bg_gradient(w, h)
    d = ImageDraw.Draw(img)
    accent = hex_to_rgb(v["accent"])
    # animated accent bar
    p = ease_out(clamp01(t_local / 0.6))
    d.rectangle([80, 200, 80 + int(220 * p), 212], fill=accent)
    d.text((80, 230), f'SKILL {v["num"]} / 10', font=font(28, bold=True), fill=accent)
    # title (may wrap)
    f_title = font(64, bold=True)
    y = 280
    for line in wrap_text(d, v["name"], f_title, w - 160):
        d.text((80, y), line, font=f_title, fill=(255, 255, 255))
        y += 76
    d.text((80, y + 8), v["tagline"], font=font(30), fill=(200, 205, 220))
    d.text((80, y + 56), v["url"], font=font(24, mono=True), fill=accent)
    # star pill
    pill = f'★ {v["stars"]}  ·  {v["lang"]}'
    tw, th = text_size(d, pill, font(24, bold=True))
    d.rounded_rectangle([80, y + 108, 80 + tw + 36, y + 108 + th + 22], radius=18, fill=(30, 32, 42), outline=accent, width=2)
    d.text((98, y + 118), pill, font=font(24, bold=True), fill=(255, 255, 255))
    return img


def scene_what(v, t_local, w, h):
    img = bg_gradient(w, h)
    d = ImageDraw.Draw(img)
    d.text((80, 120), "What it does", font=font(44, bold=True), fill=(255, 255, 255))
    accent = hex_to_rgb(v["accent"])
    y = 200
    for i, item in enumerate(v["what"]):
        # stagger in
        p = ease_out(clamp01((t_local - i * 0.5) / 0.5))
        if p <= 0:
            continue
        xoff = int((1 - p) * 60)
        d.rounded_rectangle([80 + xoff, y, w - 80 + xoff, y + 84], radius=16, fill=(28, 30, 40), outline=(55, 58, 70), width=1)
        d.ellipse([104 + xoff, y + 24, 140 + xoff, y + 60], fill=accent)
        d.text((118 + xoff, y + 28), str(i + 1), font=font(22, bold=True), fill=(10, 11, 15))
        draw_wrapped(d, item, 160 + xoff, y + 14, font(28), (235, 238, 245), w - 320, line_spacing=6)
        y += 108
    return img


def scene_code(v, t_local, w, h):
    img = Image.new("RGB", (w, h), (13, 15, 20))
    d = ImageDraw.Draw(img)
    d.text((80, 100), "Try it yourself", font=font(44, bold=True), fill=(255, 255, 255))
    d.text((80, 152), "Copy these commands — they work today.", font=font(26), fill=(170, 175, 190))
    # terminal window
    d.rounded_rectangle([80, 210, w - 80, h - 110], radius=18, fill=(10, 12, 16), outline=(50, 53, 66), width=2)
    d.ellipse([108, 232, 128, 252], fill=(239, 68, 68))
    d.ellipse([140, 232, 160, 252], fill=(245, 158, 11))
    d.ellipse([172, 232, 192, 252], fill=(34, 197, 94))
    d.text((212, 230), "terminal", font=font(22, mono=True), fill=(140, 145, 160))
    y = 276
    f = font(20 if w < 1000 else 24, mono=True)
    for line in v["code"]:
        if line.strip() == "":
            y += 18
            continue
        # typing effect: reveal chars progressively in last 1.5s? keep simple: fade in
        d.text((108, y), line, font=f, fill=(220, 225, 235) if not line.startswith("#") else (130, 135, 150))
        y += 36
    return img


def scene_outro(v, t_local, w, h):
    img = bg_gradient(w, h)
    d = ImageDraw.Draw(img)
    accent = hex_to_rgb(v["accent"])
    p = ease_out(clamp01(t_local / 0.5))
    y = draw_wrapped(d, "Next: install it and make your first video.", 80, 220, font(40, bold=True), (255, 255, 255), w - 160, line_spacing=10)
    d.text((80, y + 10), v["url"], font=font(24, mono=True), fill=accent)
    y2 = draw_wrapped(d, "Bengali subtitles: open the .srt file with this video.", 80, y + 60, font(26), (190, 195, 210), w - 160, line_spacing=8)
    draw_wrapped(d, "Series: 10 skills for AI video — 01 Ghost Editor → 10 HyperFrames.", 80, y2 + 8, font(26), (190, 195, 210), w - 160, line_spacing=8)
    # pulsing dot
    r = 10 + int(4 * math.sin(t_local * 6))
    by = y2 + 80
    d.ellipse([80, by, 80 + 2 * r, by + 2 * r], fill=accent)
    d.text((110, by - 2), "Thanks for watching!", font=font(30, bold=True), fill=(255, 255, 255))
    return img


# ---------------- DEMOS ----------------

def demo_ghost(img, d, p, w, h, accent):
    # Pipeline: RAW -> TRANSCRIPT -> BEST TAKES -> 19 STYLES -> REEL
    stages = ["RAW TAKE\n2:57 · 33 tries", "TRANSCRIPT\nword timestamps", "BEST TAKES\n21 picked", "19 STYLES\nClean OS … HUD", "FINAL REEL\n0:30 · captions"]
    n = len(stages)
    box_w = (w - 160 - (n - 1) * 30) // n
    y0, bh = 200, 150
    active = int(p * n)
    for i, s in enumerate(stages):
        x = 80 + i * (box_w + 30)
        done = i < active
        cur = i == active
        fill = accent if cur else ((45, 48, 60) if done else (28, 30, 40))
        outline = accent if (done or cur) else (60, 63, 75)
        d.rounded_rectangle([x, y0, x + box_w, y0 + bh], radius=16, fill=fill, outline=outline, width=2)
        lines = s.split("\n")
        d.text((x + 16, y0 + 30), lines[0], font=font(26, bold=True), fill=(255, 255, 255) if (done or cur) else (200, 205, 220))
        d.text((x + 16, y0 + 70), lines[1], font=font(20), fill=(255, 255, 255) if cur else (160, 165, 180))
        if done:
            d.text((x + box_w - 44, y0 + 12), "✓", font=font(28, bold=True), fill=(255, 255, 255))
        if i < n - 1:
            ax = x + box_w + 6
            d.text((ax, y0 + 58), "›", font=font(36, bold=True), fill=accent)
    # lower: talking head + captions demo
    # avatar
    cx, cy = 300, 480
    d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=(240, 230, 220), outline=accent, width=4)
    # mouth animates
    mw = 30 + int(14 * abs(math.sin(p * 20)))
    d.ellipse([cx - mw, cy + 28, cx + mw, cy + 28 + 18], fill=(120, 40, 50))
    d.ellipse([cx - 34, cy - 24, cx - 10, cy - 4], fill=(20, 20, 25))
    d.ellipse([cx + 10, cy - 24, cx + 34, cy - 4], fill=(20, 20, 25))
    d.text((cx - 90, cy + 84), "you (raw take)", font=font(20), fill=(160, 165, 180))
    # caption bar
    caps = ["Three minutes of stumbling…", "…into a 30-second reel.", "That looks paid-for."]
    idx = min(len(caps) - 1, int(p * len(caps)))
    d.rounded_rectangle([480, 440, w - 120, 520], radius=14, fill=(10, 11, 15), outline=accent, width=2)
    d.text((500, 462), caps[idx], font=font(30, bold=True), fill=(255, 255, 255))
    d.text((500, 500), "karaoke captions · B-roll · sound", font=font(20), fill=(170, 175, 190))
    # style tiles
    d.text((80, 560), "19 styles — pick one:", font=font(24, bold=True), fill=(255, 255, 255))
    styles = ["Clean OS", "Seoul list", "RESULT", "Explainer", "Kinetic", "Whiteboard", "News", "HUD"]
    for i, s in enumerate(styles):
        x = 80 + i * 140
        on = (i / len(styles)) < p
        d.rounded_rectangle([x, 600, x + 128, 648], radius=10, fill=accent if on else (30, 32, 42), outline=(60, 63, 75), width=1)
        d.text((x + 10, 612), s, font=font(18, bold=True), fill=(255, 255, 255) if on else (170, 175, 190))


def demo_ffmpeg(img, d, p, w, h, accent):
    # left: test pattern video; right: operations
    d.text((80, 150), "LIVE DEMO — real ffmpeg operations", font=font(30, bold=True), fill=(255, 255, 255))
    # test pattern box
    x0, y0, x1, y1 = 80, 210, 620, 510
    d.rounded_rectangle([x0, y0, x1, y1], radius=16, fill=(20, 22, 30), outline=accent, width=2)
    # moving color bars + ball
    colors = [(239, 68, 68), (245, 158, 11), (34, 197, 94), (59, 130, 246), (168, 85, 247)]
    for i, c in enumerate(colors):
        bx = x0 + 20 + i * 100
        d.rectangle([bx, y0 + 20, bx + 88, y0 + 120], fill=c)
    # bouncing ball
    bx = x0 + 40 + int((x1 - x0 - 80) * (0.5 + 0.5 * math.sin(p * 6.28)))
    by = y0 + 160 + int(60 * abs(math.sin(p * 9.42)))
    d.ellipse([bx - 26, by - 26, bx + 26, by + 26], fill=(255, 255, 255), outline=accent, width=3)
    d.text((x0 + 20, y1 - 44), "test_video.mp4 · 640x480 · 30fps", font=font(20, mono=True), fill=(170, 175, 190))
    # ops grid
    ops = ["convert mkv→mp4", "resize 1280x720", "trim 30s", "speed 2x", "fade in/out", "GIF 10fps", "burn subtitles", "text overlay"]
    for i, op in enumerate(ops):
        col, row = i % 2, i // 2
        x = 660 + col * 300
        y = 210 + row * 78
        on = (i / len(ops)) < p
        d.rounded_rectangle([x, y, x + 280, y + 62], radius=12, fill=accent if on else (28, 30, 40), outline=(60, 63, 75), width=1)
        d.text((x + 16, y + 18), ("✓ " if on else "• ") + op, font=font(22, bold=True), fill=(255, 255, 255) if on else (190, 195, 210))
    # command line typing
    cmds = ["ffmpeg -i input.mkv output.mp4", "ffmpeg -i in.mp4 -vf scale=1280:720 out.mp4", "ffmpeg -i in.mp4 -vf fps=10,scale=320:-1 out.gif"]
    ci = min(len(cmds) - 1, int(p * len(cmds)))
    d.rounded_rectangle([80, 540, w - 80, 650], radius=14, fill=(10, 12, 16), outline=(50, 53, 66), width=2)
    d.text((108, 556), "$ " + cmds[ci], font=font(24, mono=True), fill=(220, 225, 235))


def demo_shorts(img, d, p, w, h, accent):
    # vertical 720x1280 layout: stacked top-to-bottom
    d.text((60, 130), "Longform → Short", font=font(36, bold=True), fill=(255, 255, 255))
    # longform box (full width)
    d.rounded_rectangle([60, 190, 660, 350], radius=14, fill=(28, 30, 40), outline=(60, 63, 75), width=2)
    d.text((80, 208), "LONG VIDEO · 45 min podcast", font=font(22, bold=True), fill=(200, 205, 220))
    for i in range(52):
        hh = 14 + int(36 * abs(math.sin(i * 1.3 + p * 8)))
        d.rectangle([80 + i * 11, 300 - hh, 86 + i * 11, 300], fill=accent)
    d.text((80, 312), "transcribe (faster-whisper)", font=font(16, mono=True), fill=(140, 145, 160))
    # arrow down
    d.text((330, 356), "↓", font=font(40, bold=True), fill=accent)
    # vertical short box (centered)
    d.rounded_rectangle([200, 410, 520, 790], radius=18, fill=(15, 17, 25), outline=accent, width=3)
    d.ellipse([300, 440, 420, 560], fill=(240, 230, 220), outline=accent, width=3)
    d.text((320, 570), "speaker", font=font(18), fill=(160, 165, 180))
    words = ["This", "hook", "went", "viral", "in", "24h"]
    cur = int(p * len(words)) % (len(words) + 1)
    x, y = 220, 620
    for i, wd in enumerate(words):
        fnt = font(28, bold=True)
        tw, th = text_size(d, wd, fnt)
        if x + tw > 500:
            x = 220
            y += 42
        col = (255, 215, 0) if i < cur else (255, 255, 255)
        d.text((x, y), wd, font=fnt, fill=col)
        x += tw + 12
    d.rectangle([220, 730, 500, 742], fill=(40, 42, 52))
    d.rectangle([220, 730, 220 + int(280 * p), 742], fill=accent)
    d.text((220, 748), "1080x1920 · Bold captions", font=font(16, mono=True), fill=(140, 145, 160))
    # scoring panel below
    d.text((60, 820), "AI segment scoring", font=font(26, bold=True), fill=(255, 255, 255))
    scores = [("Hook strength", 0.95), ("Coherence", 0.88), ("Emotion", 0.91), ("Value density", 0.84), ("Payoff", 0.90)]
    y = 860
    for label, sc in scores:
        d.text((60, y), label, font=font(20), fill=(200, 205, 220))
        d.rectangle([240, y + 4, 520, y + 20], fill=(40, 42, 52))
        d.rectangle([240, y + 4, 240 + int(280 * sc * ease_out(clamp01(p * 1.5))), y + 20], fill=accent)
        d.text((530, y), f"{sc:.2f}", font=font(20, mono=True), fill=(255, 255, 255))
        y += 36
    d.text((60, y + 8), "Claude reads the transcript — no keyword hacks.", font=font(18), fill=(150, 155, 170))


def demo_motionclone(img, d, p, w, h, accent):
    d.text((80, 150), "Reference motion → new content (no training)", font=font(30, bold=True), fill=(255, 255, 255))
    # trajectory
    x0, x1 = 120, w - 120
    base_y = 480
    def traj(t):
        x = lerp(x0, x1, t)
        y = base_y - 180 * math.sin(math.pi * t) ** 1.2 - 40 * math.sin(t * 12.56)
        return x, y
    # path
    pts = [traj(i / 60) for i in range(61)]
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=(70, 75, 90), width=3)
    # reference ball (left phase) + cloned star (right phase) — show both following same path
    # split: first half reference, second half clone
    t_ref = clamp01(p * 2)
    t_clone = clamp01(p * 2 - 1)
    # reference ball
    if p < 0.55:
        x, y = traj(t_ref)
        d.ellipse([x - 30, y - 30, x + 30, y + 30], fill=(59, 130, 246), outline=(255, 255, 255), width=3)
        d.text((x - 40, y + 38), "reference", font=font(20, bold=True), fill=(255, 255, 255))
    # cloned star
    if p >= 0.45:
        x, y = traj(t_clone if p >= 0.5 else t_ref)
        # star
        import math as _m
        cx, cy, R = x, y, 34
        star = []
        for k in range(10):
            ang = -_m.pi / 2 + k * _m.pi / 5
            rr = R if k % 2 == 0 else R * 0.45
            star.append((cx + rr * _m.cos(ang), cy + rr * _m.sin(ang)))
        d.polygon(star, fill=accent, outline=(255, 255, 255))
        d.text((x - 30, y + 38), "cloned star", font=font(20, bold=True), fill=(255, 255, 255))
    # sparse attention dots
    d.text((80, 560), "Sparse temporal attention = motion representation", font=font(24, bold=True), fill=(255, 255, 255))
    for i in range(12):
        x = 80 + i * 96
        on = (i / 12) < p
        d.ellipse([x, 600, x + 18, 618], fill=accent if on else (50, 53, 66))
    d.text((80, 630), "One denoising step · no inversion · camera + object motion", font=font(20), fill=(170, 175, 190))


def demo_motion(img, d, p, w, h, accent):
    d.text((80, 150), "Kinetic type + data-viz (deliver-and-verify)", font=font(30, bold=True), fill=(255, 255, 255))
    # kinetic words
    words = ["MOTION", "IS", "TIMING"]
    for i, wd in enumerate(words):
        # scale in staggered
        pp = ease_out(clamp01((p * 1.4 - i * 0.25)))
        if pp <= 0:
            continue
        fnt = font(int(28 + 52 * pp), bold=True)
        tw, th = text_size(d, wd, fnt)
        x = 80 + i * 380
        y = 210 + int((1 - pp) * 40)
        d.rounded_rectangle([x - 16, y - 10, x + tw + 16, y + th + 18], radius=14, fill=accent if i == 1 else (28, 30, 40), outline=(60, 63, 75), width=1)
        d.text((x, y), wd, font=fnt, fill=(255, 255, 255))
    # easing curve
    d.rounded_rectangle([80, 340, 620, 560], radius=16, fill=(15, 17, 25), outline=(60, 63, 75), width=2)
    d.text((100, 356), "easing: easeOutCubic", font=font(20, mono=True), fill=(170, 175, 190))
    pts = []
    for i in range(41):
        t = i / 40
        x = 120 + t * 440
        y = 520 - ease_out(t) * 140
        pts.append((x, y))
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=accent, width=4)
    # moving dot on curve
    t = p
    x = 120 + t * 440
    y = 520 - ease_out(t) * 140
    d.ellipse([x - 12, y - 12, x + 12, y + 12], fill=(255, 255, 255), outline=accent, width=3)
    # chart race bars
    d.text((660, 356), "chart race", font=font(22, bold=True), fill=(255, 255, 255))
    data = [("A", 0.9), ("B", 0.7), ("C", 0.55), ("D", 0.4)]
    y = 390
    for label, val in data:
        d.text((660, y), label, font=font(22, bold=True), fill=(200, 205, 220))
        d.rectangle([700, y + 4, 1120, y + 26], fill=(40, 42, 52))
        d.rectangle([700, y + 4, 700 + int(420 * val * ease_out(clamp01(p * 1.3))), y + 26], fill=accent)
        y += 40
    d.text((660, y + 8), "render → screenshot → check ✓", font=font(20, mono=True), fill=(150, 155, 170))


def demo_ytdlp(img, d, p, w, h, accent):
    d.text((80, 150), "URL in → best file out", font=font(34, bold=True), fill=(255, 255, 255))
    # terminal
    d.rounded_rectangle([80, 210, w - 80, 470], radius=16, fill=(10, 12, 16), outline=(50, 53, 66), width=2)
    lines = [
        "$ yt-dlp https://youtu.be/VIDEO_ID",
        "[info] VIDEO_ID: Extracting information",
        "[info] Available formats for VIDEO_ID:",
        "  137  mp4 1080p   video-only",
        "  140  m4a 128k    audio-only",
        "  22   mp4 720p    combined",
        "[download] 100% of  48.2 MiB in 00:12",
        "[Merger] Merging formats into \"video.mp4\"",
        "✓ Saved: video.mp4  (1080p + 128k audio)",
    ]
    y = 232
    f = font(22, mono=True)
    show = int(p * len(lines)) + 1
    for i, ln in enumerate(lines):
        if i >= show:
            break
        col = (255, 255, 255) if i == len(lines) - 1 else (200, 205, 220)
        if ln.startswith("[download]"):
            col = accent
        d.text((108, y), ln, font=f, fill=col)
        y += 26
    # progress bar
    d.text((80, 500), "download progress", font=font(22, bold=True), fill=(255, 255, 255))
    d.rectangle([80, 534, w - 80, 562], fill=(40, 42, 52))
    d.rectangle([80, 534, 80 + int((w - 160) * p), 562], fill=accent)
    d.text((80, 570), f"{int(p*100)}%  ·  48.2 MiB  ·  merge + subs + metadata", font=font(20, mono=True), fill=(170, 175, 190))
    # format pills
    fmts = ["1080p mp4", "720p", "audio mp3", "subtitles srt", "thumbnail", "playlist"]
    for i, fm in enumerate(fmts):
        x = 80 + i * 200
        on = (i / len(fmts)) < p
        d.rounded_rectangle([x, 620, x + 180, 664], radius=12, fill=accent if on else (28, 30, 40), outline=(60, 63, 75), width=1)
        d.text((x + 14, 632), fm, font=font(20, bold=True), fill=(255, 255, 255) if on else (190, 195, 210))


def demo_whisper(img, d, p, w, h, accent):
    d.text((80, 150), "Audio in → text out (99 languages)", font=font(34, bold=True), fill=(255, 255, 255))
    # waveform
    d.rounded_rectangle([80, 210, w - 80, 360], radius=16, fill=(15, 17, 25), outline=(60, 63, 75), width=2)
    d.text((108, 224), "audio.mp3 — waveform", font=font(20, mono=True), fill=(170, 175, 190))
    mid = 305
    for i in range(90):
        x = 108 + i * 12
        amp = abs(math.sin(i * 0.35 + p * 10)) * 42 + 8
        # reveal left to right
        if (i / 90) > p:
            col = (50, 53, 66)
        else:
            col = accent
        d.line([(x, mid - amp), (x, mid + amp)], fill=col, width=4)
    # transcript
    d.text((80, 390), "transcript (word timestamps)", font=font(24, bold=True), fill=(255, 255, 255))
    text = "Hello world, this is Whisper transcribing speech to text."
    words = text.split()
    x, y = 80, 430
    cur = int(p * len(words))
    for i, wd in enumerate(words):
        fnt = font(28, bold=True)
        tw, th = text_size(d, wd, fnt)
        if x + tw > w - 80:
            x = 80
            y += 40
        col = (255, 255, 255) if i < cur else (70, 75, 90)
        d.text((x, y), wd, font=fnt, fill=col)
        x += tw + 14
    # model table
    d.text((80, 530), "models: tiny 39M · base 74M · small 244M · medium 769M · large 1550M · turbo 809M", font=font(20, mono=True), fill=(170, 175, 190))
    d.text((80, 562), "tasks: transcribe · translate · language-ID · VAD", font=font(20, mono=True), fill=(170, 175, 190))
    d.text((80, 600), "680k hours training · Transformer seq2seq · tiktoken", font=font(20), fill=(150, 155, 170))


def demo_awesome(img, d, p, w, h, accent):
    d.text((80, 150), "548 repos · graded · tested", font=font(34, bold=True), fill=(255, 255, 255))
    cats = [("Frameworks", "97"), ("Promo & demos", "98"), ("Explainers", "96"), ("Avatars", "80"), ("Editing", "90"), ("Motion gfx", "87")]
    for i, (name, cnt) in enumerate(cats):
        col, row = i % 3, i // 3
        x = 80 + col * 400
        y = 210 + row * 130
        on = (i / len(cats)) < p
        d.rounded_rectangle([x, y, x + 360, y + 110], radius=16, fill=accent if on else (28, 30, 40), outline=(60, 63, 75), width=1)
        d.text((x + 20, y + 18), name, font=font(26, bold=True), fill=(255, 255, 255))
        d.text((x + 20, y + 56), f"{cnt} repos", font=font(22), fill=(255, 255, 255) if on else (170, 175, 190))
    # podium
    d.text((80, 490), "Top 3 from the 16-skill test", font=font(26, bold=True), fill=(255, 255, 255))
    picks = [("1 explainroo", "film in ~2 min"), ("2 onetake", "one continuous shot"), ("3 remotion/skills", "render in 4.5 min")]
    for i, (a, b) in enumerate(picks):
        x = 80 + i * 400
        on = (i / 3) < clamp01((p - 0.5) * 2)
        d.rounded_rectangle([x, 530, x + 360, 620], radius=14, fill=(15, 17, 25), outline=accent if on else (60, 63, 75), width=2)
        d.text((x + 20, 546), a, font=font(24, bold=True), fill=(255, 255, 255))
        d.text((x + 20, 580), b, font=font(20), fill=(170, 175, 190))
    d.text((80, 640), "agentskillshub.top/best/claude-video-skills · refreshed every 8h", font=font(20, mono=True), fill=(150, 155, 170))


def _rot_y(x, y, z, a):
    c, s = math.cos(a), math.sin(a)
    return x * c + z * s, y, -x * s + z * c

def _rot_x(x, y, z, a):
    c, s = math.cos(a), math.sin(a)
    return x, y * c - z * s, y * s + z * c

def demo_threejs(img, d, p, w, h, accent):
    d.text((80, 150), "WebGLRenderer · r186 · 60 fps", font=font(30, bold=True), fill=(255, 255, 255))
    # viewport
    vx0, vy0, vx1, vy1 = 80, 210, 760, 620
    d.rounded_rectangle([vx0, vy0, vx1, vy1], radius=16, fill=(8, 9, 12), outline=accent, width=2)
    cx, cy = (vx0 + vx1) // 2, (vy0 + vy1) // 2
    ang = p * math.pi * 4
    # cube vertices
    s = 110
    verts = [(x, y, z) for x in (-s, s) for y in (-s, s) for z in (-s, s)]
    proj = []
    for (x, y, z) in verts:
        x, y, z = _rot_y(x, y, z, ang)
        x, y, z = _rot_x(x, y, z, 0.5)
        # perspective
        f = 900 / (900 + z)
        proj.append((cx + x * f, cy + y * f, f))
    edges = [(0, 1), (0, 2), (0, 4), (1, 3), (1, 5), (2, 3), (2, 6), (3, 7), (4, 5), (4, 6), (5, 7), (6, 7)]
    for a, b in edges:
        d.line([proj[a][:2], proj[b][:2]], fill=accent, width=3)
    for (x, y, f) in proj:
        r = int(8 * f)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
    # torus-ish ring
    for k in range(24):
        a = k / 24 * math.pi * 2
        rx, ry = 170, 70
        x = cx + rx * math.cos(a + ang)
        y = cy + ry * math.sin(a + ang) * 0.6
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 255, 255))
    d.text((vx0 + 20, vy1 - 40), "scene · camera · renderer · animation loop", font=font(18, mono=True), fill=(140, 145, 160))
    # right panel: skills list
    d.text((800, 210), "12 skills", font=font(28, bold=True), fill=(255, 255, 255))
    skills = ["fundamentals", "geometry", "materials", "lighting", "textures", "animation", "loaders", "shaders", "post", "interaction", "performance", "R3F"]
    y = 250
    for i, sk in enumerate(skills):
        on = (i / len(skills)) < p
        d.rounded_rectangle([800, y, 1200, y + 28], radius=8, fill=accent if on else (28, 30, 40), outline=(60, 63, 75), width=1)
        d.text((814, y + 4), sk, font=font(18, mono=True), fill=(255, 255, 255) if on else (190, 195, 210))
        y += 32
    d.text((800, y + 4), "WebGPU + TSL shaders", font=font(18), fill=(150, 155, 170))


def demo_hyperframes(img, d, p, w, h, accent):
    d.text((80, 150), "HTML in → MP4 out", font=font(34, bold=True), fill=(255, 255, 255))
    # code panel
    d.rounded_rectangle([80, 210, 620, 520], radius=16, fill=(10, 12, 16), outline=(50, 53, 66), width=2)
    d.text((108, 226), "index.html", font=font(20, mono=True), fill=(140, 145, 160))
    code = [
        "<div class=\"scene\">",
        "  <h1>Launch day</h1>",
        "  <chart data=\"sales\" />",
        "  <captions>kinetic</captions>",
        "  <music>subtle</music>",
        "</div>",
    ]
    y = 262
    for i, ln in enumerate(code):
        if (i / len(code)) > p:
            break
        d.text((108, y), ln, font=font(22, mono=True), fill=(220, 225, 235))
        y += 34
    # arrow
    d.text((630, 340), "›", font=font(60, bold=True), fill=accent)
    # preview panel
    d.rounded_rectangle([680, 210, w - 80, 520], radius=16, fill=(15, 17, 25), outline=accent, width=2)
    # animated title
    pp = ease_out(clamp01(p * 1.5))
    fnt = font(int(24 + 30 * pp), bold=True)
    d.text((710, 250), "Launch day", font=fnt, fill=(255, 255, 255))
    # chart bars
    for i in range(5):
        bh = int((30 + i * 28) * ease_out(clamp01(p * 1.2 - i * 0.08)))
        x = 710 + i * 90
        d.rectangle([x, 470 - bh, x + 60, 470], fill=accent)
    d.text((710, 480), "captions · music · 1080p", font=font(18, mono=True), fill=(150, 155, 170))
    # render progress
    d.text((80, 550), "render", font=font(22, bold=True), fill=(255, 255, 255))
    d.rectangle([80, 584, w - 80, 612], fill=(40, 42, 52))
    d.rectangle([80, 584, 80 + int((w - 160) * p), 612], fill=accent)
    d.text((80, 620), "npx hyperframes render  →  my-video.mp4", font=font(20, mono=True), fill=(170, 175, 190))


DEMOS = {
    "ghost": demo_ghost, "ffmpeg": demo_ffmpeg, "shorts": demo_shorts,
    "motionclone": demo_motionclone, "motion": demo_motion, "ytdlp": demo_ytdlp,
    "whisper": demo_whisper, "awesome": demo_awesome, "threejs": demo_threejs,
    "hyperframes": demo_hyperframes,
}


def make_video(v, out_dir):
    vertical = v.get("vertical", False)
    w, h = (720, 1280) if vertical else (W, H)
    accent = hex_to_rgb(v["accent"])
    out_path = os.path.join(out_dir, v["slug"] + ".mp4")

    def frames():
        for i in range(NFRAMES):
            t = i / FPS
            if t < 3.0:
                img = scene_title(v, t, w, h)
            elif t < 8.0:
                img = scene_what(v, t - 3.0, w, h)
            elif t < 18.0:
                img = bg_gradient(w, h)
                d = ImageDraw.Draw(img)
                p = (t - 8.0) / 10.0
                DEMOS[v["demo"]](img, d, p, w, h, accent)
            elif t < 22.0:
                img = scene_code(v, t - 18.0, w, h)
            else:
                img = scene_outro(v, t - 22.0, w, h)
            d = ImageDraw.Draw(img)
            draw_header(d, w, h, v, t)
            draw_footer(d, w, h, v)
            yield img

    n = encode_frames(frames(), w, h, FPS, out_path)
    write_srt(os.path.join(out_dir, v["slug"] + ".bn.srt"), BN_SUBS[v["slug"]])
    print(f"OK {v['slug']}: {n} frames -> {out_path}")
    return out_path


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "videos")
    os.makedirs(out_dir, exist_ok=True)
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for v in VIDEOS:
        if only and only not in v["slug"] and only not in v["num"]:
            continue
        make_video(v, out_dir)
    print("DONE")


if __name__ == "__main__":
    main()

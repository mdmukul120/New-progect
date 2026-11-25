# Claude-এ আপলোডযোগ্য স্কিল জিপ (৮১টি)

Claude.ai / Claude Code-এর **Skills আপলোডে প্রতিটি জিপ ২ MB-এর কম** হতে হয় এবং
এক জিপে **একটাই স্কিল** থাকতে হয়। তাই এখানে **৮১টি আলাদা ছোট জিপ** — প্রতিটির
রুটে একটি `SKILL.md` (বৈধ `name` ও `description` সহ)।

**সবচেয়ে বড় জিপ: 1.3 MB** · মোট: 3.9 MB · করাপ্ট: ০

পূর্ণ স্কিল-তালিকা ও প্রতিটির ডাউনলোড লিংক: **[INDEX.md](INDEX.md)**

---

## ⬇️ দ্রুত ডাউনলোড (প্রধান ১০টি)

| # | স্কিল | সাইজ | ডাউনলোড |
|---|---|---|---|
| 01 | Ghost Editor | 1.3 MB | [01-ghost-editor.zip](https://github.com/mdmukul120/New-progect/raw/arena/90113f82-new-progect/all-in-one/claude-skills/01-ghost-editor.zip) |
| 02 | FFmpeg Skill | 11 KB | [02-ffmpeg-skill.zip](https://github.com/mdmukul120/New-progect/raw/arena/90113f82-new-progect/all-in-one/claude-skills/02-ffmpeg-skill.zip) |
| 03 | Claude Shorts | 125 KB | [03-claude-shorts.zip](https://github.com/mdmukul120/New-progect/raw/arena/90113f82-new-progect/all-in-one/claude-skills/03-claude-shorts.zip) |
| 05 | Motion — TikTok | — | [05-motion-tiktok-video-skills__\*.zip](https://github.com/mdmukul120/New-progect/tree/arena/90113f82-new-progect/all-in-one/claude-skills) |
| 05 | Motion — সব ৫৬টি | — | [INDEX.md](INDEX.md) দেখুন |
| 09 | Three.js — সব ১৩টি | — | [INDEX.md](INDEX.md) দেখুন |
| 10 | HyperFrames — সব ৯টি | — | [INDEX.md](INDEX.md) দেখুন |

> প্রতিটি লিংক `github.com/.../raw/...` — ক্লিক করলেই ফাইল নামবে, লগইন লাগবে না।

---

## 🚀 Claude.ai-তে আপলোড

1. উপরের তালিকা / [INDEX.md](INDEX.md) থেকে জিপ ডাউনলোড করুন
2. Claude.ai → **Settings → Capabilities → Skills → Upload skill**
3. জিপটি দিন — একবারে একটি
4. পরের জিপের জন্য আবার **Upload skill**

> **কেন ৮১টি আলাদা জিপ?** Claude.ai এক জিপে একটাই স্কিল নেয়, আর সাইজসীমা ছোট।
> একটাই বড় বান্ডেল দিলে সেটা রিজেক্ট হবে।

## 💻 Claude Code-এ এক কমান্ডে সব

```bash
git clone --branch arena/90113f82-new-progect https://github.com/mdmukul120/New-progect.git
bash New-progect/all-in-one/claude-skills/install-from-claude-zips.sh
```

বা জিপগুলো ডাউনলোড করে:

```bash
bash install-from-claude-zips.sh            # ~/.claude/skills
bash install-from-claude-zips.sh --project  # ./.claude/skills
```

যাচাই করা: **৮১/৮১ স্কিল** ইনস্টল হয়।

---

## 📋 ৮১টি স্কিল কোথা থেকে

| # | উৎস | জিপ সংখ্যা |
|---|---|---|
| 01 | Ghost Editor (`kurbaitaev/ghost-editor`) | 1 |
| 02 | FFmpeg Skill (`donghaozhang/ffmpeg-claude-skill`) | 1 |
| 03 | Claude Shorts (`AgriciDaniel/claude-shorts`) | 1 |
| 05 | Motion Skills (`iart-ai/*` ১৯ প্যাক) | 56 |
| 09 | Three.js Skills (`cloudai-x/threejs-skills`) | 13 |
| 10 | HyperFrames (`heygen-com/hyperframes`) | 9 |

**স্কিল নয় (আপলোড লাগবে না):**
MotionClone (GPU মডেল) · yt-dlp (`pip install -U yt-dlp`) ·
Whisper (`pip install -U openai-whisper`) · Awesome Claude Video Skills (রেফারেন্স লিস্ট)

---

## ✅ প্রতিটি জিপে যা যাচাই করা হয়েছে

- `SKILL.md` জিপের **রুটে** (নেস্টেড নয়)
- YAML frontmatter আছে, `name` + `description` দুটোই
- `name` lowercase-kebab (Claude-এর নিয়ম), ≤64 অক্ষর, **ডুপ্লিকেট নেই**
- ২ MB-এর কম (সবচেয়ে বড় 1.3 MB)
- `unzip -t` — কোনো করাপ্ট ফাইল নেই
- আপসোলিউট/`..` পাথ নেই

## 🗂 অন্যান্য ফাইল

| ফাইল | কী |
|---|---|
| `INDEX.md` | ৮১টি জিপের পূর্ণ তালিকা + লিংক |
| `install-from-claude-zips.sh` | সব জিপ একসাথে ইনস্টল করার স্ক্রিপ্ট |
| `_all-81-skills-one-zip.zip` | সব জিপ এক ফাইলে (4 MB) — **ব্যাকআপ/শেয়ারিংয়ের জন্য, Claude-এ আপলোড হবে না** |

## ⚖️ লাইসেন্স

MIT (ghost-editor, claude-shorts, threejs-skills, motion packs) ·
Apache-2.0 (hyperframes) · ffmpeg-claude-skill: লাইসেন্স ফাইল নেই।
স্কিলের কনটেন্ট অপরিবর্তিত — শুধু সাইজ কমানো হয়েছে (বড় অডিও/ফন্ট বাদ)।

> বড় বান্ডেল (`../skills/all-skills-for-claude.zip`, 12 MB) লোকাল ফোল্ডারে
> (Claude Code / Cursor) একসাথে কপি করার জন্য — Claude.ai-তে আপলোড হবে না।

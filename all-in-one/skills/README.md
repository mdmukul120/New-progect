# সব স্কিল এক জায়গায় (Claude-এর জন্য)


> ⚠️ **Claude.ai-তে আপলোড করবেন?** এই 12 MB বান্ডেল Claude.ai নেবে না (২ MB সীমা)।
> Claude.ai-এর জন্য **[`../claude-skills/`](../claude-skills/)** ফোল্ডারে **৮১টি আলাদা
> ছোট জিপ (সবচেয়ে বড় 1.3 MB)** রাখা আছে — সেগুলো একটার পর একটা আপলোড করুন।
> এই বান্ডেলটি লোকাল ফোল্ডারে (Claude Code / Cursor) একসাথে কপি করার জন্য।

## ⬇️ ডাউনলোড

**[all-skills-for-claude.zip](all-skills-for-claude.zip)** — 12.2 MB · **৮১টি `SKILL.md`**

SHA-256: `1a537d0cb855d89a61796a59474f453cf953eb22ae22de47908a367edc5cfd8b`

সরাসরি ডাউনলোড লিংক:

```
https://github.com/mdmukul120/New-progect/raw/arena/90113f82-new-progect/all-in-one/skills/all-skills-for-claude.zip
```

---

## 🚀 ৩ ধাপে Claude-এ ইনস্টল

```bash
# ১ — ডাউনলোড
curl -L -o all-skills-for-claude.zip \
  https://github.com/mdmukul120/New-progect/raw/arena/90113f82-new-progect/all-in-one/skills/all-skills-for-claude.zip

# ২ — আনজিপ
unzip all-skills-for-claude.zip -d all-skills && cd all-skills

# ৩ — ইনস্টল
bash install-to-claude.sh
```

Claude Code বন্ধ করে আবার খুলুন — ব্যস। জিজ্ঞেস করুন: *"which skills do you have?"*

### অন্য জায়গায় ইনস্টল

```bash
bash install-to-claude.sh --project        # এই প্রজেক্টের .claude/skills/ এ
bash install-to-claude.sh /custom/path     # নিজের মতো পাথে
```

---

## 📦 ভেতরে কী আছে

| # | স্কিল | স্কিল সংখ্যা | ফোল্ডার |
|---|---|---|---|
| 01 | Ghost Editor | 1 | `skills/ghost-editor/` |
| 02 | FFmpeg Skill | 1 | `skills/ffmpeg-skill/` |
| 03 | Claude Shorts | 1 | `skills/claude-shorts/` |
| 04 | MotionClone | — (টুল) | `tools/04_motionclone_README.md` |
| 05 | Motion Skills | **56** | `skills/motion/<pack>/<skill>/` |
| 06 | yt-dlp | — (CLI) | `tools/` |
| 07 | Whisper | — (CLI) | `tools/` |
| 08 | Awesome Claude Video Skills | — (রেফারেন্স) | `tools/08_...README.md` |
| 09 | Three.js Skills | **13** | `skills/threejs/` |
| 10 | HyperFrames | **9** | `skills/hyperframes/` |

**মোট ৮১টি স্কিল** + ৪টি টুল/রেফারেন্স।

পূর্ণ তালিকা: `MANIFEST.txt` (বান্ডেলের ভেতরে)।

---

## 🧪 যাচাই করা হয়েছে

- জিপ ইন্টিগ্রিটি: `unzip -t` → **No errors detected**
- ইনস্টলার টেস্ট: খালি ফোল্ডারে চালিয়ে **৮১/৮১ স্কিল** ইনস্টল হয়েছে
- সবগুলো রিপো আসল GitHub থেকে ক্লোন করা, **কোনো বানানো কনটেন্ট নেই**

---

## ⚠️ স্কিল নয় যেগুলো

- **yt-dlp**, **Whisper** — এগুলো Python CLI, `.claude/skills`-এ রাখার জিনিস নয়।
  `pip install -U yt-dlp openai-whisper` করলেই হয়।
- **MotionClone** — GPU + Stable Diffusion মডেল লাগে। `tools/04_motionclone_README.md` দেখুন।
- **Awesome Claude Video Skills** — শুধু রেফারেন্স লিস্ট (৫৪৮টি রিপো)। ইনস্টল লাগে না।

---

## 🔁 zip ছাড়া সরাসরি ক্লোন করে ইনস্টল

```bash
bash install-all-skills.sh
```

এটি GitHub থেকে সরাসরি সব রিপো ক্লোন করে ইনস্টল করে (ইন্টারনেট লাগবে)।

---

## ⚖️ লাইসেন্স

| রিপো | লাইসেন্স |
|---|---|
| ghost-editor, claude-shorts, threejs-skills, motion packs | MIT |
| hyperframes | Apache-2.0 |
| ffmpeg-claude-skill | লাইসেন্স ফাইল নেই (পাবলিক) |

প্রতিটি ফোল্ডারে মূল রিপোর README `_README.repo.md` হিসেবে আছে।
কোনো ফাইল পরিবর্তন করা হয়নি — শুধু সাজিয়ে একসাথে করা হয়েছে।

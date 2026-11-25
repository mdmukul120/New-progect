# সব স্কিল এক ফোল্ডারে

এই ফোল্ডারে ১০টি স্কিল একসাথে ইনস্টল করার নির্দেশ আছে।
Claude Code / Cursor / Codex-এ স্কিলগুলো `~/.claude/skills/` বা
প্রজেক্টের `.claude/skills/` ফোল্ডারে রাখলেই অটো-ডিসকভার হয়।

## এক লাইনে সব ইনস্টল (skills.sh CLI থাকলে)

```bash
npx skills add kurbaitaev/ghost-editor
npx skills add donghaozhang/ffmpeg-claude-skill
npx skills add AgriciDaniel/claude-shorts
npx skills add iart-ai/motion-skills
npx skills add cloudai-x/threejs-skills
npx skills add heygen-com/hyperframes
# yt-dlp, Whisper, MotionClone আলাদা ইনস্টল (নিচে দেখুন)
```

## ম্যানুয়াল (git clone)

```bash
mkdir -p ~/.claude/skills
cd ~/.claude/skills
git clone https://github.com/kurbaitaev/ghost-editor
git clone https://github.com/donghaozhang/ffmpeg-claude-skill
git clone https://github.com/AgriciDaniel/claude-shorts
git clone https://github.com/iart-ai/motion-skills
git clone https://github.com/cloudai-x/threejs-skills
git clone https://github.com/heygen-com/hyperframes
```

## টুল (স্কিল নয়, CLI)

```bash
pip install yt-dlp openai-whisper   # yt-dlp + Whisper
# FFmpeg সিস্টেমে লাগবে: sudo apt install ffmpeg (Ubuntu/Debian)
# MotionClone: GPU + Stable Diffusion মডেল লাগবে (README দেখুন)
# Awesome list: শুধু রেফারেন্স — https://github.com/zhuyansen/awesome-claude-video-skills
```

অটো ইনস্টল স্ক্রিপ্ট: `./install-all-skills.sh`

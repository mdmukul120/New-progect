#!/usr/bin/env bash
# Install all 10 skills/tools in one go. Safe to re-run.
set -e
DEST="${1:-$HOME/.claude/skills}"
mkdir -p "$DEST"
cd "$DEST"

clone() {
  local url="$1" dir="$2"
  if [ -d "$dir" ]; then echo "skip (exists): $dir"; else git clone --depth 1 "$url" "$dir"; fi
}

echo "== Claude Code skills =="
clone https://github.com/kurbaitaev/ghost-editor ghost-editor
clone https://github.com/donghaozhang/ffmpeg-claude-skill ffmpeg-claude-skill
clone https://github.com/AgriciDaniel/claude-shorts claude-shorts
clone https://github.com/iart-ai/motion-skills motion-skills
clone https://github.com/cloudai-x/threejs-skills threejs-skills
clone https://github.com/heygen-com/hyperframes hyperframes

echo "== Python tools =="
pip install --upgrade yt-dlp openai-whisper || pip3 install --upgrade yt-dlp openai-whisper

echo "== Reference (no install needed) =="
echo "MotionClone: https://github.com/LPengYang/MotionClone (needs GPU + SD models)"
echo "Awesome list: https://github.com/zhuyansen/awesome-claude-video-skills"

echo "Done. Restart Claude Code to pick up the skills."

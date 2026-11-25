#!/usr/bin/env bash
# সব ১০টি স্কিল একসাথে ইনস্টল করার স্ক্রিপ্ট
# সবচেয়ে সহজ: all-skills-for-claude.zip ডাউনলোড করে আনজিপ → bash install-to-claude.sh
#
# এই স্ক্রিপ্টটি সরাসরি GitHub থেকে ক্লোন করে ইনস্টল করে (zip ছাড়া)।
set -u
DEST="${1:-$HOME/.claude/skills}"
mkdir -p "$DEST"
echo "Installing into: $DEST"
echo

clone() {
  local url="$1" dir="$2"
  if [ -d "$DEST/$dir" ]; then echo "  ↻ skip (exists): $dir"; else
    git clone --depth 1 -q "$url" "$DEST/$dir" && echo "  + $dir"
  fi
}

echo "== 01 Ghost Editor =="
clone https://github.com/kurbaitaev/ghost-editor ghost-editor

echo "== 02 FFmpeg Skill =="
clone https://github.com/donghaozhang/ffmpeg-claude-skill ffmpeg-skill
# এই রিপোতে স্কিলটা .claude/skills/ffmpeg-skill-এ থাকে — সরিয়ে আনি
if [ -d "$DEST/ffmpeg-skill/.claude/skills/ffmpeg-skill" ] && [ ! -f "$DEST/ffmpeg-skill/SKILL.md" ]; then
  cp -r "$DEST/ffmpeg-skill/.claude/skills/ffmpeg-skill/." "$DEST/ffmpeg-skill/"
  [ -f "$DEST/ffmpeg-skill/Skill.md" ] && mv "$DEST/ffmpeg-skill/Skill.md" "$DEST/ffmpeg-skill/SKILL.md"
  echo "  ↪ ffmpeg-skill flattened"
fi

echo "== 03 Claude Shorts =="
clone https://github.com/AgriciDaniel/claude-shorts claude-shorts

echo "== 09 Three.js Skills (13) =="
clone https://github.com/cloudai-x/threejs-skills _threejs-repo
if [ -d "$DEST/_threejs-repo/skills" ]; then
  for d in "$DEST"/_threejs-repo/skills/*/; do
    [ -f "$d/SKILL.md" ] && cp -r "$d" "$DEST/$(basename "$d")"
  done
  rm -rf "$DEST/_threejs-repo"; echo "  + 13 threejs skills"
fi

echo "== 10 HyperFrames (9) =="
clone https://github.com/heygen-com/hyperframes _hyperframes-repo
if [ -d "$DEST/_hyperframes-repo/skills" ]; then
  for d in "$DEST"/_hyperframes-repo/skills/*/; do
    [ -f "$d/SKILL.md" ] && cp -r "$d" "$DEST/hyperframes__$(basename "$d")"
  done
  rm -rf "$DEST/_hyperframes-repo"; echo "  + 9 hyperframes skills"
fi

echo "== 05 Motion Skills (56 across 19 packs) =="
for p in tiktok-video-skills text-message-video-skills youtube-video-skills \
         ecommerce-video-skills ad-video-skills data-animation-skills \
         explainer-video-skills map-animation-skills web-animation-skills \
         motion-design-skills kinetic-typography-skills freelance-motion-skills \
         webgl-animation-skills manim-skills generative-illustration-skills \
         javascript-animation-skills lower-thirds-skills b-roll-skills talking-head-skills; do
  clone https://github.com/iart-ai/$p.git "_pack-$p"
  if [ -d "$DEST/_pack-$p/skills" ]; then
    for d in "$DEST"/_pack-$p/skills/*/; do
      [ -f "$d/SKILL.md" ] && cp -r "$d" "$DEST/${p}__$(basename "$d")"
    done
  fi
  rm -rf "$DEST/_pack-$p"
done
echo "  + motion skills done"

echo "== Tools =="
python3 -m pip install --upgrade yt-dlp openai-whisper 2>/dev/null \
  || python3 -m pip install --upgrade --break-system-packages yt-dlp openai-whisper \
  || echo "  ! pip install failed — নিজে করুন: pip install -U yt-dlp openai-whisper"

echo
echo "=========================================="
echo " installed SKILL.md count: $(find "$DEST" -iname SKILL.md 2>/dev/null | wc -l)"
echo "=========================================="
echo
echo "Claude Code বন্ধ করে আবার খুলুন, তারপর জিজ্ঞেস করুন:"
echo "  which skills do you have?"
echo
echo "বিঃদ্রঃ beste ফলাফলের জন্য all-skills-for-claude.zip বান্ডেলটি ব্যবহার করুন —"
echo "সেখানে সব স্কিল আগে থেকেই সাজানো আছে।"

#!/usr/bin/env bash
# এই ফোল্ডারের ৮১টি স্কিল-জিপ আনজিপ করে ~/.claude/skills/ এ ইনস্টল করে
# ব্যবহার:
#   bash install-from-claude-zips.sh              -> ~/.claude/skills
#   bash install-from-claude-zips.sh --project    -> ./.claude/skills
#   bash install-from-claude-zips.sh /custom/dir   -> নিজের পাথ
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-}" in
  --project) DEST="$(pwd)/.claude/skills" ;;
  "")        DEST="$HOME/.claude/skills" ;;
  *)         DEST="$1" ;;
esac

command -v unzip >/dev/null || { echo "!! unzip লাগবে"; exit 1; }
mkdir -p "$DEST"

echo "Source : $HERE"
echo "Target : $DEST"
echo

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

n=0
for z in "$HERE"/*.zip; do
  case "$(basename "$z")" in _all-*) continue ;; esac   # skip the combined archive
  rm -rf "$tmp/x"; mkdir -p "$tmp/x"
  if ! unzip -qq -o "$z" -d "$tmp/x"; then
    echo "  !! corrupted: $(basename "$z")"; continue
  fi
  if [ ! -f "$tmp/x/SKILL.md" ]; then
    echo "  !! no SKILL.md: $(basename "$z")"; continue
  fi
  name=$(basename "$z" .zip)
  rm -rf "$DEST/$name"
  cp -r "$tmp/x" "$DEST/$name"
  n=$((n+1))
done

echo
echo "==============================="
echo " ✅ $n skills installed"
echo "==============================="
echo
echo "Claude Code বন্ধ করে আবার খুলুন, তারপর জিজ্ঞেস করুন:"
echo "  which skills do you have?"

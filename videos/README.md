# ১০টি স্কিলের ১০টি ভিডিও

ছবির ১০টি GitHub লিংকের প্রতিটির জন্য আলাদা ভিডিও তৈরি করা হয়েছে।
প্রতিটি ভিডিও ~২৪ সেকেন্ড, ৩০fps। ভিডিওর ভেতরের লেখা ইংরেজি
(প্রযুক্তিগত শব্দ ইংরেজিতেই থাকে), আর প্রতিটি ভিডিওর পাশে
বাংলা সাবটাইটেল ফাইল (`*.bn.srt`) আছে — ভিডিও প্লেয়ারে
সাবটাইটেল হিসেবে চালু করলেই বাংলা দেখা যাবে।

## ভিডিও তালিকা

| # | স্কিল | ভিডিও | সাবটাইটেল | GitHub |
|---|---|---|---|---|
| 01 | Ghost Editor | [01_ghost-editor.mp4](01_ghost-editor.mp4) | [bn.srt](01_ghost-editor.bn.srt) | https://github.com/kurbaitaev/ghost-editor |
| 02 | FFmpeg Skill | [02_ffmpeg-skill.mp4](02_ffmpeg-skill.mp4) | [bn.srt](02_ffmpeg-skill.bn.srt) | https://github.com/donghaozhang/ffmpeg-claude-skill |
| 03 | Claude Shorts (ভার্টিকাল ৯:১৬) | [03_claude-shorts.mp4](03_claude-shorts.mp4) | [bn.srt](03_claude-shorts.bn.srt) | https://github.com/AgriciDaniel/claude-shorts |
| 04 | MotionClone | [04_motionclone.mp4](04_motionclone.mp4) | [bn.srt](04_motionclone.bn.srt) | https://github.com/LPengYang/MotionClone |
| 05 | Motion Skills | [05_motion-skills.mp4](05_motion-skills.mp4) | [bn.srt](05_motion-skills.bn.srt) | https://github.com/iart-ai/motion-skills |
| 06 | yt-dlp | [06_yt-dlp.mp4](06_yt-dlp.mp4) | [bn.srt](06_yt-dlp.bn.srt) | https://github.com/yt-dlp/yt-dlp |
| 07 | Whisper | [07_whisper.mp4](07_whisper.mp4) | [bn.srt](07_whisper.bn.srt) | https://github.com/openai/whisper |
| 08 | Awesome Claude Video Skills | [08_awesome-claude-video-skills.mp4](08_awesome-claude-video-skills.mp4) | [bn.srt](08_awesome-claude-video-skills.bn.srt) | https://github.com/zhuyansen/awesome-claude-video-skills |
| 09 | Three.js Skills | [09_threejs-skills.mp4](09_threejs-skills.mp4) | [bn.srt](09_threejs-skills.bn.srt) | https://github.com/cloudai-x/threejs-skills |
| 10 | HyperFrames | [10_hyperframes.mp4](10_hyperframes.mp4) | [bn.srt](10_hyperframes.bn.srt) | https://github.com/heygen-com/hyperframes |

## প্রতিটি ভিডিওতে যা আছে

1. **টাইটেল** — স্কিলের নাম, GitHub লিংক, স্টার, ভাষা
2. **কী করে** — ৩টি মূল পয়েন্ট
3. **লাইভ ডেমো** — স্কিলটির মূল কাজের অ্যানিমেশন
   (যেমন: Ghost Editor-এর পাইপলাইন, FFmpeg-এর রূপান্তর,
   Claude Shorts-এর ১৬:৯ → ৯:১৬ ক্রপ, MotionClone-এর মোশন ক্লোন,
   Three.js-এর ঘূর্ণায়মান 3D কিউব, HyperFrames-এর HTML → MP4)
4. **নিজে চেষ্টা করুন** — কপি করার মতো আসল কমান্ড
5. **আউট্রো** — GitHub লিংক

## কীভাবে দেখবেন

- যেকোনো ভিডিও প্লেয়ারে (VLC, YouTube, ব্রাউজার) MP4 খুলুন।
- বাংলা দেখতে: একই নামের `.bn.srt` ফাইলটি সাবটাইটেল হিসেবে
  যোগ করুন (VLC: Subtitle → Add Subtitle File)।
- ০৩ নম্বর ভিডিওটি ভার্টিকাল (720×1280) — মোবাইলে ভালো দেখাবে।
  বাকিগুলো 1280×720।

## আসল ডেমো ফাইল

ভিডিওর পাশাপাশি কিছু স্কিলের আসল ডেমোও রাখা আছে:

- `../demos/ffmpeg/` — আসল ffmpeg দিয়ে বানানো ৮টি আউটপুট
  (রিসাইজ, GIF, ট্রিম, ২× স্পিড, ফেড, টেক্সট ওভারলে…)
- `../demos/yt-dlp/` — আসল yt-dlp (ভার্সন 2026.11.23, ১৭৫২ এক্সট্রাক্টর)
- `../demos/whisper/` — Whisper-এর জন্য ১৬kHz ডেমো অডিও
- `../demos/threejs/threejs-demo.html` — ব্রাউজারে খোলার মতো
  আসল Three.js r186 সিন
- `../demos/hyperframes/index.html` — HyperFrames কম্পোজিশন

## ভিডিওগুলো কীভাবে বানানো হলো

`../video_factory/` ফোল্ডারে Python + Pillow দিয়ে ফ্রেম রেন্ডার
করে ffmpeg (H.264) দিয়ে এনকোড করা হয়েছে। আবার বানাতে:

```bash
pip install pillow numpy matplotlib imageio imageio-ffmpeg
python3 video_factory/make_all.py        # সব ১০টি
python3 video_factory/make_all.py 01     # শুধু ০১ নম্বর
```

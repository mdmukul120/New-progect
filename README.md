# New-progect — 10 AI Video Skills, 10 Videos

ছবির ১০টি GitHub লিংকের প্রতিটি স্কিল আয়ত্ত করে প্রতিটির জন্য
আলাদা ভিডিও তৈরি করা হয়েছে।

## ভিডিও

**[videos/](videos/README.md)** — ১০টি MP4 + বাংলা সাবটাইটেল (`.bn.srt`)

| # | স্কিল | ভিডিও |
|---|---|---|
| 01 | Ghost Editor | [videos/01_ghost-editor.mp4](videos/01_ghost-editor.mp4) |
| 02 | FFmpeg Skill | [videos/02_ffmpeg-skill.mp4](videos/02_ffmpeg-skill.mp4) |
| 03 | Claude Shorts (9:16) | [videos/03_claude-shorts.mp4](videos/03_claude-shorts.mp4) |
| 04 | MotionClone | [videos/04_motionclone.mp4](videos/04_motionclone.mp4) |
| 05 | Motion Skills | [videos/05_motion-skills.mp4](videos/05_motion-skills.mp4) |
| 06 | yt-dlp | [videos/06_yt-dlp.mp4](videos/06_yt-dlp.mp4) |
| 07 | Whisper | [videos/07_whisper.mp4](videos/07_whisper.mp4) |
| 08 | Awesome Claude Video Skills | [videos/08_awesome-claude-video-skills.mp4](videos/08_awesome-claude-video-skills.mp4) |
| 09 | Three.js Skills | [videos/09_threejs-skills.mp4](videos/09_threejs-skills.mp4) |
| 10 | HyperFrames | [videos/10_hyperframes.mp4](videos/10_hyperframes.mp4) |

## আসল ডেমো

- [demos/ffmpeg/](demos/ffmpeg/README.md) — আসল ffmpeg আউটপুট (৮টি ফাইল)
- [demos/yt-dlp/](demos/yt-dlp/README.md) — আসল yt-dlp যাচাই
- [demos/whisper/](demos/whisper/README.md) — ডেমো অডিও + কমান্ড
- [demos/threejs/threejs-demo.html](demos/threejs/threejs-demo.html) — রানযোগ্য Three.js সিন
- [demos/hyperframes/index.html](demos/hyperframes/index.html) — HyperFrames কম্পোজিশন

## রিসার্চ

[research/](research/summary.json) — ১০টি রিপোর README ও মেটাডেটা
(GitHub API থেকে সংগ্রহ করা)।

## আবার বানানো

```bash
pip install pillow numpy matplotlib imageio imageio-ffmpeg
python3 video_factory/make_all.py
```

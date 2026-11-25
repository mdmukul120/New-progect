# FFmpeg Skill — real demo (actually run)

Repo: https://github.com/donghaozhang/ffmpeg-claude-skill

These files were generated with the real ffmpeg binary
(`imageio-ffmpeg` → ffmpeg n9.0.2) using the skill's documented commands.

## Commands run

```bash
# test video (5s, 640x480, 30fps + 440Hz tone)
ffmpeg -f lavfi -i testsrc=duration=5:size=640x480:rate=30 \
  -f lavfi -i sine=frequency=440:duration=5 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac test_video.mp4

# extract audio
ffmpeg -i test_video.mp4 -vn -c:a copy extracted_audio.aac

# resize to 320px wide
ffmpeg -i test_video.mp4 -vf scale=320:-1 resized_320.mp4

# animated GIF (10fps)
ffmpeg -i test_video.mp4 -vf "fps=10,scale=320:-1" output.gif

# trim to 2s
ffmpeg -ss 00:00:01 -i test_video.mp4 -t 00:00:02 -c copy trimmed.mp4

# 2x speed (video + audio)
ffmpeg -i test_video.mp4 -filter:v "setpts=PTS/2" -filter:a "atempo=2.0" fast_2x.mp4

# fade in/out
ffmpeg -i test_video.mp4 -vf "fade=t=in:st=0:d=1,fade=t=out:st=4:d=1" faded_video.mp4

# text overlay
ffmpeg -i test_video.mp4 -vf "drawtext=text='Hello World':fontsize=48:..." video_with_text.mp4
```

## Outputs (verified with `ffmpeg -i`)

| File | What it proves |
|---|---|
| `test_video.mp4` | 5.00s, 640x480, H.264 + AAC |
| `extracted_audio.aac` | audio-only extraction |
| `resized_320.mp4` | 320x240 (scale filter) |
| `output.gif` | 10fps GIF |
| `trimmed.mp4` | 2.10s (trim) |
| `fast_2x.mp4` | 2.57s (2x speed) |
| `faded_video.mp4` | fade in/out |
| `video_with_text.mp4` | drawtext overlay |

Watch the video demo: `videos/02_ffmpeg-skill.mp4`

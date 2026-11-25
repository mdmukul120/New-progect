# Whisper — demo audio + commands

Repo: https://github.com/openai/whisper

`demo_tone.wav` is a real 3s 16kHz mono WAV generated with ffmpeg
(sine tone) — the exact format Whisper expects. The full Whisper model
needs PyTorch + a model download (tiny 39M → large 1550M), which is
too heavy for this build sandbox, so transcription itself is shown as
an animated demo in the video. Run it on your machine:

```bash
pip install -U openai-whisper   # needs ffmpeg on PATH
whisper demo_tone.wav --model tiny   # fastest; use turbo for English
whisper audio.mp3 --model turbo
whisper japanese.wav --language Japanese
whisper japanese.wav --model medium --language Japanese --task translate
```

Python:

```python
import whisper
model = whisper.load_model("turbo")
print(model.transcribe("audio.mp3")["text"])
```

Model sizes: tiny 39M (~1GB VRAM, ~10x) · base 74M (~7x) · small 244M
(~4x) · medium 769M (~2x) · large 1550M (1x) · turbo 809M (~8x).

Watch the video demo: `videos/07_whisper.mp4`

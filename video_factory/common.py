"""Common helpers for the 10-skill video factory."""
import math
import subprocess
import os
from PIL import Image, ImageDraw, ImageFont

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG = "ffmpeg"

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_MONO_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

def font(size, bold=False, mono=False):
    if mono:
        p = FONT_MONO_BOLD if bold else FONT_MONO
    else:
        p = FONT_BOLD if bold else FONT_REG
    return ImageFont.truetype(p, size)

def ease_out(t):
    return 1 - (1 - t) ** 3

def ease_in_out(t):
    return t * t * (3 - 2 * t)

def clamp01(x):
    return max(0.0, min(1.0, x))

def lerp(a, b, t):
    return a + (b - a) * t

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rounded_rect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def text_size(draw, text, fnt):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def wrap_text(draw, text, fnt, max_width):
    words = text.split()
    lines = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        tw, _ = text_size(draw, trial, fnt)
        if tw <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def draw_wrapped(draw, text, x, y, fnt, fill, max_width, line_spacing=8, align="left"):
    lines = wrap_text(draw, text, fnt, max_width)
    cy = y
    for line in lines:
        tw, th = text_size(draw, line, fnt)
        if align == "center":
            tx = x + (max_width - tw) // 2
        elif align == "right":
            tx = x + max_width - tw
        else:
            tx = x
        draw.text((tx, cy), line, font=fnt, fill=fill)
        cy += th + line_spacing
    return cy

def bg_gradient(w, h, top=(15, 17, 21), bottom=(30, 32, 42)):
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(lerp(top[0], bottom[0], t))
        g = int(lerp(top[1], bottom[1], t))
        b = int(lerp(top[2], bottom[2], t))
        d.line([(0, y), (w, y)], fill=(r, g, b))
    return img

def encode_frames(frame_iter, width, height, fps, out_path, crf=20):
    """Pipe PIL frames to ffmpeg -> H.264 MP4."""
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    cmd = [
        FFMPEG, "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{width}x{height}", "-r", str(fps),
        "-i", "-",
        "-an",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-crf", str(crf), "-preset", "medium",
        "-movflags", "+faststart",
        out_path,
    ]
    import tempfile
    err_file = tempfile.TemporaryFile()
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=err_file)
    n = 0
    try:
        for img in frame_iter:
            if img.size != (width, height):
                img = img.resize((width, height))
            proc.stdin.write(img.tobytes())
            n += 1
    finally:
        try:
            proc.stdin.close()
        except Exception:
            pass
    proc.wait(timeout=180)
    err_file.seek(0)
    err = err_file.read()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}): {err.decode(errors='ignore')[-2000:]}")
    return n

def srt_time(sec):
    h = int(sec // 3600); m = int((sec % 3600) // 60); s = int(sec % 60); ms = int((sec % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def write_srt(path, cues):
    """cues: list of (start_sec, end_sec, text)"""
    with open(path, "w", encoding="utf-8") as f:
        for i, (a, b, t) in enumerate(cues, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{t}\n\n")

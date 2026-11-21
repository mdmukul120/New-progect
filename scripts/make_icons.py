#!/usr/bin/env python3
"""Generate NovaCut app icons (PWA + Android mipmaps)."""
import math
import os
from PIL import Image, ImageDraw

OUT_APP = "app/icons"
os.makedirs(OUT_APP, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_icon(size):
    """Rounded-square gradient icon with a white play triangle."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # gradient background (diagonal: violet -> magenta -> coral)
    c1 = (124, 92, 255)   # violet
    c2 = (201, 77, 255)   # magenta
    c3 = (255, 92, 138)   # pink
    for y in range(size):
        for_x_steps = 1
        t = y / max(1, size - 1)
        if t < 0.5:
            col = lerp(c1, c2, t * 2)
        else:
            col = lerp(c2, c3, (t - 0.5) * 2)
        draw.line([(0, y), (size, y)], fill=col + (255,))

    # rounded mask
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    radius = int(size * 0.22)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.putalpha(mask)

    # play triangle (white with soft shadow)
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    w = size
    tri_w = w * 0.36
    tri_h = w * 0.42
    cx, cy = w * 0.54, w * 0.5
    pts = [
        (cx - tri_w * 0.42, cy - tri_h / 2),
        (cx - tri_w * 0.42, cy + tri_h / 2),
        (cx + tri_w * 0.62, cy),
    ]
    sdraw.polygon(pts, fill=(0, 0, 0, 70))
    from PIL import ImageFilter
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(2, size // 40)))
    img = Image.alpha_composite(img, shadow)

    draw = ImageDraw.Draw(img)
    draw.polygon(pts, fill=(255, 255, 255, 255))

    # subtle top-left sheen
    sheen = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shdraw = ImageDraw.Draw(sheen)
    shdraw.ellipse(
        [-size * 0.35, -size * 0.55, size * 0.9, size * 0.55],
        fill=(255, 255, 255, 26),
    )
    img = Image.alpha_composite(img, sheen)

    # re-apply rounded mask so the sheen doesn't square the corners
    img.putalpha(mask)
    return img


for s in (192, 512):
    make_icon(s).save(os.path.join(OUT_APP, f"icon-{s}.png"))
    print("wrote", OUT_APP, f"icon-{s}.png")

# Android legacy mipmap PNGs
for dpi, s in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    d = os.path.join("android/app/src/main/res", f"mipmap-{dpi}")
    os.makedirs(d, exist_ok=True)
    make_icon(s).save(os.path.join(d, "ic_launcher.png"))
    print("wrote", d, "ic_launcher.png")

print("done")

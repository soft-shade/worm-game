"""
Render favicon.png + favicon.ico from the same design as favicon.svg,
with Fredoka Bold baked into the glyphs so the icon doesn't depend on
whatever fonts the viewer happens to have installed.

Run from the repo root:
    python3 utils/render_favicon.py

Requires Pillow and a Fredoka TrueType file. Default expects
/tmp/fredoka.ttf; pass --font /path/to/Fredoka.ttf to override. The
script downloads Fredoka from Google Fonts if the TTF isn't present.
"""
import argparse
import math
import os
import urllib.request
from PIL import Image, ImageDraw, ImageFont


FREDOKA_URL = (
    "https://github.com/google/fonts/raw/main/ofl/fredoka/"
    "Fredoka%5Bwdth%2Cwght%5D.ttf"
)


def ensure_font(path):
    if os.path.exists(path):
        return
    print(f"downloading Fredoka -> {path}")
    urllib.request.urlretrieve(FREDOKA_URL, path)


def render(font_path, scale=8):
    s = scale
    w = h = 64 * s
    cx, cy = 32 * s, 32 * s

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # Pink annulus from r=24 to r=30.
    ring = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse(
        [cx - 30 * s, cy - 30 * s, cx + 30 * s, cy + 30 * s],
        fill=(243, 139, 168, 255),
    )
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse(
        [cx - 24 * s, cy - 24 * s, cx + 24 * s, cy + 24 * s], fill=255
    )
    ring.paste(Image.new("RGBA", (w, h), (0, 0, 0, 0)), (0, 0), mask)
    img = Image.alpha_composite(img, ring)

    # Dark worm-band ribs at 30 deg intervals (offset 15 deg from the axes).
    draw = ImageDraw.Draw(img)
    for deg in range(15, 360, 30):
        rad = math.radians(deg)
        cosθ, sinθ = math.cos(rad), math.sin(rad)
        p1 = (cx + 24 * s * cosθ, cy + 24 * s * sinθ)
        p2 = (cx + 30 * s * cosθ, cy + 30 * s * sinθ)
        draw.line([p1, p2], fill=(30, 30, 46, 115), width=max(1, int(0.9 * s)))

    # W and G in Fredoka Bold (weight=700 on the variation axis).
    font = ImageFont.truetype(font_path, 26 * s)
    try:
        font.set_variation_by_axes([700, 100])  # weight, width
    except Exception:
        pass
    draw.text((26 * s, 36.9 * s), "W", font=font, fill=(166, 227, 161, 255), anchor="ms")
    draw.text((42 * s, 45.9 * s), "G", font=font, fill=(166, 227, 161, 255), anchor="ms")

    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", default="/tmp/fredoka.ttf")
    ap.add_argument("--png", default="favicon.png")
    ap.add_argument("--ico", default="favicon.ico")
    args = ap.parse_args()

    ensure_font(args.font)
    master = render(args.font)

    master.resize((192, 192), Image.LANCZOS).save(args.png)
    print(f"wrote {args.png} (192x192)")

    # Multi-size .ico for old browsers.
    master.resize((16, 16), Image.LANCZOS).save(
        args.ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print(f"wrote {args.ico} (16/32/48 multi-size)")


if __name__ == "__main__":
    main()

"""Fallback: draw the PWA icons directly with Pillow — no cairosvg needed.
Run: python make_icons.py"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ICONS = Path(r"C:\Users\HP\Desktop\Tryson\Mini_Project\Project\toll-frontend\public\icons")
ICONS.mkdir(parents=True, exist_ok=True)

GREEN = (7, 75, 25)        # #074B19 flag green
CREAM = (242, 246, 236)    # #F2F6EC
RED = (196, 67, 59)        # #C4433B
WHITE = (255, 255, 255)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), GREEN)
    d = ImageDraw.Draw(img)
    s = size / 512  # everything is designed on a 512-canvas and scaled

    # road lanes (two cream stripes near the bottom)
    d.rounded_rectangle([80*s, 380*s, 432*s, 396*s], radius=8*s, fill=CREAM)
    d.rounded_rectangle([80*s, 424*s, 432*s, 440*s], radius=8*s, fill=CREAM)

    # barrier posts
    d.rounded_rectangle([96*s, 240*s, 116*s, 372*s], radius=6*s, fill=CREAM)
    d.rounded_rectangle([396*s, 240*s, 416*s, 372*s], radius=6*s, fill=CREAM)

    # boom barrier — tilted open, alternating red/white segments
    import math
    angle = math.radians(-35)
    x0, y0 = 106*s, 246*s
    seg_len = 30*s
    colors = [RED, WHITE, RED, WHITE, RED, WHITE, RED]
    for i, col in enumerate(colors):
        sx = x0 + (seg_len * i) * math.cos(angle)
        sy = y0 + (seg_len * i) * math.sin(angle)
        ex = sx + seg_len * math.cos(angle)
        ey = sy + seg_len * math.sin(angle)
        d.line([sx, sy, ex, ey], fill=col, width=int(14*s))

    # "Toll" wordmark — try bold fonts, fall back gracefully
    font = None
    for name in ("arialbd.ttf", "Arial Bold.ttf", "seguisb.ttf"):
        try:
            font = ImageFont.truetype(name, int(96*s))
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    text = "Toll"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - tw) / 2 - bbox[0], (150*s - th) / 2 - bbox[1]), text,
           font=font, fill=CREAM)

    return img


for name, size in [("icon-192.png", 192), ("icon-512.png", 512),
                   ("icon-maskable-512.png", 512)]:
    draw_icon(size).save(ICONS / name)
    print(f"Created {name} ({size}x{size})")

print("\nAll PWA icons generated.")
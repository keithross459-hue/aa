"""Downloadable product cover images."""
import io
import textwrap
from typing import Any, Dict

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1600
HEIGHT = 2400


def _font(size: int, bold: bool = False):
    candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/impact.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int, max_lines: int):
    lines = []
    for raw in textwrap.wrap(str(text or ""), width=24):
        words = raw.split()
        current = ""
        for word in words:
            trial = f"{current} {word}".strip()
            if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
                current = trial
            else:
                if current:
                    lines.append(current)
                current = word
            if len(lines) >= max_lines:
                break
        if current and len(lines) < max_lines:
            lines.append(current)
        if len(lines) >= max_lines:
            break
    return lines[:max_lines]


def build_cover_png(product: Dict[str, Any]) -> bytes:
    title = str(product.get("title") or "Digital Product").upper()
    tagline = str(product.get("tagline") or product.get("description") or "").strip()
    product_type = str(product.get("product_type") or "digital product").upper()
    audience = str(product.get("target_audience") or "CREATORS").upper()[:80]

    img = Image.new("RGB", (WIDTH, HEIGHT), "#09090b")
    draw = ImageDraw.Draw(img)
    red = (255, 51, 51)
    yellow = (255, 214, 0)
    white = (250, 250, 250)
    zinc = (161, 161, 170)

    draw.rectangle((0, 0, WIDTH, 42), fill=yellow)
    draw.rectangle((0, HEIGHT - 42, WIDTH, HEIGHT), fill=red)
    draw.rectangle((110, 130, WIDTH - 110, HEIGHT - 130), outline="#3f3f46", width=6)
    draw.rectangle((150, 170, WIDTH - 150, 390), fill="#111113", outline="#27272a", width=3)
    draw.text((190, 222), "FiiLTHY.AI", font=_font(92, True), fill=yellow)
    draw.text((190, 322), product_type, font=_font(42, False), fill=zinc)

    title_font = _font(150, True)
    while draw.textbbox((0, 0), title, font=title_font)[2] > WIDTH - 300 and getattr(title_font, "size", 120) > 82:
        title_font = _font(getattr(title_font, "size", 150) - 8, True)

    y = 740
    for line in _wrap(draw, title, title_font, WIDTH - 280, 6):
        draw.text((150, y), line, font=title_font, fill=white)
        y += getattr(title_font, "size", 120) + 18

    draw.rectangle((150, y + 70, WIDTH - 150, y + 86), fill=red)
    y += 150
    for line in _wrap(draw, tagline, _font(56, False), WIDTH - 300, 5):
        draw.text((150, y), line, font=_font(56, False), fill=zinc)
        y += 72

    draw.rounded_rectangle((150, HEIGHT - 420, WIDTH - 150, HEIGHT - 250), radius=26, fill="#ffd600")
    draw.text((195, HEIGHT - 375), "BUILT FOR", font=_font(38, True), fill=(0, 0, 0))
    draw.text((195, HEIGHT - 325), audience, font=_font(54, True), fill=(0, 0, 0))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

"""Renderable promotional video assets for manual social posting."""
import os
import re
import tempfile
import textwrap
from typing import Any, Dict, List, Optional

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


WIDTH = 1080
HEIGHT = 1920
FPS = 12
SECONDS = 12


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


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or fallback).strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _script_beats(script: str, visual_idea: str) -> List[str]:
    raw = re.split(r"(?:\d+:\d+|\n|\. )", script or "")
    beats = [_safe_text(x) for x in raw if _safe_text(x)]
    if visual_idea:
        beats.append(f"Visual: {_safe_text(visual_idea)}")
    return beats[:4] or ["Show the problem", "Reveal the product", "Show the outcome", "Tell them what to do next"]


def _fit_lines(draw: ImageDraw.ImageDraw, text: str, font, max_width: int, max_lines: int) -> List[str]:
    words = text.split()
    lines: List[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
            current = trial
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) >= max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
    return lines


def _center_lines(draw: ImageDraw.ImageDraw, lines: List[str], font, y: int, fill, spacing: int = 18):
    heights = [draw.textbbox((0, 0), line, font=font)[3] for line in lines]
    total = sum(heights) + spacing * max(0, len(lines) - 1)
    cursor = y - total // 2
    for line, h in zip(lines, heights):
        w = draw.textbbox((0, 0), line, font=font)[2]
        draw.text(((WIDTH - w) // 2, cursor), line, font=font, fill=fill)
        cursor += h + spacing


def _draw_frame(
    product: Dict[str, Any],
    post: Dict[str, Any],
    cta_url: str,
    style: str,
    frame_index: int,
    total_frames: int,
) -> Image.Image:
    progress = frame_index / max(total_frames - 1, 1)
    img = Image.new("RGB", (WIDTH, HEIGHT), "#09090b")
    draw = ImageDraw.Draw(img)

    red = (255, 51, 51)
    yellow = (255, 214, 0)
    white = (250, 250, 250)
    zinc = (161, 161, 170)
    dark = (24, 24, 27)

    draw.rectangle((0, 0, WIDTH, 18), fill=yellow)
    draw.rectangle((0, HEIGHT - 18, int(WIDTH * progress), HEIGHT), fill=red)
    draw.rectangle((72, 88, WIDTH - 72, 150), outline=dark, width=2)
    style_label = {
        "pain_solution": "PAIN TO SOLUTION",
        "walkthrough": "PRODUCT WALKTHROUGH",
        "ugc_script": "UGC TALKING HEAD",
    }.get(style, "PROMO")
    draw.text((96, 104), f"FiiLTHY.AI - {style_label}", font=_font(28, True), fill=yellow)

    title = _safe_text(product.get("title"), "Digital Product")
    tagline = _safe_text(product.get("tagline"))
    hook = _safe_text(post.get("hook"), tagline or title)
    beats = _script_beats(str(post.get("script") or ""), str(post.get("visual_idea") or ""))
    caption = _safe_text(post.get("caption"), "Download now")
    hashtags = " ".join(f"#{_safe_text(h)}" for h in (post.get("hashtags") or [])[:5])

    scene = min(3, int(progress * 4))
    if scene == 0:
        main = hook if style != "walkthrough" else "LOOK INSIDE"
        sub = tagline or "A practical digital product built to use today."
        accent = yellow
    elif scene == 1:
        main = beats[0] if style != "ugc_script" else "I MADE THIS FOR ONE SPECIFIC PROBLEM"
        sub = beats[1] if len(beats) > 1 else title
        accent = red
    elif scene == 2:
        main = beats[2] if len(beats) > 2 else caption
        if style == "walkthrough":
            main = "WHAT YOU GET"
        sub = beats[3] if len(beats) > 3 else "Built for fast implementation."
        accent = yellow
    else:
        main = "GET THE DOWNLOAD"
        sub = cta_url or caption
        accent = red

    main_font = _font(88, True)
    sub_font = _font(42, False)
    small_font = _font(30, False)
    while draw.textbbox((0, 0), main, font=main_font)[2] > WIDTH - 150 and getattr(main_font, "size", 72) > 48:
        main_font = _font(getattr(main_font, "size", 88) - 6, True)

    draw.rounded_rectangle((72, 230, WIDTH - 72, 1250), radius=28, fill="#111113", outline="#27272a", width=3)
    draw.rectangle((72, 230, 92, 1250), fill=accent)
    _center_lines(draw, _fit_lines(draw, main.upper(), main_font, WIDTH - 190, 5), main_font, 650, white, 22)
    _center_lines(draw, _fit_lines(draw, sub, sub_font, WIDTH - 220, 4), sub_font, 1040, zinc, 14)

    price = product.get("price", 0)
    draw.rounded_rectangle((96, 1320, WIDTH - 96, 1440), radius=14, fill="#ffd600")
    cta = f"${price} - DOWNLOAD THE PRODUCT" if price else "DOWNLOAD THE PRODUCT"
    _center_lines(draw, [cta], _font(42, True), 1382, (0, 0, 0), 0)

    draw.text((96, 1510), "CAPTION", font=_font(26, True), fill=red)
    for idx, line in enumerate(_fit_lines(draw, caption, small_font, WIDTH - 192, 3)):
        draw.text((96, 1552 + idx * 42), line, font=small_font, fill=white)

    if hashtags:
        draw.text((96, 1710), hashtags[:110], font=_font(28, False), fill=yellow)
    if cta_url:
        draw.text((96, 1768), cta_url[:95], font=_font(24, False), fill=zinc)

    return img


def build_promo_video_mp4(
    product: Dict[str, Any],
    post: Dict[str, Any],
    cta_url: Optional[str] = None,
    style: str = "pain_solution",
) -> bytes:
    """Build a vertical MP4 ad from a product and social post script."""
    total_frames = FPS * SECONDS
    fd, path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    try:
        with imageio.get_writer(path, fps=FPS, codec="libx264", quality=7, macro_block_size=1) as writer:
            for frame_index in range(total_frames):
                frame = _draw_frame(product, post, cta_url or "", style, frame_index, total_frames)
                writer.append_data(np.asarray(frame))
        with open(path, "rb") as f:
            return f.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass

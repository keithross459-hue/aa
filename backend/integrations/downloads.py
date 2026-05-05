"""Product download helpers — build PDF / ZIP bundles from a product dict."""
import io
import zipfile
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
)
from integrations.cover_image import build_cover_png


def _styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=28, leading=32, spaceAfter=12, textColor=colors.HexColor("#09090B"),
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=18, leading=22, spaceBefore=18, spaceAfter=6,
            textColor=colors.HexColor("#FF3333"),
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=14, leading=18, spaceBefore=12, spaceAfter=4,
            textColor=colors.HexColor("#09090B"),
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=11, leading=16, spaceAfter=6,
            textColor=colors.HexColor("#27272A"),
        ),
        "mono": ParagraphStyle(
            "mono", parent=base["BodyText"], fontName="Courier",
            fontSize=9.5, leading=14, spaceAfter=4,
            textColor=colors.HexColor("#52525B"),
        ),
        "tagline": ParagraphStyle(
            "tagline", parent=base["BodyText"], fontName="Helvetica-Oblique",
            fontSize=13, leading=18, spaceAfter=12,
            textColor=colors.HexColor("#52525B"),
        ),
    }
    return styles


def _esc(text: str) -> str:
    if text is None:
        return ""
    return (str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;"))


def build_product_pdf(product: Dict[str, Any], referral_url: Optional[str] = None) -> bytes:
    """Returns a PDF bytes representation of the product — ready to download.

    If `referral_url` is provided, appends a branded "Powered by FiiLTHY.AI" last page
    that turns every share into a viral loop.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        leftMargin=0.8 * inch, rightMargin=0.8 * inch,
        topMargin=0.8 * inch, bottomMargin=0.8 * inch,
        title=product.get("title", "FiiLTHY Product"),
    )
    S = _styles()
    story: List[Any] = []

    # Cover block
    story.append(Paragraph("FiiLTHY.AI — DIGITAL PRODUCT", S["mono"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(_esc(product.get("title", "Untitled")), S["title"]))
    if product.get("tagline"):
        story.append(Paragraph(_esc(product["tagline"]), S["tagline"]))

    # Meta table
    meta_rows = [
        ["TYPE", str(product.get("product_type", "—"))],
        ["PRICE", f"${product.get('price', 0)}"],
        ["AUDIENCE", str(product.get("target_audience", "—"))[:100]],
    ]
    t = Table(meta_rows, colWidths=[1.2 * inch, 5.2 * inch])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#09090B")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#27272A")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F4F4F5")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D4D4D8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)

    # Description
    if product.get("description"):
        story.append(Paragraph("OVERVIEW", S["h1"]))
        story.append(Paragraph(_esc(product["description"]), S["body"]))

    # Bullet features
    bullets = product.get("bullet_features") or []
    if bullets:
        story.append(Paragraph("WHAT'S INSIDE", S["h1"]))
        for b in bullets:
            story.append(Paragraph(f"▮ {_esc(b)}", S["body"]))

    # Outline
    outline = product.get("outline") or []
    if outline:
        story.append(Paragraph("FULL OUTLINE", S["h1"]))
        for i, o in enumerate(outline, 1):
            story.append(Paragraph(f"<b>{i:02d}.</b> {_esc(o)}", S["body"]))

    # Sales copy
    if product.get("sales_copy"):
        story.append(PageBreak())
        story.append(Paragraph("SALES COPY", S["h1"]))
        for para in str(product["sales_copy"]).split("\n"):
            if para.strip():
                story.append(Paragraph(_esc(para), S["body"]))

    # Cover concept
    if product.get("cover_concept"):
        story.append(Paragraph("COVER CONCEPT", S["h1"]))
        story.append(Paragraph(_esc(product["cover_concept"]), S["body"]))

    story.append(Spacer(1, 24))
    story.append(Paragraph("Generated by FiiLTHY.AI — go viral or go broke.", S["mono"]))

    # Viral loop — "Powered by FiiLTHY" back cover with referral link
    if referral_url:
        story.append(PageBreak())
        story.append(Spacer(1, 72))
        story.append(Paragraph("POWERED BY FiiLTHY.AI", S["h1"]))
        story.append(Spacer(1, 8))
        story.append(Paragraph(
            "This product was forged, launched, and scaled with "
            "<b>FiiLTHY.AI</b> — the viral digital product factory for creators.",
            S["body"],
        ))
        story.append(Spacer(1, 16))
        story.append(Paragraph("Want to build your own?", S["h2"]))
        story.append(Paragraph(
            f'<a href="{_esc(referral_url)}" color="#FF3333"><u>{_esc(referral_url)}</u></a>',
            S["body"],
        ))
        story.append(Spacer(1, 16))
        story.append(Paragraph("Sign up free. 5 product generations on the house.", S["mono"]))

    doc.build(story)
    return buf.getvalue()


def _md_from_product(product: Dict[str, Any]) -> str:
    bullets = "\n".join(f"- {b}" for b in (product.get("bullet_features") or []))
    outline = "\n".join(f"{i+1:02d}. {o}" for i, o in enumerate(product.get("outline") or []))
    return f"""# {product.get('title', 'Untitled')}

> {product.get('tagline', '')}

**Type:** {product.get('product_type', '')}
**Price:** ${product.get('price', 0)}
**Audience:** {product.get('target_audience', '')}

## Overview
{product.get('description', '')}

## What's Inside
{bullets}

## Full Outline
{outline}

## Cover Concept
{product.get('cover_concept', '')}
"""


def _store_upload_kit(product: Dict[str, Any]) -> str:
    bullets = "\n".join(f"- {b}" for b in (product.get("bullet_features") or []))
    return f"""# Store Upload Kit

## Product Title
{product.get('title', 'Untitled')}

## Short Tagline
{product.get('tagline', '')}

## Store Description
{product.get('description', '')}

## Price
${product.get('price', 0)}

## Product Type
{product.get('product_type', '')}

## What's Included
{bullets}

## Customer Delivery Notes
After purchase, download the included PDF/product file and start with the first section. This is a practical digital product for immediate implementation.

## Manual Store Setup Checklist
- Upload `product.pdf` as the product file.
- Use the Product Title above as the listing name.
- Use the Store Description above as the listing description.
- Set the listed price.
- Add the sales copy from `sales_copy.txt`.
- Add 3-5 preview bullets from What's Included.
- Publish the product.
- Copy the store URL into your social posts and email promos.
"""


def _md_from_campaigns(campaigns: List[Dict[str, Any]]) -> str:
    if not campaigns:
        return "# Ad Campaigns\n\n_No campaigns generated yet._\n"
    out = ["# Ad Campaigns", ""]
    for c in campaigns:
        out.append(f"## {c.get('angle', 'Untitled')} — ${c.get('daily_budget_suggestion', 0)}/day")
        for v in c.get("variants", []):
            out.append(f"### {v.get('platform', '')}")
            out.append(f"**Hook:** {v.get('hook', '')}\n")
            out.append(f"**Script:**\n```\n{v.get('script', '')}\n```")
            out.append(f"**CTA:** {v.get('cta', '')}\n")
            out.append(f"**Targeting:** {v.get('targeting', '')}\n")
            tags = " ".join(f"#{h}" for h in (v.get("hashtags") or []))
            out.append(f"**Hashtags:** {tags}\n")
        out.append("\n---\n")
    return "\n".join(out)


def _md_from_tiktok(posts: List[Dict[str, Any]]) -> str:
    if not posts:
        return "# TikTok Posts\n\n_No posts generated yet._\n"
    out = ["# TikTok Posts", ""]
    for i, p in enumerate(posts, 1):
        out.append(f"## Post {i}")
        out.append(f"**Hook:** {p.get('hook', '')}\n")
        out.append(f"**Script:**\n```\n{p.get('script', '')}\n```")
        out.append(f"**Caption:** {p.get('caption', '')}\n")
        tags = " ".join(f"#{h}" for h in (p.get("hashtags") or []))
        out.append(f"**Hashtags:** {tags}\n")
        out.append(f"**Visual idea:** {p.get('visual_idea', '')}\n")
        out.append("\n---\n")
    return "\n".join(out)


def build_product_bundle_zip(
    product: Dict[str, Any],
    campaigns: List[Dict[str, Any]],
    tiktok_posts: List[Dict[str, Any]],
    referral_url: Optional[str] = None,
) -> bytes:
    """Zip containing product.pdf, product.md, campaigns.md, tiktok.md, sales_copy.txt, README.md."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("product.pdf", build_product_pdf(product, referral_url=referral_url))
        z.writestr("cover.png", build_cover_png(product))
        z.writestr("product.md", _md_from_product(product))
        z.writestr("store_upload_kit.md", _store_upload_kit(product))
        z.writestr("ad_campaigns.md", _md_from_campaigns(campaigns))
        z.writestr("tiktok_posts.md", _md_from_tiktok(tiktok_posts))
        z.writestr("sales_copy.txt", product.get("sales_copy", ""))
        if referral_url:
            z.writestr("README-powered-by-FiiLTHY.md", _referral_readme(referral_url))
    return buf.getvalue()


def _referral_readme(referral_url: str) -> str:
    return f"""# Powered by FiiLTHY.AI

This digital product was forged, launched, and scaled with **FiiLTHY.AI** — the viral
product factory for creators.

## Build your own

Sign up free and get 5 product generations on the house:

**{referral_url}**

_Built filthy. Built fast._
"""


def build_library_zip(items: List[Dict[str, Any]], referral_url: Optional[str] = None) -> bytes:
    """`items` = [{product, campaigns, tiktok_posts}, ...] — packs every product in subfolders."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for it in items:
            p = it["product"]
            safe = _safe_folder(p.get("title", "product"))[:60] + "-" + str(p.get("id", ""))[:6]
            z.writestr(f"{safe}/product.pdf", build_product_pdf(p, referral_url=referral_url))
            z.writestr(f"{safe}/cover.png", build_cover_png(p))
            z.writestr(f"{safe}/product.md", _md_from_product(p))
            z.writestr(f"{safe}/store_upload_kit.md", _store_upload_kit(p))
            z.writestr(f"{safe}/ad_campaigns.md", _md_from_campaigns(it.get("campaigns", [])))
            z.writestr(f"{safe}/tiktok_posts.md", _md_from_tiktok(it.get("tiktok_posts", [])))
            z.writestr(f"{safe}/sales_copy.txt", p.get("sales_copy", ""))
        if referral_url:
            z.writestr("README-powered-by-FiiLTHY.md", _referral_readme(referral_url))
    return buf.getvalue()


def _safe_folder(text: str) -> str:
    import re
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-")
    return s or "product"

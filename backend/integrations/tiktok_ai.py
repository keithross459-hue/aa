"""TikTok Content Engine — generates 5 viral-ready posts per product via Claude Sonnet 4.5."""
import os
import uuid
from typing import List, Dict, Any

from services.llm_client import LlmProviderUnavailable, generate_text_with_fallback
from services.llm_config import llm_api_key

SYSTEM_MSG = (
    "You are FiiLTHY.AI's TikTok viral content engine. "
    "You write aggressive, money-focused, curiosity-driven, short-sentence TikTok content "
    "engineered to stop the scroll and drive clicks. "
    "Always respond with STRICT VALID JSON only — no commentary, no markdown fences."
)

HOOK_PATTERNS = [
    '"Nobody is talking about this…"',
    '"This made me $___ in __ days"',
    '"You\'re wasting time if you\'re not using this"',
    '"I tested this so you don\'t have to"',
    '"Stop scrolling. This changes everything."',
]


def _safe_json_parse(text: str):
    import json, re
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    s, e = text.find("{"), text.rfind("}")
    if s != -1 and e != -1:
        try:
            return json.loads(text[s : e + 1])
        except Exception:
            pass
    raise ValueError("TikTok AI returned malformed output")


def _fallback_posts(product: Dict[str, Any], count: int) -> List[Dict[str, Any]]:
    title = str(product.get("title") or "this product")
    audience = str(product.get("target_audience") or "people trying to get a better result")
    price = product.get("price") or 27
    angles = [
        ("Stop guessing. Start with this.", "If you are trying to move faster, this gives you the checklist and first steps so you can take action today."),
        ("I made this for people stuck at step one.", f"This is for {audience}. It turns the messy part into a simple launch path."),
        ("Most people overcomplicate this.", "You do not need a giant plan. You need the first useful version, a clean offer, and a way to read the response."),
        ("This is the shortcut I wish I had.", f"The {title} gives you the setup, checklist, and launch moves in one place."),
        ("If you want the first result, start here.", "Use the product, follow the checklist, promote it once, and improve from real signals."),
    ]
    posts: List[Dict[str, Any]] = []
    for i, (hook, body) in enumerate(angles[:count]):
        posts.append({
            "id": str(uuid.uuid4()),
            "hook": hook,
            "script": (
                f"{hook}\n\n"
                f"{body}\n\n"
                f"I put it into a simple digital product called {title}. "
                f"It is ${price}, built to help you take the next step without getting stuck.\n\n"
                "Grab it from the link and start now."
            ),
            "caption": f"{title} is live. Start here, take action, then improve from real signals.",
            "hashtags": ["digitalproduct", "launch", "creatorbusiness", "sidehustle", "productivity", "firstsale", "onlinebusiness", "buildinpublic"],
            "visual_idea": "Screen recording of the product page with checklist-style text overlays and a clear link CTA.",
        })
    return posts


async def generate_tiktok_posts(product: Dict[str, Any], count: int = 5) -> List[Dict[str, Any]]:
    """Generate `count` viral TikTok posts for the given product."""
    api_key = llm_api_key()
    if not api_key:
        raise RuntimeError("AI generation key not configured")

    prompt = f"""Generate {count} viral TikTok posts for this digital product.

Product title: {product.get('title')}
Description: {product.get('description')}
Target audience: {product.get('target_audience')}
Price: ${product.get('price')}
Sales copy: {product.get('sales_copy')}

HOOK PATTERNS (mix and vary across the 5 posts):
{chr(10).join('- ' + p for p in HOOK_PATTERNS)}

SCRIPT RULES:
- 20-40 second talking script
- Conversational, fast pacing, no fluff
- Short sentences
- Money-focused, curiosity-driven
- Hard CTA at the end

Return JSON with EXACT keys:
{{
  "posts": [
    {{
      "hook": "first line, scroll-stopping, max 15 words",
      "script": "full 20-40s talking script with line breaks",
      "caption": "TikTok caption, max 200 chars, 1-2 lines",
      "hashtags": ["8-12 hashtags without # prefix, viral-niche mix"],
      "visual_idea": "one-line on-screen/B-roll concept"
    }},
    ... ({count} total)
  ]
}}"""

    try:
        resp = await generate_text_with_fallback(
            system=SYSTEM_MSG,
            prompt=prompt,
            session_id=f"tiktok-{uuid.uuid4().hex[:8]}",
            api_key_override=api_key,
        )
    except LlmProviderUnavailable as ex:
        return _fallback_posts(product, count)
    data = _safe_json_parse(resp)

    posts_raw = data.get("posts", []) if isinstance(data, dict) else []
    posts: List[Dict[str, Any]] = []
    for p in posts_raw[:count]:
        posts.append({
            "id": str(uuid.uuid4()),
            "hook": str(p.get("hook", ""))[:300],
            "script": str(p.get("script", ""))[:3000],
            "caption": str(p.get("caption", ""))[:400],
            "hashtags": [str(h).lstrip("#") for h in (p.get("hashtags") or [])][:15],
            "visual_idea": str(p.get("visual_idea", ""))[:500],
        })
    return posts

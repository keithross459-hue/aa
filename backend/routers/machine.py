"""One-click business orchestration engine."""
from __future__ import annotations

import io
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core_auth import current_user
from db import db
from integrations.downloads import build_product_pdf
from services import posthog
from services import referrals as referral_service

router = APIRouter(prefix="/api/machine", tags=["machine"])


class MachineReq(BaseModel):
    idea: str = Field(min_length=3)
    audience: Optional[str] = None
    product_type: str = "ebook"
    price: float = 29.0
    launch_stores: bool = True
    activate_referrals: bool = True


def _slug(text: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:64] or "business"


def _brand(idea: str) -> Dict[str, str]:
    words = [w for w in idea.replace("-", " ").split() if w]
    core = " ".join(words[:3]).title() or "FiiLTHY Offer"
    return {
        "name": core,
        "tagline": f"Turn {idea} into a premium digital offer in one click.",
        "voice": "direct, premium, fast-moving, conversion-first",
        "palette": "black glass, neon yellow, signal red, white",
    }


def _content_modules(idea: str, audience: str) -> Dict[str, List[str]]:
    return {
        "ebook": [
            f"The fast-start map for {idea}",
            f"What {audience} already wants to buy",
            "Offer architecture and irresistible positioning",
            "The 7-day execution sprint",
            "Traffic loops, proof, and follow-up",
        ],
        "course": [
            "Module 1: Pick the painful promise",
            "Module 2: Build the tiny transformation",
            "Module 3: Package the product",
            "Module 4: Launch the first campaign",
            "Module 5: Optimize from buyer signals",
        ],
        "membership": [
            "Weekly playbooks",
            "Monthly template drops",
            "Private implementation room",
            "Launch reviews",
            "Partner and referral prompts",
        ],
    }


def _campaign_assets(title: str, idea: str, audience: str) -> Dict[str, List[Dict[str, str]]]:
    hooks = [
        f"Stop overthinking {idea}. Build the offer first.",
        f"{audience.title()} need this before they need more motivation.",
        f"I turned {idea} into a sellable product blueprint.",
    ]
    return {
        "ads": [
            {"platform": "TikTok Ads", "hook": hooks[0], "script": "Problem, proof, promise, CTA. Keep it under 22 seconds.", "cta": "Get the blueprint"},
            {"platform": "Meta Ads", "hook": hooks[1], "script": "Show the before state, then the finished offer stack.", "cta": "Launch faster"},
            {"platform": "YouTube Ads", "hook": hooks[2], "script": "Open with the result, walk through three steps, close on urgency.", "cta": "Download now"},
        ],
        "tiktok_scripts": [{"title": h, "script": f"Hook: {h}\nValue: show one practical step.\nCTA: grab {title}."} for h in hooks],
        "instagram_content": [{"format": "carousel", "caption": f"3 moves to make {idea} feel premium and buyable."}],
        "x_threads": [{"hook": hooks[0], "posts": [hooks[0], "Pick a painful promise.", "Package one outcome.", "Launch before you polish."]}],
        "youtube_shorts": [{"hook": hooks[2], "script": "Show the old way, the one-click way, and the product result."}],
        "email_funnel": [
            {"subject": f"The {idea} shortcut", "body": "Lead with the pain, reveal the new mechanism, invite the click."},
            {"subject": "Most people wait too long", "body": "Handle objections and show the simple launch path."},
            {"subject": "Last call for the fast-start stack", "body": "Drive urgency with concrete outcomes."},
        ],
    }


async def _record_launches(user_id: str, product: dict) -> List[dict]:
    now = datetime.now(timezone.utc).isoformat()
    stores = ["gumroad", "stan_store", "whop", "payhip", "etsy_digital", "stripe_link", "shopify_digital"]
    listings = []
    for store in stores:
        live = store in {"etsy_digital", "stripe_link", "shopify_digital"}
        listing = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "product_id": product["id"],
            "store_id": store,
            "store_name": store.replace("_", " ").title(),
            "listing_url": f"https://launch.fiilthy.ai/{_slug(product['title'])}/{store}",
            "status": "SIMULATED" if live else "READY_FOR_CREDENTIALS",
            "listing_title": product["title"],
            "listing_description": product["description"],
            "launched_at": now,
            "real": False,
        }
        listings.append(listing)
    await db.listings.insert_many([l.copy() for l in listings])
    return listings


@router.post("/run")
async def run_machine(req: MachineReq, user=Depends(current_user)):
    now = datetime.now(timezone.utc).isoformat()
    audience = req.audience or "ambitious creators"
    brand = _brand(req.idea)
    modules = _content_modules(req.idea, audience)
    title = f"{brand['name']} Launch Kit"
    product = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": title,
        "tagline": brand["tagline"],
        "description": f"A premium {req.product_type} and launch stack for {audience} who want to monetize {req.idea}.",
        "target_audience": audience,
        "price": float(req.price),
        "product_type": req.product_type,
        "bullet_features": [
            "Offer positioning",
            "Premium branding kit",
            "Sales page copy",
            "Ad creative angles",
            "Social scripts",
            "Email funnel",
        ],
        "outline": modules["ebook"],
        "sales_copy": f"{title} gives {audience} a ready-to-launch business machine around {req.idea}: product, page, ads, content, emails, and referral loop.",
        "cover_concept": f"Futuristic black glass cover for {brand['name']} with neon commercial energy.",
        "created_at": now,
        "campaigns_count": 1,
        "launched_stores": [],
        "machine_generated": True,
    }
    await db.products.insert_one(product.copy())

    assets = _campaign_assets(title, req.idea, audience)
    campaign = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": product["id"],
        "product_title": title,
        "angle": "one_click_business_machine",
        "daily_budget_suggestion": 35.0,
        "variants": assets["ads"],
        "created_at": now,
    }
    await db.campaigns.insert_one(campaign.copy())
    await db.tiktok_posts.insert_many([
        {**row, "id": str(uuid.uuid4()), "user_id": user["id"], "product_id": product["id"], "created_at": now}
        for row in assets["tiktok_scripts"]
    ])

    listings = await _record_launches(user["id"], product) if req.launch_stores else []
    if listings:
        await db.products.update_one(
            {"id": product["id"]},
            {"$set": {"launched_stores": [l["store_id"] for l in listings]}},
        )

    referral_code = await referral_service.ensure_user_referral(user) if req.activate_referrals else None
    package = {
        "branding": brand,
        "product": product,
        "course": modules["course"],
        "membership": modules["membership"],
        "landing_page": {
            "headline": title,
            "subheadline": product["tagline"],
            "sections": ["pain", "promise", "inside", "proof", "price", "faq"],
        },
        "sales_copy": product["sales_copy"],
        "ad_creative": assets["ads"],
        "tiktok_scripts": assets["tiktok_scripts"],
        "instagram_content": assets["instagram_content"],
        "x_threads": assets["x_threads"],
        "youtube_shorts": assets["youtube_shorts"],
        "email_funnel": assets["email_funnel"],
        "analytics_tracking": {"utm_campaign": product["id"], "posthog_event": "machine_launch_created"},
        "retargeting_setup": {"audiences": ["page_viewers", "checkout_started", "video_viewers"], "status": "ready"},
        "referral_activation": {"enabled": bool(referral_code), "code": referral_code},
        "listings": listings,
    }
    await db.machine_runs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": product["id"],
        "idea": req.idea,
        "package": package,
        "created_at": now,
    })
    await posthog.capture(user["id"], "machine_launch_created", {"product_id": product["id"], "idea": req.idea})
    return package


@router.get("/runs")
async def list_runs(user=Depends(current_user)):
    rows = await db.machine_runs.find({"user_id": user["id"]}, {"_id": 0, "package": 0}).sort("created_at", -1).to_list(100)
    return {"runs": rows}


@router.get("/export/{product_id}/zip")
async def export_machine_zip(product_id: str, user=Depends(current_user)):
    run = await db.machine_runs.find_one({"product_id": product_id, "user_id": user["id"]}, {"_id": 0})
    if not run:
        raise HTTPException(404, "Machine run not found")
    package = run["package"]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("business-machine.json", __import__("json").dumps(package, indent=2))
        z.writestr("sales-copy.txt", package.get("sales_copy", ""))
        z.writestr("email-funnel.json", __import__("json").dumps(package.get("email_funnel", []), indent=2))
        z.writestr("social-content.json", __import__("json").dumps({
            "tiktok": package.get("tiktok_scripts", []),
            "instagram": package.get("instagram_content", []),
            "x_threads": package.get("x_threads", []),
            "youtube_shorts": package.get("youtube_shorts", []),
        }, indent=2))
        z.writestr("product.pdf", build_product_pdf(package["product"]))
    return Response(
        buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=fiilthy-machine-{product_id}.zip"},
    )


"""Executive analytics and PostHog capture routes."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from core_auth import current_admin, current_user
from db import db
from services import analytics as analytics_service
from services import posthog

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/executive")
async def executive_analytics(admin=Depends(current_admin)):
    return await analytics_service.executive_dashboard()

@router.get("/posthog/config")
async def posthog_config(user=Depends(current_user)):
    return {
        "configured": posthog.configured(),
        "host": posthog.POSTHOG_HOST,
        "api_key": posthog.POSTHOG_API_KEY if posthog.configured() else "",
    }

@router.post("/capture")
async def capture_event(payload: dict, user=Depends(current_user)):
    event = str(payload.get("event") or "app_event")
    properties = dict(payload.get("properties") or {})
    properties.update({"user_id": user["id"], "plan": user.get("plan", "free")})
    return await posthog.capture(user["id"], event, properties)

@router.get("/user-state")
async def get_user_state(user=Depends(current_user)):
    """Get comprehensive user state for Phase 1."""
    user_id = user["id"]
    state = await db.user_states.find_one({"user_id": user_id}, {"_id": 0}) or {
        "user_id": user_id,
        "stage": "new",
        "last_action": None,
    }
    products = await db.products.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    campaigns_count = await db.campaigns.count_documents({"user_id": user_id})
    launches_count = await db.launches.count_documents({"user_id": user_id})
    products_summary = {
        "total": len(products),
        "campaigns": campaigns_count,
        "launches": launches_count,
        "recent": products[:10],
    }
    weak_spots = []
    if not products:
        weak_spots.append("no_products")
    if products and campaigns_count == 0:
        weak_spots.append("no_campaigns")
    diagnosis_result = {"status": "ok" if not weak_spots else "needs_attention", "weak_spots": weak_spots}

    return {
        "state": state,
        "products_summary": products_summary,
        "weak_spots": weak_spots,
        "diagnosis": diagnosis_result,
        "recent_history": products[:10],
        "winner_count": len([p for p in products if p.get("status") == "winner"]),
    }

@router.post("/user-state")
async def update_user_state(stage: str, action: Optional[str] = None, user=Depends(current_user)):
    """Update stage/action."""
    update = {
        "user_id": user["id"],
        "stage": stage,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if action:
        update["last_action"] = action
        await db.user_actions.insert_one({
            "user_id": user["id"],
            "action": action,
            "created_at": update["updated_at"],
        })
    await db.user_states.update_one({"user_id": user["id"]}, {"$set": update}, upsert=True)
    return {"ok": True}

@router.get("/user/diagnosis")
async def user_diagnosis(user=Depends(current_user)):
    """Weak spots and failure diagnosis."""
    product_count = await db.products.count_documents({"user_id": user["id"]})
    campaign_count = await db.campaigns.count_documents({"user_id": user["id"]})
    weak_spots = []
    if product_count == 0:
        weak_spots.append("no_products")
    if product_count > 0 and campaign_count == 0:
        weak_spots.append("no_campaigns")
    return {"status": "ok" if not weak_spots else "needs_attention", "weak_spots": weak_spots}

@router.get("/user/intelligence")
async def user_intelligence(user=Depends(current_user)):
    """Phase 2 Intelligence Layer: sellability scores across products."""
    products = await db.products.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    scores = {}
    for p in products:
        product_id = p.get("id")
        if not product_id:
            continue
        score = 30
        score += 15 if p.get("title") else 0
        score += 15 if p.get("sales_copy") else 0
        score += 15 if p.get("bullet_features") else 0
        score += 15 if p.get("price") else 0
        score += 10 if p.get("launched_stores") else 0
        scores[product_id] = {"sellability": min(score, 100)}

    values = [v["sellability"] for v in scores.values()]
    top_product = max(scores, key=lambda k: scores[k]["sellability"]) if scores else None
    return {
        "product_scores": scores,
        "avg_sellability": int(sum(values) / len(values)) if values else 0,
        "top_product": top_product,
    }

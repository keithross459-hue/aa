
"""Executive analytics and PostHog capture routes."""
from fastapi import APIRouter, Depends

from core_auth import current_admin, current_user
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

    state = await user_state.get_user_state(user["id"])
    state["products_summary"] = await user_state.get_user_products_summary(user["id"])
    weak_spots = await diagnosis.detect_weak_spots(user["id"])
    diagnosis_result = await diagnosis.diagnose_failures(user["id"])
    history = await product_memory.get_user_product_histories(user["id"])

    return {
        "state": state,
        "products_summary": state.get("products", {}),
        "weak_spots": weak_spots,
        "diagnosis": diagnosis_result,
        "recent_history": history[:10],  # Last 10 events
        "winner_count": len([p for p in state.get("products_summary", []) if p.get("status") == "winner"]),
    }

@router.post("/user-state")
async def update_user_state(stage: str, action: Optional[str] = None, user=Depends(current_user)):
    """Update stage/action."""

    await user_state.set_user_stage(user["id"], stage)
    if action:
        await user_state.record_user_action(user["id"], action)
    return {"ok": True}

@router.get("/user/diagnosis")
async def user_diagnosis(user=Depends(current_user)):
    """Weak spots and failure diagnosis."""

    return await diagnosis.diagnose_failures(user["id"])

@router.get("/user/intelligence")
async def user_intelligence(user=Depends(current_user)):
    """Phase 2 Intelligence Layer: sellability scores across products."""
    # Note: compute_sellability_scores needs to be implemented in services
    products = await db.products.find({"user_id": user["id"]}, {"_id": 0, "id": 1}).to_list(50)
    scores = {}
    for p in products:
        try:
            # Placeholder: compute_sellability_scores not yet implemented
            scores[p["id"]] = {"score": 0}
        except Exception:
            scores[p["id"]] = {"error": "compute_failed"}
    avg_sellability = 0
    return {"product_scores": scores, "avg_sellability": int(avg_sellability)}

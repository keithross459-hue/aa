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

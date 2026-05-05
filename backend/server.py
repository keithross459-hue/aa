"""
FiiLTHY.AI — Viral Marketing SaaS Backend
- JWT Auth (with admin seed, referral attribution, welcome email)
- AI generates Digital Products
- Per-product Ad Campaigns
- Multi-store launch (user-configured credentials)
- Per-user integration credentials (encrypted)
- Product PDF / ZIP downloads (with viral "Powered by FiiLTHY" back-cover)
- Plan/usage tracking + Stripe subscriptions + Admin panel + Referrals + Email
"""
import io
import asyncio
import logging
import os
import re
import hashlib
import secrets
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

from core_auth import (
    bearer, current_admin, current_user, hash_pw, is_owner_email, make_token, verify_pw,
)
from db import close_client, db
from integrations import meta_ads, settings as user_settings
from integrations.downloads import (
    build_library_zip,
    build_product_bundle_zip,
    build_product_pdf,
)
from integrations.cover_image import build_cover_png
from integrations.promo_video import build_promo_video_mp4
from integrations.gumroad import create_product as gumroad_create_product
from integrations.gumroad import verify_token as gumroad_verify
from integrations.stores import (
    payhip_create_product,
    stan_create_product,
    whop_create_product,
)
from integrations.tiktok_ai import fallback_tiktok_posts, generate_tiktok_posts
from routers.admin import public_router as announcement_public_router
from routers.admin import router as admin_router
from routers.analytics import router as analytics_router
from routers.billing import router as billing_router
from routers.billing import webhook_router as webhook_router
from routers.machine import router as machine_router
from routers.referrals import router as referrals_router
from services import email as email_service
from services import referrals as referral_service
from services.llm_client import LlmProviderUnavailable, generate_text_with_fallback
from services.llm_config import llm_api_key
from services.security import RateLimitMiddleware, RequestLoggingMiddleware, SecurityHeadersMiddleware, ensure_indexes
from services import stripe_service

# ---------- Setup ----------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

EMERGENT_LLM_KEY = llm_api_key()

app = FastAPI(title="FiiLTHY.AI API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("filthy")

# ---------- Constants ----------
PLAN_LIMITS = {"free": 5, "starter": 50, "pro": 500, "enterprise": 999999}
STORES = [
    {"id": "gumroad", "name": "Gumroad", "real": True},
    {"id": "stan_store", "name": "Stan Store", "real": True},
    {"id": "whop", "name": "Whop", "real": True},
    {"id": "payhip", "name": "Payhip", "real": True},
]
AD_PLATFORMS = ["TikTok Ads", "Meta Ads", "YouTube Ads", "Twitter Ads", "Pinterest Ads"]


# ---------- Models ----------
class SignupReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordReq(BaseModel):
    email: EmailStr


class ResetPasswordReq(BaseModel):
    token: str = Field(min_length=20)
    password: str = Field(min_length=6)


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    plan: str
    generations_used: int
    plan_limit: int
    role: str = "user"
    subscription_status: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    banned: bool = False


class AuthResp(BaseModel):
    token: str
    user: UserOut


class GenerateProductReq(BaseModel):
    niche: str = Field(min_length=2)
    audience: Optional[str] = None
    product_type: Optional[str] = "ebook"
    price_hint: Optional[str] = None
    extra_notes: Optional[str] = None


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    title: str
    tagline: str
    description: str
    target_audience: str
    price: float
    product_type: str
    bullet_features: List[str]
    outline: List[str]
    sales_copy: str
    cover_concept: str
    created_at: str
    campaigns_count: int = 0
    launched_stores: List[str] = []
    launched_at: Optional[str] = None
    sales_count: int = 0
    revenue: float = 0.0
    winners: List[str] = []
    tiktok_posts_count: int = 0
    completeness_score: int = 100
    manual_assets: List[str] = []


class UpdateProductReq(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    tagline: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=1500)
    target_audience: Optional[str] = Field(default=None, max_length=300)
    price: Optional[float] = Field(default=None, ge=0)
    bullet_features: Optional[List[str]] = None
    outline: Optional[List[str]] = None
    sales_copy: Optional[str] = Field(default=None, max_length=3000)
    cover_concept: Optional[str] = Field(default=None, max_length=500)


class CampaignReq(BaseModel):
    product_id: str
    angle: Optional[str] = None


class AdVariant(BaseModel):
    platform: str
    hook: str
    script: str
    cta: str
    hashtags: List[str]
    targeting: str


class Campaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    product_id: str
    product_title: str
    angle: str
    daily_budget_suggestion: float
    variants: List[AdVariant]
    created_at: str


class LaunchReq(BaseModel):
    product_id: str
    stores: Optional[List[str]] = None


class StoreListing(BaseModel):
    store_id: str
    store_name: str
    listing_url: str
    status: str
    listing_title: str
    listing_description: str
    launched_at: str
    real: bool = False
    error: Optional[str] = None


class ClickEventReq(BaseModel):
    product_id: str
    source: Literal["tiktok", "meta"]
    content_id: str


class SaleEventReq(BaseModel):
    product_id: str
    source: Literal["tiktok", "meta"]
    content_id: str
    value: float = 0.0


class FirstResultEventReq(BaseModel):
    action: Literal["copy_post", "marked_posted", "copy_link", "opened_link", "dismissed"]
    content_id: Optional[str] = None


WINNER_MIN_CTR = 0.03
WINNER_MIN_CONVERSION = 0.02
TEST_MIN_CTR = 0.01
TEST_MAX_CTR = 0.03
TEST_MIN_IMPRESSIONS = 100
DEAD_MAX_CTR = 0.01
DEAD_NO_CONVERSION_IMPRESSIONS = 200


class LaunchResult(BaseModel):
    product_id: str
    listings: List[StoreListing]


class UpdateSettingsReq(BaseModel):
    """Shape: { provider_id: {field: value, ...}, ... }"""
    providers: Dict[str, Dict[str, Optional[str]]]


class SignupReqV2(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    referral_code: Optional[str] = None
    website: Optional[str] = None  # bot honeypot; real users never see this


def _user_out(u: dict) -> UserOut:
    return UserOut(
        id=u["id"],
        email=u["email"],
        name=u["name"],
        plan=u.get("plan", "free"),
        generations_used=u.get("generations_used", 0),
        plan_limit=PLAN_LIMITS.get(u.get("plan", "free"), 5),
        role=u.get("role", "user"),
        subscription_status=u.get("subscription_status"),
        stripe_customer_id=u.get("stripe_customer_id"),
        banned=bool(u.get("banned", False)),
    )


async def _check_and_increment_usage(user: dict):
    plan = user.get("plan", "free")
    used = user.get("generations_used", 0)
    limit = PLAN_LIMITS.get(plan, 5)
    if used >= limit:
        raise HTTPException(
            status_code=403,
            detail={"code": "LIMIT_REACHED", "message": f"Used {used}/{limit} on {plan} plan. Upgrade to continue."},
        )
    await db.users.update_one({"id": user["id"]}, {"$inc": {"generations_used": 1}})


# ---------- LLM helper ----------
async def llm_json(system: str, prompt: str, session_id: str, api_key_override: Optional[str] = None) -> str:
    api_key = api_key_override or EMERGENT_LLM_KEY
    if not api_key:
        raise HTTPException(503, "AI generation is not configured")
    try:
        return await generate_text_with_fallback(system, prompt, session_id, api_key_override=api_key)
    except LlmProviderUnavailable:
        raise HTTPException(503, "AI providers are temporarily unavailable")


def _safe_json_parse(text: str):
    import json
    import re
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
    s = text.find("{")
    e = text.rfind("}")
    if s != -1 and e != -1:
        try:
            return json.loads(text[s: e + 1])
        except Exception:
            pass
    raise HTTPException(500, "AI returned malformed output. Please retry.")


def _fallback_product_data(req: GenerateProductReq) -> dict:
    """Create a real product scaffold when upstream AI providers are unavailable."""
    niche = (req.niche or "digital product").strip()
    audience = (req.audience or "creators and small business owners").strip()
    product_type = (req.product_type or "ebook").strip()
    title_core = " ".join(w.capitalize() for w in niche.replace("-", " ").split()[:5])
    title = f"{title_core} Playbook"[:80] or "Digital Offer Playbook"
    price = 29.0
    if req.price_hint:
        import re
        prices = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", req.price_hint)]
        if prices:
            price = max(1.0, min(prices[-1], 497.0))
    return {
        "title": title,
        "tagline": f"A practical {product_type} for {audience} who want a faster path from idea to first sale.",
        "description": (
            f"{title} turns {niche} into a simple, sellable execution plan. "
            "It gives buyers the structure, prompts, checklists, and launch steps they need to move quickly without guessing."
        ),
        "target_audience": audience,
        "price": price,
        "bullet_features": [
            "Clear offer positioning worksheet",
            "Step-by-step execution checklist",
            "Buyer promise and angle prompts",
            "Launch copy starter templates",
            "Simple traffic plan for first clicks",
            "Post-launch optimization checklist",
        ],
        "outline": [
            "Pick the painful promise",
            "Define the buyer and outcome",
            "Package the smallest paid win",
            "Write the sales page spine",
            "Create the launch asset checklist",
            "Publish the offer",
            "Drive first traffic",
            "Measure clicks, sales, and objections",
            "Improve or kill based on real data",
        ],
        "sales_copy": (
            f"If you want to turn {niche} into something people can actually buy, this {product_type} gives you the direct path. "
            "No bloated theory, no pretend metrics, no waiting for perfect branding. You get the offer structure, buyer prompts, "
            "sales copy angles, traffic checklist, and launch review steps needed to put a real product in front of real buyers."
        ),
        "cover_concept": f"Premium black and yellow digital cover for {title}, bold typography, commerce-focused layout.",
    }


def _env_provider_credentials(provider: str) -> Dict[str, str]:
    mappings: Dict[str, Dict[str, List[str]]] = {
        "gumroad": {"access_token": ["GUMROAD_ACCESS_TOKEN", "GUMROAD_TOKEN"]},
        "stripe": {"secret_key": ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"]},
        "meta": {
            "access_token": ["META_ACCESS_TOKEN"],
            "ad_account_id": ["META_AD_ACCOUNT_ID"],
            "pixel_id": ["META_PIXEL_ID"],
            "page_id": ["META_PAGE_ID", "FACEBOOK_PAGE_ID"],
        },
        "tiktok": {
            "access_token": ["TIKTOK_ACCESS_TOKEN"],
            "advertiser_id": ["TIKTOK_ADVERTISER_ID"],
        },
        "openai": {"api_key": ["OPENAI_API_KEY"]},
        "anthropic": {"api_key": ["ANTHROPIC_API_KEY"]},
        "stan_store": {"access_token": ["STAN_STORE_ACCESS_TOKEN", "STAN_ACCESS_TOKEN"]},
        "whop": {"api_key": ["WHOP_API_KEY"]},
        "payhip": {"api_key": ["PAYHIP_API_KEY"]},
        "shopify": {
            "store_domain": ["SHOPIFY_STORE_DOMAIN"],
            "admin_api_token": ["SHOPIFY_ADMIN_API_TOKEN"],
        },
        "instagram": {
            "access_token": ["INSTAGRAM_ACCESS_TOKEN"],
            "user_id": ["INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_USER_ID"],
        },
        "twitter": {"bearer_token": ["TWITTER_BEARER_TOKEN", "X_BEARER_TOKEN"]},
        "youtube": {
            "access_token": ["YOUTUBE_ACCESS_TOKEN", "YOUTUBE_API_KEY"],
            "channel_id": ["YOUTUBE_CHANNEL_ID"],
        },
    }
    creds: Dict[str, str] = {}
    for field, env_names in mappings.get(provider, {}).items():
        for env_name in env_names:
            value = os.environ.get(env_name)
            if value:
                creds[field] = value
                break
    return creds


def _merge_env_credentials(provider: str, user_creds: Dict[str, str]) -> Dict[str, str]:
    env_creds = _env_provider_credentials(provider)
    return {**env_creds, **(user_creds or {})}


def _env_configured(provider: str, required: List[str]) -> bool:
    creds = _env_provider_credentials(provider)
    return all(creds.get(field) for field in required)


def _tiktok_config() -> Dict[str, str]:
    client_key = os.environ.get("TIKTOK_CLIENT_KEY") or os.environ.get("TIKTOK_CLIENT_ID") or ""
    client_secret = os.environ.get("TIKTOK_CLIENT_SECRET") or ""
    backend_base = os.environ.get("TIKTOK_BACKEND_URL") or os.environ.get("BACKEND_URL", "")
    if "api.fiilthy.ai" in backend_base or not backend_base:
        backend_base = "https://fiilthy-ai-production-backend.onrender.com"
    backend_redirect = f"{backend_base.rstrip('/')}/api/auth/tiktok/callback"
    redirect_uri = os.environ.get("TIKTOK_REDIRECT_URI") or backend_redirect
    if "api.fiilthy.ai" in redirect_uri:
        redirect_uri = backend_redirect
    scopes = os.environ.get("TIKTOK_SCOPES", "user.info.basic,video.upload,video.publish")
    return {
        "client_key": client_key,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "scopes": scopes,
    }


def _tiktok_ready() -> bool:
    cfg = _tiktok_config()
    return bool(cfg["client_key"] and cfg["client_secret"] and cfg["redirect_uri"])


def _dt_from_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _tiktok_encrypt_token(value: str) -> Dict[str, str]:
    return {"enc": user_settings.encrypt(value or "")}


def _tiktok_decrypt_token(value: Optional[Dict[str, str]]) -> str:
    if not isinstance(value, dict):
        return ""
    return user_settings.decrypt(value.get("enc", ""))


async def _tiktok_store_tokens(user_id: str, token_data: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=int(token_data.get("expires_in") or 0))
    refresh_expires_at = now + timedelta(seconds=int(token_data.get("refresh_expires_in") or 0))
    doc = {
        "user_id": user_id,
        "open_id": token_data.get("open_id"),
        "scope": token_data.get("scope", ""),
        "token_type": token_data.get("token_type", "Bearer"),
        "access_token": _tiktok_encrypt_token(token_data.get("access_token", "")),
        "refresh_token": _tiktok_encrypt_token(token_data.get("refresh_token", "")),
        "expires_at": expires_at.isoformat(),
        "refresh_expires_at": refresh_expires_at.isoformat(),
        "profile": profile or {},
        "connected_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.tiktok_connections.update_one({"user_id": user_id}, {"$set": doc}, upsert=True)
    return doc


async def _tiktok_exchange_code(code: str) -> Dict[str, Any]:
    import httpx
    cfg = _tiktok_config()
    if not _tiktok_ready():
        raise HTTPException(500, "TikTok OAuth is not configured")
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            "https://open.tiktokapis.com/v2/oauth/token/",
            data={
                "client_key": cfg["client_key"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": cfg["redirect_uri"],
            },
            headers={"Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache"},
        )
    data = r.json() if r.content else {}
    if r.status_code >= 400 or data.get("error"):
        raise HTTPException(400, {"message": "tiktok_oauth_exchange_failed", "detail": data})
    return data


async def _tiktok_refresh(conn: Dict[str, Any]) -> str:
    import httpx
    cfg = _tiktok_config()
    refresh_token = _tiktok_decrypt_token(conn.get("refresh_token"))
    if not refresh_token:
        raise HTTPException(401, "TikTok refresh token missing")
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            "https://open.tiktokapis.com/v2/oauth/token/",
            data={
                "client_key": cfg["client_key"],
                "client_secret": cfg["client_secret"],
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache"},
        )
    data = r.json() if r.content else {}
    if r.status_code >= 400 or data.get("error"):
        raise HTTPException(401, {"message": "tiktok_refresh_failed", "detail": data})
    await _tiktok_store_tokens(conn["user_id"], data, conn.get("profile") or {})
    return data["access_token"]


async def _tiktok_access_token(user_id: str) -> str:
    conn = await db.tiktok_connections.find_one({"user_id": user_id}, {"_id": 0})
    if not conn:
        raise HTTPException(409, "TikTok account is not connected")
    expires_at = _dt_from_iso(conn.get("expires_at"))
    if expires_at and expires_at <= datetime.now(timezone.utc) + timedelta(minutes=10):
        return await _tiktok_refresh(conn)
    token = _tiktok_decrypt_token(conn.get("access_token"))
    if not token:
        raise HTTPException(401, "TikTok access token missing")
    return token


async def _tiktok_fetch_profile(access_token: str) -> Dict[str, Any]:
    import httpx
    fields = "open_id,union_id,avatar_url,display_name,profile_deep_link,bio_description"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"https://open.tiktokapis.com/v2/user/info/?fields={fields}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        data = r.json() if r.content else {}
        return (data.get("data") or {}).get("user") or {}
    except Exception:
        return {}


async def _tiktok_revoke(access_token: str) -> Dict[str, Any]:
    import httpx
    cfg = _tiktok_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            "https://open.tiktokapis.com/v2/oauth/revoke/",
            data={"client_key": cfg["client_key"], "client_secret": cfg["client_secret"], "token": access_token},
            headers={"Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache"},
        )
    return r.json() if r.content else {"ok": r.status_code < 400}


def _public_tiktok_connection(conn: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not conn:
        return {"connected": False, "configured": _tiktok_ready()}
    return {
        "connected": True,
        "configured": _tiktok_ready(),
        "open_id": conn.get("open_id"),
        "scope": conn.get("scope", ""),
        "profile": conn.get("profile") or {},
        "expires_at": conn.get("expires_at"),
        "refresh_expires_at": conn.get("refresh_expires_at"),
        "connected_at": conn.get("connected_at"),
    }


async def _upload_video_to_tiktok(user_id: str, video_bytes: bytes, filename: str, caption: str, mode: str, privacy_level: str) -> Dict[str, Any]:
    import httpx
    access_token = await _tiktok_access_token(user_id)
    size = len(video_bytes)
    if size == 0:
        raise HTTPException(400, "Video file is empty")
    max_size = int(os.environ.get("TIKTOK_MAX_UPLOAD_BYTES", str(64 * 1024 * 1024)))
    if size > max_size:
        raise HTTPException(413, f"Video is too large for single-chunk upload. Max is {max_size} bytes.")

    source_info = {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": size, "total_chunk_count": 1}
    if mode == "inbox":
        init_url = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"
        payload = {"source_info": source_info}
    else:
        init_url = "https://open.tiktokapis.com/v2/post/publish/video/init/"
        payload = {
            "post_info": {
                "title": caption[:2200],
                "privacy_level": privacy_level or "SELF_ONLY",
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
            },
            "source_info": source_info,
        }

    async with httpx.AsyncClient(timeout=30.0) as client:
        init = await client.post(
            init_url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json; charset=UTF-8"},
        )
    init_data = init.json() if init.content else {}
    if init.status_code >= 400 or (init_data.get("error") or {}).get("code") not in (None, "ok"):
        raise HTTPException(init.status_code if init.status_code >= 400 else 400, {"message": "tiktok_upload_init_failed", "detail": init_data})

    upload_url = (init_data.get("data") or {}).get("upload_url")
    publish_id = (init_data.get("data") or {}).get("publish_id")
    if not upload_url:
        raise HTTPException(400, {"message": "tiktok_upload_url_missing", "detail": init_data})

    content_type = "video/quicktime" if filename.lower().endswith(".mov") else "video/mp4"
    headers = {
        "Content-Type": content_type,
        "Content-Length": str(size),
        "Content-Range": f"bytes 0-{size - 1}/{size}",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        upload = await client.put(upload_url, content=video_bytes, headers=headers)
    if upload.status_code >= 400:
        raise HTTPException(upload.status_code, {"message": "tiktok_binary_upload_failed", "body": upload.text[:1000]})
    return {"ok": True, "publish_id": publish_id, "mode": mode, "filename": filename, "bytes": size}


# ---------- Routes: auth ----------
@api.get("/")
async def root():
    return {"app": "FiiLTHY.AI", "status": "live"}


@api.get("/health")
async def health():
    return {"ok": True, "service": "fiilthy-api"}


@api.get("/ready")
async def ready():
    checks = {"mongo": False, "stripe_configured": stripe_service.configured()}
    try:
        await db.command("ping")
        checks["mongo"] = True
    except Exception:
        pass
    return {"ok": all([checks["mongo"]]), "checks": checks}


@api.get("/status")
async def public_status():
    return {
        "status": "operational",
        "components": {
            "api": "operational",
            "database": "checked_by_/api/ready",
            "stripe": "configured" if stripe_service.configured() else "not_configured",
            "email": "configured" if os.environ.get("SENDGRID_API_KEY") else "not_configured",
            "analytics": "configured" if os.environ.get("POSTHOG_API_KEY") else "not_configured",
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@api.get("/legal/privacy")
async def privacy_policy():
    company = os.environ.get("LEGAL_COMPANY_NAME", "FiiLTHY.AI")
    contact = os.environ.get("LEGAL_CONTACT_EMAIL", os.environ.get("OWNER_EMAIL", "support@fiilthy.ai"))
    return {
        "title": "Privacy Policy",
        "company": company,
        "contact": contact,
        "sections": [
            "We collect account, billing, product generation, analytics, referral, and support data to operate the service.",
            "Payments are processed by Stripe; we do not store raw card numbers.",
            "Analytics may be processed with PostHog when configured.",
            "Users may request export or deletion by contacting support, subject to legal and fraud-prevention retention duties.",
        ],
        "updated_at": datetime.now(timezone.utc).date().isoformat(),
    }


@api.get("/legal/terms")
async def terms_of_service():
    company = os.environ.get("LEGAL_COMPANY_NAME", "FiiLTHY.AI")
    contact = os.environ.get("LEGAL_CONTACT_EMAIL", os.environ.get("OWNER_EMAIL", "support@fiilthy.ai"))
    return {
        "title": "Terms of Service",
        "company": company,
        "contact": contact,
        "sections": [
            "Use the platform lawfully and do not abuse generation, billing, referral, or launch systems.",
            "Subscriptions renew monthly until cancelled through the billing center or Stripe portal.",
            "Generated content should be reviewed by the user before publication.",
            "Referral payouts are subject to threshold, fraud review, and admin approval.",
        ],
        "updated_at": datetime.now(timezone.utc).date().isoformat(),
    }


@api.post("/auth/signup", response_model=AuthResp)
async def signup(req: SignupReqV2):
    if req.website:
        raise HTTPException(400, "Invalid signup")
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    role = "admin" if is_owner_email(req.email) else "user"
    user_doc = {
        "id": uid,
        "email": req.email.lower(),
        "name": req.name,
        "password": hash_pw(req.password),
        "plan": "free",
        "role": role,
        "generations_used": 0,
        "banned": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    # Record referral attribution if code provided
    try:
        if req.referral_code:
            await referral_service.record_signup_attribution(uid, req.referral_code)
    except Exception as ex:
        log.warning(f"referral attribution failed: {ex}")
    # Ensure this user has their own code
    try:
        await referral_service.ensure_user_referral(user_doc)
    except Exception as ex:
        log.warning(f"ensure_user_referral failed: {ex}")
    # Welcome email (non-blocking best-effort)
    try:
        await email_service.send_email(req.email, "welcome", {"name": req.name})
    except Exception as ex:
        log.warning(f"welcome email failed: {ex}")

    return AuthResp(token=make_token(uid), user=_user_out(user_doc))


@api.post("/auth/login", response_model=AuthResp)
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_pw(req.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")
    if user.get("banned"):
        raise HTTPException(403, "Account suspended")
    # If this is the configured OWNER_EMAIL, force admin so the UI unlocks.
    if is_owner_email(user.get("email", "")) and user.get("role") != "admin":
        try:
            await db.users.update_one({"id": user["id"]}, {"$set": {"role": "admin"}})
            user["role"] = "admin"
        except Exception:
            # Don't block login if Mongo is transiently unavailable.
            pass
    return AuthResp(token=make_token(user["id"]), user=_user_out(user))


@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordReq):
    user = await db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if not user or user.get("banned"):
        return {"ok": True}
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    await db.password_reset_tokens.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "token_hash": token_hash,
        "used": False,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    frontend = os.environ.get("FRONTEND_URL", os.environ.get("BACKEND_URL", "https://fiilthy.ai")).rstrip("/")
    try:
        await email_service.send_email(
            user["email"],
            "password_reset",
            {"reset_url": f"{frontend}/login?reset={raw_token}", "name": user.get("name", "")},
        )
    except Exception:
        pass
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(req: ResetPasswordReq):
    token_hash = hashlib.sha256(req.token.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    token_doc = await db.password_reset_tokens.find_one(
        {"token_hash": token_hash, "used": False, "expires_at": {"$gte": now}},
        {"_id": 0},
    )
    if not token_doc:
        raise HTTPException(400, "Invalid or expired reset token")
    await db.users.update_one({"id": token_doc["user_id"]}, {"$set": {"password": hash_pw(req.password)}})
    await db.password_reset_tokens.update_one(
        {"id": token_doc["id"]},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    # Keep OWNER_EMAIL as admin even if an older record exists.
    if is_owner_email(user.get("email", "")) and user.get("role") != "admin":
        try:
            await db.users.update_one({"id": user["id"]}, {"$set": {"role": "admin"}})
            user["role"] = "admin"
        except Exception:
            pass
    return _user_out(user)


# ---------- Routes: settings ----------
@api.get("/settings")
async def get_settings(user=Depends(current_user)):
    """Return redacted provider creds + configured flags."""
    raw = await user_settings.get_user_providers(db, user["id"])
    providers_view: Dict[str, Any] = {}
    for pid, required in user_settings.PROVIDERS.items():
        doc = raw.get(pid)
        user_configured = user_settings.is_configured(doc, required)
        env_configured = _env_configured(pid, required)
        providers_view[pid] = {
            "configured": user_configured or env_configured,
            "configured_source": "user" if user_configured else ("environment" if env_configured else None),
            "fields": user_settings.redact_for_display(doc),
            "required": required,
        }
    return {"providers": providers_view, "schema": user_settings.PROVIDERS}


@api.put("/settings")
async def update_settings(req: UpdateSettingsReq, user=Depends(current_user)):
    """Save/update any subset of provider creds. Empty string => clear that field."""
    current = await user_settings.get_user_providers(db, user["id"])
    for provider, fields in (req.providers or {}).items():
        if provider not in user_settings.PROVIDERS:
            continue
        # Merge: empty string clears the field; missing keeps existing
        existing = current.get(provider, {}) or {}
        to_save: Dict[str, Any] = {}
        for field_name in user_settings.PROVIDERS[provider]:
            if field_name in fields:
                v = fields[field_name]
                if v is None or str(v).strip() == "":
                    continue  # cleared
                to_save[field_name] = v
            else:
                # Keep existing (already encrypted/plain)
                if field_name in existing:
                    current[provider] = existing  # noop — will be reused below
        prepared = user_settings.prepare_for_storage(provider, to_save)
        # Merge: for fields the user did NOT send, keep existing entry
        merged = dict(existing)
        for k in user_settings.PROVIDERS[provider]:
            if k in fields:
                if str(fields[k] or "").strip() == "":
                    merged.pop(k, None)   # explicit clear
                elif k in prepared:
                    merged[k] = prepared[k]
        current[provider] = merged
    await db.user_settings.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "providers": current,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {"user_id": user["id"]}},
        upsert=True,
    )
    return await get_settings(user)


@api.delete("/settings/{provider}")
async def clear_provider(provider: str, user=Depends(current_user)):
    if provider not in user_settings.PROVIDERS:
        raise HTTPException(400, "Unknown provider")
    await db.user_settings.update_one(
        {"user_id": user["id"]},
        {"$unset": {f"providers.{provider}": ""}},
    )
    return await get_settings(user)


@api.post("/settings/test/{provider}")
async def test_provider(provider: str, user=Depends(current_user)):
    """Run a lightweight credential test for the given provider."""
    creds = _merge_env_credentials(
        provider,
        await user_settings.get_provider_plain(db, user["id"], provider),
    )
    if not creds:
        return {"ok": False, "error": "not_configured"}
    if provider == "gumroad":
        return await gumroad_verify(creds.get("access_token", ""))
    if provider == "meta":
        import httpx
        token = creds.get("access_token", "")
        if not token:
            return {"ok": False, "error": "missing_token"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                r = await c.get(f"https://graph.facebook.com/v19.0/me?access_token={token}")
            data = r.json()
            if r.status_code < 400:
                return {"ok": True, "name": data.get("name"), "id": data.get("id")}
            return {"ok": False, "error": data.get("error", {}).get("message", f"http_{r.status_code}")}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    if provider == "stripe":
        import httpx
        sk = creds.get("secret_key", "")
        if not sk:
            return {"ok": False, "error": "missing_secret_key"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                r = await c.get("https://api.stripe.com/v1/account", headers={"Authorization": f"Bearer {sk}"})
            if r.status_code < 400:
                return {"ok": True, "account_id": r.json().get("id")}
            return {"ok": False, "error": r.json().get("error", {}).get("message", f"http_{r.status_code}")}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    # Other providers: presence check only (publishing call is the real test)
    return {"ok": True, "note": "credentials saved — publishing will perform full validation"}


# ---------- TikTok OAuth + Posting ----------
@api.get("/auth/tiktok/status")
async def tiktok_status(user=Depends(current_user)):
    conn = await db.tiktok_connections.find_one({"user_id": user["id"]}, {"_id": 0})
    return _public_tiktok_connection(conn)


@api.get("/auth/tiktok/login")
async def tiktok_login(user=Depends(current_user)):
    cfg = _tiktok_config()
    if not _tiktok_ready():
        raise HTTPException(500, "TikTok OAuth env vars are not configured")
    from urllib.parse import urlencode
    state = secrets.token_urlsafe(32)
    await db.tiktok_oauth_states.insert_one({
        "state": state,
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
        "used": False,
    })
    params = urlencode({
        "client_key": cfg["client_key"],
        "scope": cfg["scopes"],
        "response_type": "code",
        "redirect_uri": cfg["redirect_uri"],
        "state": state,
    })
    return {"auth_url": f"https://www.tiktok.com/v2/auth/authorize/?{params}", "state": state, "scopes": cfg["scopes"]}


@api.get("/auth/tiktok/callback")
@api.get("/social/tiktok/callback")
async def tiktok_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, error_description: Optional[str] = None):
    frontend = os.environ.get("FRONTEND_URL", "https://fiilthy-ai-production-frontend.vercel.app").rstrip("/")
    if error:
        return RedirectResponse(f"{frontend}/app/settings?tiktok=error&reason={error}")
    if not code or not state:
        return RedirectResponse(f"{frontend}/app/settings?tiktok=error&reason=missing_code_or_state")

    state_doc = await db.tiktok_oauth_states.find_one({"state": state, "used": False}, {"_id": 0})
    if not state_doc:
        return RedirectResponse(f"{frontend}/app/settings?tiktok=error&reason=invalid_state")
    expires_at = _dt_from_iso(state_doc.get("expires_at"))
    if not expires_at or expires_at < datetime.now(timezone.utc):
        return RedirectResponse(f"{frontend}/app/settings?tiktok=error&reason=state_expired")

    try:
        token_data = await _tiktok_exchange_code(code)
        profile = await _tiktok_fetch_profile(token_data.get("access_token", ""))
        await _tiktok_store_tokens(state_doc["user_id"], token_data, profile)
        await db.tiktok_oauth_states.update_one({"state": state}, {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}})
    except Exception as ex:
        log.error("TikTok OAuth callback failed: %s", ex)
        return RedirectResponse(f"{frontend}/app/settings?tiktok=error&reason=exchange_failed")
    return RedirectResponse(f"{frontend}/app/settings?tiktok=connected")


@api.delete("/disconnect/tiktok")
@api.post("/disconnect/tiktok")
async def tiktok_disconnect(user=Depends(current_user)):
    conn = await db.tiktok_connections.find_one({"user_id": user["id"]}, {"_id": 0})
    if conn:
        token = _tiktok_decrypt_token(conn.get("access_token"))
        if token and _tiktok_ready():
            try:
                await _tiktok_revoke(token)
            except Exception as ex:
                log.warning("TikTok revoke failed for user %s: %s", user["id"], ex)
    await db.tiktok_connections.delete_one({"user_id": user["id"]})
    return {"ok": True, "connected": False}


@api.post("/post/tiktok")
async def tiktok_post_video(
    video: UploadFile = File(...),
    caption: str = Form(""),
    hashtags: str = Form(""),
    schedule_at: Optional[str] = Form(None),
    mode: str = Form("direct"),
    privacy_level: str = Form("SELF_ONLY"),
    user=Depends(current_user),
):
    mode = mode if mode in ("direct", "inbox") else "direct"
    caption_full = caption.strip()
    tags = " ".join(f"#{h.strip().lstrip('#')}" for h in hashtags.replace(",", " ").split() if h.strip())
    if tags and tags not in caption_full:
        caption_full = f"{caption_full}\n\n{tags}".strip()

    schedule_dt = _dt_from_iso(schedule_at) if schedule_at else None
    now = datetime.now(timezone.utc)
    if schedule_dt and schedule_dt > now + timedelta(minutes=1):
        upload_dir = ROOT_DIR / "uploads" / "tiktok"
        upload_dir.mkdir(parents=True, exist_ok=True)
        ext = ".mov" if (video.filename or "").lower().endswith(".mov") else ".mp4"
        post_id = str(uuid.uuid4())
        path = upload_dir / f"{post_id}{ext}"
        content = await video.read()
        path.write_bytes(content)
        doc = {
            "id": post_id,
            "user_id": user["id"],
            "filename": video.filename,
            "local_path": str(path),
            "caption": caption_full,
            "mode": mode,
            "privacy_level": privacy_level,
            "status": "SCHEDULED",
            "scheduled_for": schedule_dt.isoformat(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        await db.tiktok_post_queue.insert_one(doc.copy())
        doc.pop("local_path", None)
        return {"ok": True, "queued": True, "post": doc}

    content = await video.read()
    result = await _upload_video_to_tiktok(user["id"], content, video.filename or "video.mp4", caption_full, mode, privacy_level)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "filename": video.filename,
        "caption": caption_full,
        "mode": mode,
        "privacy_level": privacy_level,
        "status": "UPLOADED",
        "tiktok_result": result,
        "created_at": now.isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tiktok_post_queue.insert_one(doc.copy())
    return {"ok": True, "queued": False, "post": {k: v for k, v in doc.items() if k != "local_path"}}


@api.get("/post/tiktok")
async def tiktok_posts(user=Depends(current_user)):
    rows = await db.tiktok_post_queue.find({"user_id": user["id"]}, {"_id": 0, "local_path": 0}).sort("created_at", -1).to_list(100)
    return {"posts": rows}


# ---------- Routes: products ----------
@api.post("/products/generate", response_model=Product)
async def generate_product(req: GenerateProductReq, user=Depends(current_user)):
    await _check_and_increment_usage(user)

    # Allow per-user OpenAI / Anthropic override (else platform Emergent LLM key)
    # (For now we stick to Claude via Emergent key — platform-paid.)
    sys_msg = (
        "You are FiiLTHY.AI, a ruthless digital-product strategist for creator-economy hustlers. "
        "Generate raw, edgy, conversion-focused digital products. "
        "Always respond with STRICT VALID JSON only — no commentary, no markdown fences."
    )
    prompt = f"""Create a brand-new sellable digital product.

Niche: {req.niche}
Target audience: {req.audience or 'auto-detect a sharp niche audience'}
Product type: {req.product_type}
Price hint: {req.price_hint or 'recommend a price between $9 and $97'}
Notes: {req.extra_notes or 'none'}

Return JSON with EXACT keys:
{{
  "title": "string (bold, hook-style, max 8 words)",
  "tagline": "string (one punchy line)",
  "description": "string (2-3 sentence sales-ready blurb)",
  "target_audience": "string (specific persona)",
  "price": number (USD, no currency symbol),
  "bullet_features": ["6 sharp benefit-driven bullets"],
  "outline": ["7-10 chapter/module/section titles"],
  "sales_copy": "string (~120 words punchy direct-response copy)",
  "cover_concept": "string (one-line visual brief for the cover)"
}}"""
    try:
        raw = await llm_json(sys_msg, prompt, session_id=f"product-{user['id']}-{uuid.uuid4().hex[:8]}")
        data = _safe_json_parse(raw)
    except HTTPException as ex:
        if ex.status_code != 503:
            raise ex
        data = _fallback_product_data(req)

    pid = str(uuid.uuid4())
    product = {
        "id": pid,
        "user_id": user["id"],
        "title": str(data.get("title", "Untitled Product"))[:200],
        "tagline": str(data.get("tagline", ""))[:300],
        "description": str(data.get("description", ""))[:1500],
        "target_audience": str(data.get("target_audience", req.audience or "creators"))[:300],
        "price": float(data.get("price", 27.0)),
        "product_type": req.product_type or "ebook",
        "bullet_features": [str(b) for b in (data.get("bullet_features") or [])][:10],
        "outline": [str(o) for o in (data.get("outline") or [])][:15],
        "sales_copy": str(data.get("sales_copy", ""))[:3000],
        "cover_concept": str(data.get("cover_concept", ""))[:500],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "campaigns_count": 0,
        "launched_stores": [],
    }
    await db.products.insert_one(product.copy())
    return Product(**product)


@api.get("/products", response_model=List[Product])
async def list_products(user=Depends(current_user)):
    rows = await db.products.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for row in rows:
        tt_count = await db.tiktok_posts.count_documents({"product_id": row["id"], "user_id": user["id"]})
        row["tiktok_posts_count"] = max(3, int(tt_count or 0))
        required = [
            bool(row.get("title")),
            bool(row.get("description")),
            bool(row.get("sales_copy")),
            bool(row.get("cover_concept")),
            bool(row.get("bullet_features")),
            bool(row.get("outline")),
            row["tiktok_posts_count"] >= 3,
        ]
        row["completeness_score"] = int(round(sum(1 for x in required if x) / len(required) * 100))
        row["manual_assets"] = ["product.pdf", "cover.png", "store_upload_kit.md", "sales_copy.txt", "3+ promo videos"]
    return [Product(**r) for r in rows]


@api.get("/products/{pid}", response_model=Product)
async def get_product(pid: str, user=Depends(current_user)):
    p = await db.products.find_one({"id": pid, "user_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    return Product(**p)


@api.patch("/products/{pid}", response_model=Product)
async def update_product(pid: str, req: UpdateProductReq, user=Depends(current_user)):
    current = await db.products.find_one({"id": pid, "user_id": user["id"]}, {"_id": 0})
    if not current:
        raise HTTPException(404, "Product not found")

    changes = req.model_dump(exclude_unset=True)
    if "bullet_features" in changes and changes["bullet_features"] is not None:
        changes["bullet_features"] = [str(b).strip() for b in changes["bullet_features"] if str(b).strip()][:10]
    if "outline" in changes and changes["outline"] is not None:
        changes["outline"] = [str(o).strip() for o in changes["outline"] if str(o).strip()][:15]
    if "price" in changes and changes["price"] is not None:
        changes["price"] = round(float(changes["price"]), 2)

    if changes:
        changes["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.products.update_one({"id": pid, "user_id": user["id"]}, {"$set": changes})

    updated = await db.products.find_one({"id": pid, "user_id": user["id"]}, {"_id": 0})
    return Product(**updated)


@api.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(current_user)):
    res = await db.products.delete_one({"id": pid, "user_id": user["id"]})
    await db.campaigns.delete_many({"product_id": pid, "user_id": user["id"]})
    await db.listings.delete_many({"product_id": pid, "user_id": user["id"]})
    return {"deleted": res.deleted_count}


# ---------- Product downloads ----------
async def _fetch_bundle(pid: str, user_id: str):
    product = await db.products.find_one({"id": pid, "user_id": user_id}, {"_id": 0})
    if not product:
        return None
    campaigns = await db.campaigns.find({"product_id": pid, "user_id": user_id}, {"_id": 0}).to_list(100)
    tiktok_posts = await db.tiktok_posts.find({"product_id": pid, "user_id": user_id}, {"_id": 0, "user_id": 0}).to_list(100)
    return {"product": product, "campaigns": campaigns, "tiktok_posts": tiktok_posts}


def _safe_filename(text: str) -> str:
    import re
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-")
    return (s or "product")[:60]


@api.get("/products/{pid}/download/pdf")
async def download_product_pdf(pid: str, user=Depends(current_user)):
    bundle = await _fetch_bundle(pid, user["id"])
    if not bundle:
        raise HTTPException(404, "Product not found")
    code = await referral_service.ensure_user_referral(user)
    backend = os.environ.get("BACKEND_URL", "").rstrip("/")
    referral_url = f"{backend}/signup?ref={code}" if backend else None
    pdf_bytes = build_product_pdf(bundle["product"], referral_url=referral_url)
    fname = f"{_safe_filename(bundle['product'].get('title', 'product'))}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/products/{pid}/download/cover")
async def download_product_cover(pid: str, user=Depends(current_user)):
    bundle = await _fetch_bundle(pid, user["id"])
    if not bundle:
        raise HTTPException(404, "Product not found")
    cover_bytes = build_cover_png(bundle["product"])
    fname = f"{_safe_filename(bundle['product'].get('title', 'product'))}-cover.png"
    return Response(
        content=cover_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/products/{pid}/download/bundle")
async def download_product_bundle(pid: str, user=Depends(current_user)):
    bundle = await _fetch_bundle(pid, user["id"])
    if not bundle:
        raise HTTPException(404, "Product not found")
    code = await referral_service.ensure_user_referral(user)
    backend = os.environ.get("BACKEND_URL", "").rstrip("/")
    referral_url = f"{backend}/signup?ref={code}" if backend else None
    zip_bytes = build_product_bundle_zip(
        bundle["product"], bundle["campaigns"], bundle["tiktok_posts"],
        referral_url=referral_url,
    )
    fname = f"{_safe_filename(bundle['product'].get('title', 'product'))}-bundle.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


async def _product_post_for_video(pid: str, content_id: str, user_id: str):
    bundle = await _fetch_bundle(pid, user_id)
    if not bundle:
        raise HTTPException(404, "Product not found")
    posts = bundle["tiktok_posts"]
    if not posts:
        posts = fallback_tiktok_posts(bundle["product"], count=5)

    idx = 0
    if content_id:
        m = re.search(r"(\d+)$", str(content_id))
        if m:
            idx = max(0, int(m.group(1)) - 1)
    if idx >= len(posts):
        idx = 0
    return bundle["product"], posts[idx], f"tiktok_post_{idx + 1}"


@api.get("/products/{pid}/promo-video/{content_id}")
async def download_product_promo_video(pid: str, content_id: str, request: Request, user=Depends(current_user)):
    product, post, resolved_content_id = await _product_post_for_video(pid, content_id, user["id"])
    backend_base = _tracking_base(request)
    cta_url = _track_url(backend_base, pid, "tiktok", resolved_content_id) if backend_base else ""
    video_bytes = build_promo_video_mp4(product, post, cta_url=cta_url)
    fname = f"{_safe_filename(product.get('title', 'product'))}-{resolved_content_id}.mp4"
    return Response(
        content=video_bytes,
        media_type="video/mp4",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/products/{pid}/promo-videos.zip")
async def download_product_promo_videos_zip(pid: str, request: Request, user=Depends(current_user)):
    bundle = await _fetch_bundle(pid, user["id"])
    if not bundle:
        raise HTTPException(404, "Product not found")
    posts = bundle["tiktok_posts"] or fallback_tiktok_posts(bundle["product"], count=5)
    backend_base = _tracking_base(request)
    safe = _safe_filename(bundle["product"].get("title", "product"))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for idx, post in enumerate(posts[:5], 1):
            content_id = f"tiktok_post_{idx}"
            cta_url = _track_url(backend_base, pid, "tiktok", content_id) if backend_base else ""
            z.writestr(f"{safe}-{content_id}.mp4", build_promo_video_mp4(bundle["product"], post, cta_url=cta_url))
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe}-promo-videos.zip"'},
    )


@api.get("/products/download/all")
async def download_all_products(user=Depends(current_user)):
    products = await db.products.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    if not products:
        raise HTTPException(404, "No products to download")
    items = []
    for p in products:
        camps = await db.campaigns.find({"product_id": p["id"], "user_id": user["id"]}, {"_id": 0}).to_list(100)
        tt = await db.tiktok_posts.find({"product_id": p["id"], "user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(100)
        items.append({"product": p, "campaigns": camps, "tiktok_posts": tt})
    code = await referral_service.ensure_user_referral(user)
    backend = os.environ.get("BACKEND_URL", "").rstrip("/")
    referral_url = f"{backend}/signup?ref={code}" if backend else None
    zip_bytes = build_library_zip(items, referral_url=referral_url)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="filthy-library.zip"'},
    )


# ---------- Routes: campaigns ----------
@api.post("/campaigns/generate", response_model=Campaign)
async def generate_campaign(req: CampaignReq, user=Depends(current_user)):
    product = await db.products.find_one({"id": req.product_id, "user_id": user["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    await _check_and_increment_usage(user)

    sys_msg = (
        "You are FiiLTHY.AI's ad campaign engine. Generate raw, scroll-stopping, conversion-focused "
        "ad creatives for multiple platforms. Always respond with STRICT VALID JSON only."
    )
    prompt = f"""Build a multi-platform ad campaign for this product.

Product: {product['title']}
Tagline: {product['tagline']}
Description: {product['description']}
Audience: {product['target_audience']}
Price: ${product['price']}
Creative angle override: {req.angle or 'auto pick the highest-conversion angle'}

Generate ONE ad variant for EACH of these 5 platforms: TikTok Ads, Meta Ads, YouTube Ads, Twitter Ads, Pinterest Ads.

Return JSON with EXACT keys:
{{
  "angle": "string (the chosen creative angle)",
  "daily_budget_suggestion": number (USD, between 10 and 200),
  "variants": [
    {{
      "platform": "TikTok Ads",
      "hook": "string (first 3 seconds, max 15 words, scroll-stopping)",
      "script": "string (15-30 second script with timestamps like 0:00 / 0:05 / 0:15 / 0:25)",
      "cta": "string (one strong CTA line)",
      "hashtags": ["8 platform-relevant hashtags without #"],
      "targeting": "string (one-line audience targeting brief)"
    }},
    ... (one per platform)
  ]
}}"""
    try:
        raw = await llm_json(sys_msg, prompt, session_id=f"camp-{user['id']}-{uuid.uuid4().hex[:8]}")
        data = _safe_json_parse(raw)
    except HTTPException as ex:
        raise ex
    except Exception as ex:
        log.warning("Campaign AI parse failed for user=%s product=%s error=%s", user["id"], product["id"], ex)
        raise HTTPException(500, "AI returned malformed campaign output. Please retry.")

    variants_data = data.get("variants") or []
    variants: List[AdVariant] = []
    for v in variants_data[:5]:
        try:
            variants.append(
                AdVariant(
                    platform=str(v.get("platform", "TikTok Ads")),
                    hook=str(v.get("hook", ""))[:300],
                    script=str(v.get("script", ""))[:2000],
                    cta=str(v.get("cta", ""))[:200],
                    hashtags=[str(h).lstrip("#") for h in (v.get("hashtags") or [])][:12],
                    targeting=str(v.get("targeting", ""))[:400],
                )
            )
        except Exception:
            continue
    if not variants:
        raise HTTPException(500, "AI returned no usable campaign variants. Please retry.")

    cid = str(uuid.uuid4())
    camp_doc = {
        "id": cid,
        "user_id": user["id"],
        "product_id": product["id"],
        "product_title": product["title"],
        "angle": str(data.get("angle", req.angle or "Direct Response"))[:300],
        "daily_budget_suggestion": float(data.get("daily_budget_suggestion", 25.0)),
        "variants": [v.model_dump() for v in variants],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.campaigns.insert_one(camp_doc.copy())
    await db.products.update_one({"id": product["id"]}, {"$inc": {"campaigns_count": 1}})
    return Campaign(**camp_doc)


@api.get("/campaigns", response_model=List[Campaign])
async def list_campaigns(product_id: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if product_id:
        q["product_id"] = product_id
    rows = await db.campaigns.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Campaign(**r) for r in rows]


# ---------- Routes: launch ----------
@api.get("/stores")
async def list_stores():
    return {"stores": STORES}


def _slugify(text: str) -> str:
    import re
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60] or "product"


@api.post("/launch", response_model=LaunchResult)
async def launch_product(req: LaunchReq, user=Depends(current_user)):
    product = await db.products.find_one({"id": req.product_id, "user_id": user["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    target_stores = req.stores or [s["id"] for s in STORES]
    slug = _slugify(product["title"])
    now = datetime.now(timezone.utc).isoformat()

    # Load per-user store credentials
    providers = await user_settings.get_user_providers(db, user["id"])

    def creds(name: str) -> Dict[str, str]:
        return user_settings.decrypt_for_use(providers.get(name))

    gumroad_c = _merge_env_credentials("gumroad", creds("gumroad"))
    stan_c = _merge_env_credentials("stan_store", creds("stan_store"))
    whop_c = _merge_env_credentials("whop", creds("whop"))
    payhip_c = _merge_env_credentials("payhip", creds("payhip"))

    listings: List[StoreListing] = []
    listing_docs = []
    for sid in target_stores:
        store = next((s for s in STORES if s["id"] == sid), None)
        if not store:
            continue

        listing_title = f"{product['title']} — {product['tagline']}"[:140]
        listing_description = product["description"][:500]
        real = False
        error = None
        status_str = "NOT_CONFIGURED"
        url = ""

        price_cents = int(round(float(product.get("price", 27.0)) * 100))
        full_desc = f"{product.get('sales_copy', product['description'])}\n\n---\n{chr(10).join(product.get('bullet_features', []))}"

        try:
            if sid == "gumroad" and gumroad_c.get("access_token"):
                res = await gumroad_create_product(
                    name=product["title"],
                    price_cents=price_cents,
                    description=full_desc,
                    access_token=gumroad_c["access_token"],
                )
                if res.get("ok") and res.get("short_url"):
                    url = res["short_url"]
                    real = True
                    status_str = "LIVE"
                else:
                    error = str(res.get("error", "gumroad_failed"))[:200]
                    status_str = "FAILED"
            elif sid == "stan_store" and stan_c.get("access_token"):
                res = await stan_create_product(
                    stan_c["access_token"], product["title"], price_cents, full_desc,
                )
                if res.get("ok") and res.get("short_url"):
                    url = res["short_url"]
                    real = True
                    status_str = "LIVE"
                else:
                    error = str(res.get("error", "stan_failed"))[:200]
                    status_str = "FAILED"
            elif sid == "whop" and whop_c.get("api_key"):
                res = await whop_create_product(
                    whop_c["api_key"], product["title"], price_cents, full_desc,
                )
                if res.get("ok") and res.get("short_url"):
                    url = res["short_url"]
                    real = True
                    status_str = "LIVE"
                else:
                    error = str(res.get("error", "whop_failed"))[:200]
                    status_str = "FAILED"
            elif sid == "payhip" and payhip_c.get("api_key"):
                res = await payhip_create_product(
                    payhip_c["api_key"], product["title"], price_cents, full_desc,
                )
                if res.get("ok") and res.get("short_url"):
                    url = res["short_url"]
                    real = True
                    status_str = "LIVE"
                else:
                    error = str(res.get("error", "payhip_failed"))[:200]
                    status_str = "FAILED"
            elif sid in ("gumroad", "stan_store", "whop", "payhip"):
                error = f"Add your {store['name']} credentials in Settings or backend env to publish for real."
        except Exception as ex:
            error = f"exception: {ex}"[:200]
            status_str = "FAILED"

        listing = StoreListing(
            store_id=sid,
            store_name=store["name"],
            listing_url=url,
            status=status_str,
            listing_title=listing_title,
            listing_description=listing_description,
            launched_at=now,
            real=real,
            error=error,
        )
        listings.append(listing)
        listing_docs.append({
            **listing.model_dump(),
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "product_id": product["id"],
        })

    if listing_docs:
        await db.listings.insert_many(listing_docs)
    live_ids = [lst.store_id for lst in listings if lst.status == "LIVE"]
    if live_ids:
        await db.products.update_one(
            {"id": product["id"]},
            {
                "$addToSet": {"launched_stores": {"$each": live_ids}},
                "$set": {"launched_at": now},
            },
        )
    # Launch success email (best-effort, only if at least one LIVE listing)
    try:
        real_count = sum(1 for lst in listings if lst.status == "LIVE")
        if real_count > 0:
            await email_service.send_email(
                user["email"], "launch_success",
                {"title": product["title"], "product_id": product["id"],
                 "store_count": len(listings), "real_count": real_count},
            )
    except Exception:
        pass

    # ===== META ADS AUTO-LAUNCH (PAUSED) — uses per-user creds =====
    meta_c = _merge_env_credentials("meta", creds("meta"))
    meta_token = meta_c.get("access_token")
    meta_ad_account = meta_c.get("ad_account_id")
    meta_pixel = meta_c.get("pixel_id")
    meta_page = meta_c.get("page_id")
    existing_meta = await db.meta_launches.find_one(
        {"product_id": product["id"], "user_id": user["id"]}, {"_id": 0}
    )
    product_url = next((lst.listing_url for lst in listings if lst.real and lst.status == "LIVE"), None)
    if meta_token and meta_ad_account and product_url and not existing_meta:
        try:
            camp_doc = await db.campaigns.find_one(
                {"product_id": product["id"], "user_id": user["id"]},
                {"_id": 0},
                sort=[("created_at", -1)],
            )
            meta_variant = None
            if camp_doc:
                for v in camp_doc.get("variants", []):
                    if v.get("platform") == "Meta Ads":
                        meta_variant = v
                        break

            headlines = [meta_variant["hook"]] if meta_variant else [product["title"]]
            primary_texts = [meta_variant["script"]] if meta_variant else [product["sales_copy"]]
            image_urls = [
                url for url in product.get("image_urls", [])
                if isinstance(url, str) and url.startswith(("http://", "https://"))
            ][:3]

            while len(headlines) < 3:
                headlines.append(product["title"])
            while len(primary_texts) < 3:
                primary_texts.append(product["tagline"] or product["description"])

            if not image_urls:
                log.info("Meta auto-launch skipped for product %s: no real image URLs available", product["id"])
                return LaunchResult(product_id=product["id"], listings=listings)
            while len(image_urls) < 3:
                image_urls.append(image_urls[-1])

            camp_res = await meta_ads.create_campaign(
                meta_ad_account, meta_token, name=f"FiiLTHY — {product['title'][:80]}"
            )
            if not camp_res.get("ok"):
                await db.meta_launches.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": user["id"],
                    "product_id": product["id"],
                    "status": "failed",
                    "stage": "campaign",
                    "error": camp_res,
                    "created_at": now,
                })
            else:
                campaign_id = camp_res["campaign_id"]
                adset_res = await meta_ads.create_ad_set(
                    meta_ad_account, campaign_id, meta_token,
                    name=f"FiiLTHY — {product['title'][:80]}",
                    pixel_id=meta_pixel,
                )
                if not adset_res.get("ok"):
                    await db.meta_launches.insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": user["id"],
                        "product_id": product["id"],
                        "campaign_id": campaign_id,
                        "status": "failed",
                        "stage": "adset",
                        "error": adset_res,
                        "created_at": now,
                    })
                else:
                    adset_id = adset_res["adset_id"]
                    ads = []
                    errors = []
                    for i in range(3):
                        cr = await meta_ads.create_ad_creative(
                            meta_ad_account, meta_token,
                            headline=headlines[i],
                            primary_text=primary_texts[i],
                            image_url=image_urls[i],
                            link=product_url,
                            page_id=meta_page,
                            name=f"FiiLTHY Creative {i+1} — {product['title'][:60]}",
                        )
                        if not cr.get("ok"):
                            errors.append({"stage": f"creative_{i+1}", "error": cr})
                            continue
                        ad_res = await meta_ads.create_ad(
                            meta_ad_account, adset_id, cr["creative_id"], meta_token,
                            name=f"FiiLTHY Ad {i+1} — {product['title'][:60]}",
                        )
                        if not ad_res.get("ok"):
                            errors.append({"stage": f"ad_{i+1}", "creative_id": cr["creative_id"], "error": ad_res})
                            continue
                        ads.append({
                            "ad_id": ad_res["ad_id"],
                            "creative_id": cr["creative_id"],
                            "headline": headlines[i],
                            "primary_text": primary_texts[i],
                            "image_url": image_urls[i],
                            "status": "PAUSED",
                        })
                    await db.meta_launches.insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": user["id"],
                        "product_id": product["id"],
                        "ad_account_id": meta_ad_account,
                        "campaign_id": campaign_id,
                        "adset_id": adset_id,
                        "ads": ads,
                        "product_url": product_url,
                        "status": "PAUSED",
                        "errors": errors,
                        "stage": "complete" if ads else "failed_all_ads",
                        "created_at": now,
                    })
                    await db.products.update_one(
                        {"id": product["id"]},
                        {"$set": {
                            "meta_campaign_id": campaign_id,
                            "meta_adset_id": adset_id,
                            "meta_ad_ids": [a["ad_id"] for a in ads],
                            "meta_status": "PAUSED",
                        }},
                    )
        except Exception as ex:
            log.error(f"Meta auto-launch exception for product {product['id']}: {ex}")
            await db.meta_launches.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "product_id": product["id"],
                "status": "failed",
                "stage": "exception",
                "error": {"message": str(ex)},
                "created_at": now,
            })

    # ===== TIKTOK AUTO-GENERATION =====
    has_real_listing = any(lst.status == "LIVE" and lst.real for lst in listings)
    existing_tiktok = await db.tiktok_posts.count_documents(
        {"product_id": product["id"], "user_id": user["id"]}
    )
    if has_real_listing and existing_tiktok == 0:
        try:
            tt_posts = await generate_tiktok_posts(product, count=5)
            for p in tt_posts:
                p["created_at"] = now
            if tt_posts:
                await db.tiktok_posts.insert_many([{
                    **p,
                    "user_id": user["id"],
                    "product_id": product["id"],
                } for p in tt_posts])
        except Exception as ex:
            log.warning(f"TikTok auto-gen skipped for {product['id']}: {ex}")

    return LaunchResult(product_id=product["id"], listings=listings)


@api.get("/listings")
async def get_listings(product_id: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if product_id:
        q["product_id"] = product_id
    rows = await db.listings.find(q, {"_id": 0}).sort("launched_at", -1).to_list(1000)
    return {"listings": rows}


# ---------- Stats ----------
@api.get("/stats")
async def stats(user=Depends(current_user)):
    products = await db.products.count_documents({"user_id": user["id"]})
    campaigns = await db.campaigns.count_documents({"user_id": user["id"]})
    listings = await db.listings.count_documents({"user_id": user["id"]})
    # Count configured providers
    providers = await user_settings.get_user_providers(db, user["id"])
    configured = sum(
        1 for pid, req in user_settings.PROVIDERS.items()
        if user_settings.is_configured(providers.get(pid), req)
    )
    return {
        "products": products,
        "campaigns": campaigns,
        "listings": listings,
        "plan": user.get("plan", "free"),
        "generations_used": user.get("generations_used", 0),
        "plan_limit": PLAN_LIMITS.get(user.get("plan", "free"), 5),
        "integrations_configured": configured,
        "integrations_total": len(user_settings.PROVIDERS),
    }


# ---------- Meta Ads ----------
@api.get("/meta/export/{product_id}")
async def meta_export(product_id: str, request: Request, user=Depends(current_user)):
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")

    listings_rows = await db.listings.find(
        {"product_id": product_id, "user_id": user["id"]}, {"_id": 0}
    ).to_list(50)
    real_listing = next((l for l in listings_rows if l.get("real") and l.get("status") == "LIVE"), None)
    product_url = (real_listing or {}).get("listing_url", "")
    if not product_url:
        raise HTTPException(409, "A real store listing is required before exporting Meta ads.")

    camp = await db.campaigns.find_one(
        {"product_id": product_id, "user_id": user["id"]},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    headlines: List[str] = []
    primary_texts: List[str] = []
    image_urls: List[str] = []
    if camp:
        for v in camp.get("variants", []):
            if v.get("platform") == "Meta Ads":
                headlines.append(v.get("hook", ""))
                primary_texts.append(v.get("script", ""))
                break
        for v in camp.get("variants", []):
            if v.get("platform") in ("TikTok Ads", "YouTube Ads") and len(headlines) < 3:
                headlines.append(v.get("hook", ""))
                primary_texts.append(v.get("script", ""))

    while len(headlines) < 3:
        headlines.append(product["title"])
    while len(primary_texts) < 3:
        primary_texts.append(product.get("sales_copy") or product["description"])
    image_urls = [
        url for url in product.get("image_urls", [])
        if isinstance(url, str) and url.startswith(("http://", "https://"))
    ][:3]
    if not image_urls:
        raise HTTPException(409, "Add a real product image before exporting Meta ads.")
    while len(image_urls) < 3:
        image_urls.append(image_urls[-1])

    creatives = []
    backend_base = os.environ.get("BACKEND_URL", "")
    for i in range(3):
        cid = f"meta_ad_{i+1}"
        per_creative_url = _track_url(backend_base, product_id, "meta", cid) if backend_base else _append_utm(product_url, "meta", product_id, cid)
        creatives.append({
            "content_id": cid,
            "headline": headlines[i][:300],
            "primary_text": primary_texts[i][:1800],
            "image_url": image_urls[i],
            "recommended": i == 0,
            "tracking_url": per_creative_url,
        })

    return {
        "campaign": {
            "name": f"{product['title']} - Conversion Campaign"[:200],
            "objective": "Sales",
        },
        "targeting": {
            "locations": ["US", "CA"],
            "type": "broad",
            "optimization": "Conversions",
        },
        "creatives": creatives,
        "product_url": product_url,
        "ads_manager_url": "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
    }


@api.get("/meta/launch/{product_id}")
async def get_meta_launch(product_id: str, user=Depends(current_user)):
    ml = await db.meta_launches.find_one(
        {"product_id": product_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not ml:
        raise HTTPException(404, "No Meta launch for this product")
    return ml


@api.post("/meta/activate/{product_id}")
async def activate_meta(product_id: str, user=Depends(current_user)):
    ml = await db.meta_launches.find_one(
        {"product_id": product_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not ml:
        raise HTTPException(404, "No Meta launch for this product")
    meta_c = await user_settings.get_provider_plain(db, user["id"], "meta")
    token = meta_c.get("access_token")
    if not token:
        raise HTTPException(400, "Meta credentials not configured in Settings")

    campaign_id = ml.get("campaign_id")
    adset_id = ml.get("adset_id")
    ads = ml.get("ads", []) or []

    if not campaign_id or not adset_id or not ads:
        raise HTTPException(400, "Meta launch incomplete — nothing to activate")

    results = {"campaign": None, "adset": None, "ads": [], "errors": []}

    try:
        c = await meta_ads.set_status(campaign_id, "ACTIVE", token)
        results["campaign"] = c
        if not c.get("ok"):
            results["errors"].append({"stage": "campaign", "error": c})

        a = await meta_ads.set_status(adset_id, "ACTIVE", token)
        results["adset"] = a
        if not a.get("ok"):
            results["errors"].append({"stage": "adset", "error": a})

        for ad in ads:
            r = await meta_ads.set_status(ad["ad_id"], "ACTIVE", token)
            results["ads"].append({"ad_id": ad["ad_id"], "result": r})
            if not r.get("ok"):
                results["errors"].append({"stage": f"ad:{ad['ad_id']}", "error": r})
    except Exception as ex:
        log.error(f"Meta activate exception: {ex}")
        raise HTTPException(500, {"message": "meta_activate_failed", "error": str(ex)})

    all_ok = (
        results["campaign"].get("ok")
        and results["adset"].get("ok")
        and all(x["result"].get("ok") for x in results["ads"])
    )
    new_status = "ACTIVE" if all_ok else "PARTIAL"
    now = datetime.now(timezone.utc).isoformat()
    await db.meta_launches.update_one(
        {"product_id": product_id, "user_id": user["id"]},
        {"$set": {"status": new_status, "activated_at": now, "last_activation_result": results}},
    )
    await db.products.update_one(
        {"id": product_id, "user_id": user["id"]},
        {"$set": {"meta_status": new_status}},
    )
    return {"ok": all_ok, "status": new_status, "results": results}


# ---------- TikTok Content Engine ----------
@api.post("/tiktok/generate/{product_id}")
async def tiktok_generate(product_id: str, user=Depends(current_user)):
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    await _check_and_increment_usage(user)
    try:
        posts = await generate_tiktok_posts(product, count=5)
    except Exception as ex:
        log.error(f"TikTok gen failed for {product_id}: {ex}")
        posts = fallback_tiktok_posts(product, count=5)

    now = datetime.now(timezone.utc).isoformat()
    for p in posts:
        p["created_at"] = now
    await db.tiktok_posts.delete_many({"product_id": product_id, "user_id": user["id"]})
    docs = [{
        **p,
        "user_id": user["id"],
        "product_id": product_id,
    } for p in posts]
    if docs:
        await db.tiktok_posts.insert_many(docs)
    return {"posts": posts, "count": len(posts)}


@api.get("/tiktok/export/{product_id}")
async def tiktok_export(product_id: str, request: Request, user=Depends(current_user)):
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    rows = await db.tiktok_posts.find(
        {"product_id": product_id, "user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", -1).to_list(100)

    listings_rows = await db.listings.find(
        {"product_id": product_id, "user_id": user["id"]}, {"_id": 0}
    ).to_list(50)
    real_listing = next((l for l in listings_rows if l.get("real") and l.get("status") == "LIVE"), None)
    product_url = (real_listing or {}).get("listing_url", "")

    backend_base = _tracking_base(request)
    for idx, r in enumerate(rows):
        content_id = f"tiktok_post_{idx+1}"
        r["content_id"] = content_id
        if backend_base:
            r["tracking_url"] = _track_url(backend_base, product_id, "tiktok", content_id)
        else:
            r["tracking_url"] = _append_utm(product_url, "tiktok", product_id, content_id)

    return {
        "product_title": product["title"],
        "product_url": product_url,
        "posts": rows,
        "count": len(rows),
        "video_generation": {
            "configured": True,
            "status": "manual_mp4_ready",
            "message": "Download rendered vertical MP4 ads now, then upload manually while TikTok OAuth approval is pending.",
            "upload_url": "https://www.tiktok.com/upload",
        },
    }


# ---------- Tracking & Winner Detection ----------
def _append_utm(url: str, source: str, product_id: str, content_id: str) -> str:
    if not url:
        return url
    from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
    parsed = urlparse(url)
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    params["utm_source"] = source
    params["utm_campaign"] = product_id
    params["utm_content"] = content_id
    return urlunparse(parsed._replace(query=urlencode(params)))


def _tracking_base(request: Request) -> str:
    configured = os.environ.get("TRACKING_BASE_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    return str(request.base_url).rstrip("/")


def _track_url(backend_base: str, product_id: str, source: str, content_id: str) -> str:
    from urllib.parse import urlencode
    q = urlencode({"product_id": product_id, "source": source, "content_id": content_id})
    return f"{backend_base.rstrip('/')}/api/track/go?{q}"


def _is_stable_or_improving(row: Dict[str, Any]) -> bool:
    return str(row.get("trend", "stable")).lower() in ("stable", "improving")


def _winner_loop_decision(row: Dict[str, Any]) -> Dict[str, Any]:
    impressions = int(row.get("impressions", 0))
    clicks = int(row.get("clicks", 0))
    conversions = int(row.get("conversions", 0))
    ctr = float(row.get("ctr", 0.0))
    conversion_rate = float(row.get("conversion_rate", 0.0))
    stable = _is_stable_or_improving(row)

    if ctr > WINNER_MIN_CTR and conversion_rate > WINNER_MIN_CONVERSION and conversions >= 1 and stable:
        return {
            "status": "WINNER",
            "reason": "CTR > 3%, conversion rate > 2%, at least one purchase exists, and performance is stable or improving.",
            "actions": [
                "duplicate creatives with 3-5 variations",
                "increase distribution",
                "prioritize in storefront",
                "trigger TikTok auto-generation expansion",
            ],
        }
    if (impressions > 0 and ctr < DEAD_MAX_CTR) or (conversions == 0 and impressions >= DEAD_NO_CONVERSION_IMPRESSIONS) or not stable:
        return {
            "status": "DEAD",
            "reason": "CTR < 1%, no conversions after 200+ impressions, or engagement is declining.",
            "actions": [
                "stop spending",
                "remove from active promotion",
                "archive or regenerate new variant",
            ],
        }
    if impressions < TEST_MIN_IMPRESSIONS or clicks > 0 or (TEST_MIN_CTR <= ctr <= TEST_MAX_CTR):
        return {
            "status": "TEST",
            "reason": "Insufficient data, clicks without conversion, or CTR is still in the learning range.",
            "actions": [
                "test a new hook",
                "test a new thumbnail angle",
            ],
        }
    return {
        "status": "TEST",
        "reason": "No decisive conversion signal yet.",
        "actions": ["test a new audience variation"],
    }


async def _compute_performance(product_id: str, user_id: str) -> Dict[str, Any]:
    pipeline = [
        {"$match": {"product_id": product_id, "user_id": user_id}},
        {"$group": {
            "_id": {"source": "$source", "content_id": "$content_id"},
            "impressions": {"$sum": {"$cond": [{"$eq": ["$event_type", "impression"]}, 1, 0]}},
            "clicks": {"$sum": {"$cond": [{"$eq": ["$event_type", "click"]}, 1, 0]}},
            "sales": {"$sum": {"$cond": [{"$eq": ["$event_type", "sale"]}, 1, 0]}},
            "revenue": {"$sum": {"$cond": [{"$eq": ["$event_type", "sale"]}, {"$ifNull": ["$value", 0]}, 0]}},
        }},
    ]
    rows = await db.tracking_events.aggregate(pipeline).to_list(1000)
    performance: List[Dict[str, Any]] = []
    winners: List[str] = []
    test_products: List[Dict[str, Any]] = []
    dead_products: List[Dict[str, Any]] = []
    scaling_actions: List[Dict[str, Any]] = []
    killing_actions: List[Dict[str, Any]] = []
    for r in rows:
        impressions = int(r.get("impressions", 0))
        clicks = int(r.get("clicks", 0))
        sales = int(r.get("sales", 0))
        revenue = float(r.get("revenue", 0.0))
        ctr = (clicks / impressions) if impressions else 0.0
        conv = (sales / clicks) if clicks else 0.0
        src = r["_id"]["source"]
        cid = r["_id"]["content_id"]
        perf_row = {
            "source": src,
            "content_id": cid,
            "impressions": impressions,
            "clicks": clicks,
            "sales": sales,
            "conversions": sales,
            "revenue": round(revenue, 2),
            "ctr": round(ctr, 4),
            "conversion_rate": round(conv, 4),
            "traffic_source": src,
            "trend": "stable",
        }
        decision = _winner_loop_decision(perf_row)
        perf_row["status"] = decision["status"]
        perf_row["decision_reason"] = decision["reason"]
        perf_row["recommended_actions"] = decision["actions"]
        perf_row["is_winner"] = decision["status"] == "WINNER"
        performance.append(perf_row)

        product_ref = {
            "product_id": product_id,
            "source": src,
            "content_id": cid,
            "reason": decision["reason"],
            "metrics": {
                "impressions": impressions,
                "clicks": clicks,
                "ctr": round(ctr, 4),
                "conversions": sales,
                "conversion_rate": round(conv, 4),
                "revenue": round(revenue, 2),
                "traffic_source": src,
            },
        }
        if decision["status"] == "WINNER":
            winners.append(f"{src}:{cid}")
            scaling_actions.append({"product_id": product_id, "source": src, "content_id": cid, "actions": decision["actions"]})
        elif decision["status"] == "DEAD":
            dead_products.append(product_ref)
            killing_actions.append({"product_id": product_id, "source": src, "content_id": cid, "actions": decision["actions"]})
        else:
            test_products.append(product_ref)
    performance.sort(key=lambda x: (x["revenue"], x["clicks"]), reverse=True)
    winner_products = [
        {
            "product_id": product_id,
            "source": row["source"],
            "content_id": row["content_id"],
            "reason": row["decision_reason"],
            "metrics": {
                "impressions": row["impressions"],
                "clicks": row["clicks"],
                "ctr": row["ctr"],
                "conversions": row["conversions"],
                "conversion_rate": row["conversion_rate"],
                "revenue": row["revenue"],
                "traffic_source": row["traffic_source"],
            },
        }
        for row in performance if row["status"] == "WINNER"
    ]
    ranked = sorted(performance, key=lambda x: (x["status"] == "WINNER", x["revenue"], x["conversions"], x["ctr"]), reverse=True)
    top = ranked[0] if ranked else None
    winner_loop = {
        "winner_products": winner_products,
        "test_products": test_products,
        "dead_products": dead_products,
        "scaling_actions": scaling_actions,
        "killing_actions": killing_actions,
        "top_opportunity": {
            "product_id": product_id if top else "",
            "reason": top["decision_reason"] if top else "",
            "next_action": (top["recommended_actions"][0] if top and top["recommended_actions"] else ""),
        },
    }
    return {"performance": performance, "winners": winners, "winner_loop": winner_loop}


@api.post("/track/click")
async def track_click(req: ClickEventReq, user=Depends(current_user)):
    product = await db.products.find_one({"id": req.product_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(404, "Product not found")
    await db.tracking_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": req.product_id,
        "source": req.source,
        "content_id": req.content_id,
        "event_type": "click",
        "value": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api.post("/track/impression")
async def track_impression(req: ClickEventReq, user=Depends(current_user)):
    product = await db.products.find_one({"id": req.product_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(404, "Product not found")
    await db.tracking_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": req.product_id,
        "source": req.source,
        "content_id": req.content_id,
        "event_type": "impression",
        "value": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api.post("/track/sale")
async def track_sale(req: SaleEventReq, user=Depends(current_user)):
    product = await db.products.find_one({"id": req.product_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(404, "Product not found")
    await db.tracking_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": req.product_id,
        "source": req.source,
        "content_id": req.content_id,
        "event_type": "sale",
        "value": float(req.value or 0.0),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.products.update_one(
        {"id": req.product_id, "user_id": user["id"]},
        {"$inc": {"revenue": float(req.value or 0.0), "sales_count": 1}},
    )
    perf = await _compute_performance(req.product_id, user["id"])
    await db.products.update_one(
        {"id": req.product_id, "user_id": user["id"]},
        {"$set": {"winners": perf["winners"]}},
    )
    return {"ok": True, "winners": perf["winners"]}


@api.get("/track/go")
async def track_go_redirect(product_id: str, source: str, content_id: str):
    if source not in ("tiktok", "meta"):
        raise HTTPException(400, "Invalid source")
    prod = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not prod:
        raise HTTPException(404, "Product not found")

    await db.tracking_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": prod["user_id"],
        "product_id": product_id,
        "source": source,
        "content_id": content_id,
        "event_type": "click",
        "value": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    listings_rows = await db.listings.find({"product_id": product_id}, {"_id": 0}).to_list(20)
    real = next((l for l in listings_rows if l.get("real") and l.get("status") == "LIVE"), None)
    dest = (real or {}).get("listing_url")
    if not dest:
        raise HTTPException(404, "No destination URL")
    final_url = _append_utm(dest, source, product_id, content_id)
    return RedirectResponse(url=final_url, status_code=302)


@api.get("/analytics/{product_id}")
async def analytics(product_id: str, user=Depends(current_user)):
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    perf = await _compute_performance(product_id, user["id"])

    totals = {
        "impressions": sum(p["impressions"] for p in perf["performance"]),
        "clicks": sum(p["clicks"] for p in perf["performance"]),
        "sales": sum(p["sales"] for p in perf["performance"]),
        "revenue": round(sum(p["revenue"] for p in perf["performance"]), 2),
    }
    totals["ctr"] = round((totals["clicks"] / totals["impressions"]) if totals["impressions"] else 0.0, 4)
    totals["conversion_rate"] = round(
        (totals["sales"] / totals["clicks"]) if totals["clicks"] else 0.0, 4
    )

    return {
        "product_id": product_id,
        "product_title": product["title"],
        "totals": totals,
        "performance": perf["performance"],
        "winners": perf["winners"],
        "winner_loop": perf["winner_loop"],
        "rules": {
            "winner_min_ctr": WINNER_MIN_CTR,
            "min_conversion": WINNER_MIN_CONVERSION,
            "dead_max_ctr": DEAD_MAX_CTR,
            "dead_no_conversion_impressions": DEAD_NO_CONVERSION_IMPRESSIONS,
        },
    }




@api.get("/first-result/{product_id}")
async def first_result_status(product_id: str, request: Request, user=Depends(current_user)):
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")

    listings = await db.listings.find(
        {"product_id": product_id, "user_id": user["id"]},
        {"_id": 0},
    ).to_list(50)
    perf = await _compute_performance(product_id, user["id"])
    totals = {
        "clicks": sum(p["clicks"] for p in perf["performance"]),
        "sales": sum(p["sales"] for p in perf["performance"]),
        "revenue": round(sum(p["revenue"] for p in perf["performance"]), 2),
    }
    events = await db.first_result_events.find(
        {"product_id": product_id, "user_id": user["id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    copied = any(e.get("action") == "copy_post" for e in events)
    posted = any(e.get("action") == "marked_posted" for e in events)
    link_shared = any(e.get("action") == "copy_link" for e in events)

    posts = await db.tiktok_posts.find(
        {"product_id": product_id, "user_id": user["id"]},
        {"_id": 0, "user_id": 0},
    ).sort("created_at", -1).to_list(3)
    real_listing = next((l for l in listings if l.get("real") and l.get("status") == "LIVE"), None)
    product_url = (real_listing or {}).get("listing_url", "")
    launch_times = [l.get("launched_at") for l in listings if l.get("launched_at")]
    launched_at = product.get("launched_at") or (min(launch_times) if launch_times else None)
    backend_base = _tracking_base(request)
    for idx, row in enumerate(posts):
        content_id = f"tiktok_post_{idx + 1}"
        row["content_id"] = content_id
        row["tracking_url"] = _track_url(backend_base, product_id, "tiktok", content_id)

    return {
        "product_id": product_id,
        "product_title": product["title"],
        "launched": bool(real_listing),
        "launched_at": launched_at,
        "product_url": product_url,
        "posts": posts,
        "totals": totals,
        "milestones": {
            "first_engagement": copied or posted,
            "first_post": posted,
            "product_link_shared": link_shared,
            "first_click": totals["clicks"] > 0,
            "first_visitor": totals["clicks"] > 0,
            "first_sale": totals["sales"] > 0,
        },
        "events": events,
        "next_step": (
            "Post one TikTok asset now"
            if not posted else
            "Wait for the first click"
            if totals["clicks"] == 0 else
            "Keep posting the strongest hook"
            if totals["sales"] == 0 else
            "Turn the winner into a campaign"
        ),
    }


@api.post("/first-result/{product_id}/event")
async def first_result_event(product_id: str, req: FirstResultEventReq, user=Depends(current_user)):
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(404, "Product not found")
    await db.first_result_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": product_id,
        "action": req.action,
        "content_id": req.content_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


# ---------- Mount ----------
app.include_router(api)
app.include_router(billing_router)
app.include_router(webhook_router)
app.include_router(admin_router)
app.include_router(announcement_public_router)
app.include_router(referrals_router)
app.include_router(analytics_router)
app.include_router(machine_router)

cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_credentials="*" not in cors_origins,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=int(os.environ.get("RATE_LIMIT_PER_MINUTE", "120")),
)

_tiktok_scheduler_task = None


async def _process_tiktok_due_posts_once():
    now = datetime.now(timezone.utc).isoformat()
    rows = await db.tiktok_post_queue.find(
        {"status": "SCHEDULED", "scheduled_for": {"$lte": now}},
        {"_id": 0},
    ).limit(5).to_list(5)
    for row in rows:
        post_id = row["id"]
        await db.tiktok_post_queue.update_one(
            {"id": post_id, "status": "SCHEDULED"},
            {"$set": {"status": "PROCESSING", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        try:
            path = Path(row.get("local_path", ""))
            if not path.exists():
                raise RuntimeError("scheduled video file is missing")
            video_bytes = path.read_bytes()
            result = await _upload_video_to_tiktok(
                row["user_id"],
                video_bytes,
                row.get("filename") or path.name,
                row.get("caption") or "",
                row.get("mode") or "direct",
                row.get("privacy_level") or "SELF_ONLY",
            )
            await db.tiktok_post_queue.update_one(
                {"id": post_id},
                {"$set": {
                    "status": "UPLOADED",
                    "tiktok_result": result,
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
        except Exception as ex:
            await db.tiktok_post_queue.update_one(
                {"id": post_id},
                {"$set": {
                    "status": "FAILED",
                    "error": str(ex)[:1000],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )


async def _tiktok_scheduler_loop():
    while True:
        try:
            await _process_tiktok_due_posts_once()
        except Exception as ex:
            log.warning("TikTok scheduler tick failed: %s", ex)
        await asyncio.sleep(int(os.environ.get("TIKTOK_SCHEDULER_INTERVAL_SECONDS", "60")))


@app.on_event("startup")
async def startup():
    global _tiktok_scheduler_task
    sentry_dsn = os.environ.get("SENTRY_DSN")
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration

            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[FastApiIntegration()],
                traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
                environment=os.environ.get("APP_ENV", "production"),
            )
        except Exception as ex:
            log.warning(f"sentry init failed: {ex}")
    try:
        await ensure_indexes(db)
    except Exception as ex:
        log.warning(f"index bootstrap failed: {ex}")
    try:
        await stripe_service.ensure_prices()
    except Exception as ex:
        log.warning(f"stripe ensure_prices failed: {ex}")
    # Ensure OWNER gets admin role if account already exists
    owner = os.environ.get("OWNER_EMAIL", "").lower()
    if owner:
        try:
            await db.users.update_one(
                {"email": owner},
                {"$set": {"role": "admin"}},
            )
        except Exception:
            pass
    if os.environ.get("ENABLE_TIKTOK_SCHEDULER", "true").lower() == "true":
        _tiktok_scheduler_task = asyncio.create_task(_tiktok_scheduler_loop())


@app.on_event("shutdown")
async def shutdown():
    if _tiktok_scheduler_task:
        _tiktok_scheduler_task.cancel()
    close_client()

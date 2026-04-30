"""Admin / super-admin router. Protected by current_admin dependency."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core_auth import current_admin, current_user
from db import db
from services import email as email_service
from services.llm_config import llm_configured
from services import payouts as payout_service
from services.audit import log_event

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UserPatch(BaseModel):
    plan: Optional[str] = None
    banned: Optional[bool] = None
    role: Optional[str] = None
    generations_used: Optional[int] = None
    notes: Optional[str] = None


class FeatureFlagReq(BaseModel):
    key: str
    value: bool
    description: Optional[str] = ""


class BroadcastReq(BaseModel):
    subject: str
    heading: str
    body_html: str
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    plan_filter: Optional[str] = None  # only to users on this plan
    test_to: Optional[str] = None       # send test to a single email first


class AnnouncementReq(BaseModel):
    title: str
    body: str
    active: bool = True


class PayoutRejectReq(BaseModel):
    reason: Optional[str] = ""


@router.get("/overview")
async def admin_overview(admin=Depends(current_admin)):
    users_total = await db.users.count_documents({})
    users_last_7d = await db.users.count_documents({
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
    })
    paid_users = await db.users.count_documents({"plan": {"$in": ["starter", "pro", "enterprise"]}})
    products_total = await db.products.count_documents({})
    campaigns_total = await db.campaigns.count_documents({})
    listings_total = await db.listings.count_documents({})

    # Revenue from payment_transactions
    tx_paid = await db.payment_transactions.find({"payment_status": "paid"}, {"_id": 0}).to_list(5000)
    gross_revenue = round(sum(float(t.get("amount", 0)) for t in tx_paid), 2)

    # MRR = sum of active plan prices
    plan_prices = {"starter": 29.0, "pro": 79.0, "enterprise": 299.0}
    pipeline = [
        {"$match": {"plan": {"$in": ["starter", "pro", "enterprise"]}, "subscription_status": {"$ne": "canceled"}}},
        {"$group": {"_id": "$plan", "count": {"$sum": 1}}},
    ]
    rows = await db.users.aggregate(pipeline).to_list(10)
    mrr = round(sum(plan_prices.get(r["_id"], 0) * r["count"] for r in rows), 2)
    arr = round(mrr * 12, 2)

    # Churn proxy: cancelled in last 30d / active 30d ago
    thirty = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    cancelled_30d = await db.users.count_documents(
        {"subscription_status": "canceled", "subscription_cancelled_at": {"$gte": thirty}}
    )

    referral_count = await db.referral_attributions.count_documents({})
    referral_revenue = 0.0
    rows2 = await db.referral_commissions.aggregate(
        [{"$group": {"_id": None, "total": {"$sum": "$commission_earned"}}}]
    ).to_list(1)
    if rows2:
        referral_revenue = round(rows2[0].get("total", 0.0), 2)

    return {
        "users": {"total": users_total, "last_7d": users_last_7d, "paid": paid_users, "cancelled_30d": cancelled_30d},
        "products": products_total,
        "campaigns": campaigns_total,
        "listings": listings_total,
        "revenue": {"gross_lifetime": gross_revenue, "mrr": mrr, "arr": arr},
        "referrals": {"total_attributions": referral_count, "total_commissions": referral_revenue},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/users")
async def admin_users(
    q: Optional[str] = None,
    plan: Optional[str] = None,
    banned: Optional[bool] = None,
    limit: int = 50,
    skip: int = 0,
    admin=Depends(current_admin),
):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"id": q},
        ]
    if plan:
        query["plan"] = plan
    if banned is not None:
        query["banned"] = banned
    total = await db.users.count_documents(query)
    rows = await db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).skip(skip).limit(min(limit, 200)).to_list(limit)
    return {"total": total, "users": rows}


@router.get("/users/{uid}")
async def admin_user_detail(uid: str, admin=Depends(current_admin)):
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(404, "User not found")
    products = await db.products.count_documents({"user_id": uid})
    campaigns = await db.campaigns.count_documents({"user_id": uid})
    txs = await db.payment_transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(50)
    referrals = await db.referral_attributions.count_documents({"referrer_user_id": uid})
    return {
        "user": user,
        "stats": {"products": products, "campaigns": campaigns, "referrals": referrals},
        "transactions": txs,
    }


@router.patch("/users/{uid}")
async def admin_patch_user(uid: str, patch: UserPatch, admin=Depends(current_admin)):
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not update:
        return {"ok": True, "user": target}
    await db.users.update_one({"id": uid}, {"$set": update})
    await log_event(admin["id"], "admin.user.patch", target_type="user", target_id=uid, metadata=update)
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    return {"ok": True, "user": user}


@router.post("/users/{uid}/ban")
async def admin_ban_user(uid: str, admin=Depends(current_admin)):
    await db.users.update_one({"id": uid}, {"$set": {"banned": True, "banned_at": datetime.now(timezone.utc).isoformat()}})
    await log_event(admin["id"], "admin.user.ban", target_type="user", target_id=uid)
    return {"ok": True}


@router.post("/users/{uid}/unban")
async def admin_unban_user(uid: str, admin=Depends(current_admin)):
    await db.users.update_one({"id": uid}, {"$set": {"banned": False}, "$unset": {"banned_at": ""}})
    await log_event(admin["id"], "admin.user.unban", target_type="user", target_id=uid)
    return {"ok": True}


@router.get("/transactions")
async def admin_transactions(limit: int = 100, admin=Depends(current_admin)):
    rows = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)).to_list(limit)
    return {"transactions": rows}


@router.get("/payouts")
async def admin_payouts(status: Optional[str] = None, admin=Depends(current_admin)):
    return await payout_service.list_admin_payouts(status=status)


@router.post("/payouts/{payout_id}/approve")
async def admin_approve_payout(payout_id: str, admin=Depends(current_admin)):
    payout = await payout_service.approve_payout(payout_id, admin["id"])
    if not payout:
        raise HTTPException(404, "Payout not found")
    await log_event(admin["id"], "admin.payout.approve", target_type="payout", target_id=payout_id)
    return {"ok": True, "payout": payout}


@router.post("/payouts/{payout_id}/paid")
async def admin_mark_payout_paid(payout_id: str, admin=Depends(current_admin)):
    payout = await payout_service.mark_payout_paid(payout_id, admin["id"])
    if not payout:
        raise HTTPException(404, "Payout not found")
    await log_event(admin["id"], "admin.payout.paid", target_type="payout", target_id=payout_id)
    return {"ok": True, "payout": payout}


@router.post("/payouts/{payout_id}/reject")
async def admin_reject_payout(payout_id: str, req: PayoutRejectReq, admin=Depends(current_admin)):
    payout = await payout_service.reject_payout(payout_id, admin["id"], req.reason or "")
    if not payout:
        raise HTTPException(404, "Payout not found")
    await log_event(admin["id"], "admin.payout.reject", target_type="payout", target_id=payout_id, metadata={"reason": req.reason})
    return {"ok": True, "payout": payout}


@router.get("/audit-logs")
async def admin_audit_logs(limit: int = 100, admin=Depends(current_admin)):
    rows = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)).to_list(limit)
    return {"logs": rows}


# ---------- Feature flags ----------
@router.get("/feature-flags")
async def get_feature_flags(admin=Depends(current_admin)):
    rows = await db.feature_flags.find({}, {"_id": 0}).to_list(500)
    return {"flags": rows}


@router.put("/feature-flags")
async def set_feature_flag(req: FeatureFlagReq, admin=Depends(current_admin)):
    await db.feature_flags.update_one(
        {"key": req.key},
        {"$set": {"key": req.key, "value": bool(req.value), "description": req.description,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    await log_event(admin["id"], "admin.flag.set", target_type="feature_flag", target_id=req.key,
                    metadata={"value": req.value})
    return {"ok": True}


# ---------- Announcements ----------
@router.post("/announcements")
async def create_announcement(req: AnnouncementReq, admin=Depends(current_admin)):
    import uuid
    doc = {
        "id": str(uuid.uuid4()),
        "title": req.title,
        "body": req.body,
        "active": req.active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"],
    }
    await db.announcements.insert_one(doc.copy())
    await log_event(admin["id"], "admin.announcement.create", target_type="announcement", target_id=doc["id"])
    return {"ok": True, "announcement": doc}


@router.get("/announcements")
async def list_announcements(admin=Depends(current_admin)):
    rows = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"announcements": rows}


@router.delete("/announcements/{aid}")
async def delete_announcement(aid: str, admin=Depends(current_admin)):
    await db.announcements.delete_one({"id": aid})
    await log_event(admin["id"], "admin.announcement.delete", target_type="announcement", target_id=aid)
    return {"ok": True}


# ---------- Broadcast email ----------
@router.post("/broadcast")
async def broadcast_email(req: BroadcastReq, admin=Depends(current_admin)):
    """Send a branded email to all users (or a plan subset). `test_to` sends to one email first."""
    data = {
        "subject": req.subject,
        "heading": req.heading,
        "body_html": req.body_html,
        "cta_text": req.cta_text,
        "cta_url": req.cta_url,
    }
    if req.test_to:
        res = await email_service.send_email(req.test_to, "admin_broadcast", data, subject_override=req.subject)
        return {"ok": True, "mode": "test", "result": res}

    query: Dict[str, Any] = {"banned": {"$ne": True}}
    if req.plan_filter:
        query["plan"] = req.plan_filter
    users = await db.users.find(query, {"_id": 0, "email": 1, "name": 1}).to_list(5000)
    sent = 0
    failed = 0
    for u in users:
        try:
            r = await email_service.send_email(u["email"], "admin_broadcast", data, subject_override=req.subject)
            if r.get("ok"):
                sent += 1
            else:
                failed += 1
        except Exception:
            failed += 1
    await log_event(admin["id"], "admin.broadcast.send", metadata={"sent": sent, "failed": failed, "subject": req.subject})
    return {"ok": True, "sent": sent, "failed": failed, "total_recipients": len(users)}


@router.get("/system-health")
async def admin_system_health(admin=Depends(current_admin)):
    import os
    health = {
        "stripe": bool(os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")),
        "sendgrid": bool(os.environ.get("SENDGRID_API_KEY")),
        "emergent_llm": llm_configured(),
        "owner_email": os.environ.get("OWNER_EMAIL"),
        "mongo_ping": False,
        "mongo_db": os.environ.get("DB_NAME"),
    }
    try:
        await db.command("ping")
        health["mongo_ping"] = True
    except Exception:
        pass
    return health


# ---------- Public announcement feed (for authed users) ----------
public_router = APIRouter(prefix="/api", tags=["announcements"])


@public_router.get("/announcements/active")
async def active_announcements(user=Depends(current_user)):
    rows = await db.announcements.find({"active": True}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return {"announcements": rows}

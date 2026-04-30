"""Referral engine — unique codes, attribution, commissions, leaderboard."""
from __future__ import annotations

import os
import string
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from db import db

BRAND_URL = os.environ.get("BACKEND_URL", "").rstrip("/") or ""
# Commission %: starter=20%, pro=25%, enterprise=30% (example)
COMMISSION_PCT = {"starter": 0.20, "pro": 0.25, "enterprise": 0.30}


def _gen_code(name: str) -> str:
    """Readable 6-8 char alphanumeric code based on name + random."""
    base = "".join(c for c in (name or "").lower() if c in string.ascii_lowercase)[:4]
    if not base:
        base = "hustler"
    tail = uuid.uuid4().hex[:4]
    return f"{base}-{tail}"


async def ensure_user_referral(user: Dict[str, Any]) -> str:
    """Ensure the user has a referral code; return it."""
    existing = await db.referral_codes.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        return existing["code"]
    code = _gen_code(user.get("name", ""))
    while await db.referral_codes.find_one({"code": code}):
        code = _gen_code(user.get("name", ""))
    await db.referral_codes.insert_one({
        "user_id": user["id"],
        "code": code,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return code


async def resolve_code(code: str) -> Optional[Dict[str, Any]]:
    """Return {user_id, code} if valid."""
    if not code:
        return None
    return await db.referral_codes.find_one({"code": code.strip().lower()}, {"_id": 0})


async def record_signup_attribution(new_user_id: str, code: Optional[str]) -> Optional[str]:
    """Record that new_user_id was referred by owner_of(code). Return referrer user_id."""
    if not code:
        return None
    ref = await db.referral_codes.find_one({"code": code.strip().lower()}, {"_id": 0})
    if not ref or ref["user_id"] == new_user_id:
        return None
    await db.referral_attributions.insert_one({
        "id": str(uuid.uuid4()),
        "referrer_user_id": ref["user_id"],
        "referred_user_id": new_user_id,
        "code": ref["code"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "commission_earned": 0.0,
    })
    await db.users.update_one(
        {"id": new_user_id}, {"$set": {"referred_by": ref["user_id"], "referral_code_used": ref["code"]}}
    )
    return ref["user_id"]


async def record_commission(referred_user_id: str, plan: str, amount_paid: float) -> Optional[Dict[str, Any]]:
    """Credit the referrer when a referred user pays. Returns the commission doc or None."""
    attribution = await db.referral_attributions.find_one(
        {"referred_user_id": referred_user_id, "status": {"$in": ["pending", "converted"]}}, {"_id": 0}
    )
    if not attribution:
        return None
    pct = COMMISSION_PCT.get(plan, 0.20)
    commission = round(amount_paid * pct, 2)
    doc = {
        "id": str(uuid.uuid4()),
        "referrer_user_id": attribution["referrer_user_id"],
        "referred_user_id": referred_user_id,
        "plan": plan,
        "amount_paid": amount_paid,
        "commission_pct": pct,
        "commission_earned": commission,
        "status": "pending_payout",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.referral_commissions.insert_one(doc.copy())
    await db.referral_attributions.update_one(
        {"id": attribution["id"]},
        {"$set": {"status": "converted", "commission_earned": commission, "converted_at": doc["created_at"]}},
    )
    return doc


async def get_referral_summary(user_id: str) -> Dict[str, Any]:
    code_doc = await db.referral_codes.find_one({"user_id": user_id}, {"_id": 0})
    attributions = await db.referral_attributions.find(
        {"referrer_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    commissions = await db.referral_commissions.find(
        {"referrer_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    total_earned = round(sum(c.get("commission_earned", 0) for c in commissions), 2)
    total_paid = round(
        sum(c.get("commission_earned", 0) for c in commissions if c.get("status") == "paid"), 2
    )
    return {
        "code": code_doc.get("code") if code_doc else None,
        "share_url": f"{BRAND_URL}/signup?ref={code_doc['code']}" if code_doc else "",
        "signups": len(attributions),
        "converted": sum(1 for a in attributions if a.get("status") == "converted"),
        "total_earned": total_earned,
        "total_paid": total_paid,
        "pending_balance": round(total_earned - total_paid, 2),
        "attributions": attributions[:50],
        "commissions": commissions[:50],
    }


async def leaderboard(limit: int = 20) -> List[Dict[str, Any]]:
    pipeline = [
        {"$group": {
            "_id": "$referrer_user_id",
            "total_commission": {"$sum": "$commission_earned"},
            "sales": {"$sum": 1},
        }},
        {"$sort": {"total_commission": -1}},
        {"$limit": limit},
    ]
    rows = await db.referral_commissions.aggregate(pipeline).to_list(limit)
    out = []
    for r in rows:
        user = await db.users.find_one({"id": r["_id"]}, {"_id": 0, "password": 0})
        out.append({
            "user_id": r["_id"],
            "name": (user or {}).get("name", "Anonymous"),
            "total_commission": round(r["total_commission"], 2),
            "sales": r["sales"],
        })
    return out

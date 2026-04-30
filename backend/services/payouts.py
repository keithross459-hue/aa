"""Referral payout ledger, thresholds, fraud checks, and approvals."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from db import db
from services import email as email_service

PAYOUT_THRESHOLD_USD = float(os.environ.get("REFERRAL_PAYOUT_THRESHOLD_USD", "50"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def referral_fraud_signals(referrer_user_id: str) -> Dict[str, Any]:
    attributions = await db.referral_attributions.find(
        {"referrer_user_id": referrer_user_id}, {"_id": 0}
    ).to_list(1000)
    referred_ids = [a.get("referred_user_id") for a in attributions if a.get("referred_user_id")]
    referred_users = await db.users.find(
        {"id": {"$in": referred_ids}}, {"_id": 0, "id": 1, "email": 1, "created_at": 1}
    ).to_list(1000)
    emails = [str(u.get("email", "")).lower() for u in referred_users]
    domains = [e.split("@", 1)[1] for e in emails if "@" in e]
    domain_counts = {d: domains.count(d) for d in set(domains)}
    disposable_domains = {"mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com"}
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent = [a for a in attributions if a.get("created_at", "") >= recent_cutoff]

    signals: List[str] = []
    if len(recent) >= 10:
        signals.append("high_velocity_signups_24h")
    if any(count >= 5 for count in domain_counts.values()):
        signals.append("repeated_email_domain")
    if any(d in disposable_domains for d in domains):
        signals.append("disposable_email_domain")

    conversions = sum(1 for a in attributions if a.get("status") == "converted")
    conversion_rate = (conversions / len(attributions)) if attributions else 0.0
    if len(attributions) >= 8 and conversion_rate == 0:
        signals.append("zero_conversion_volume")

    return {
        "risk": "high" if len(signals) >= 2 else ("medium" if signals else "low"),
        "signals": signals,
        "signups": len(attributions),
        "conversions": conversions,
        "conversion_rate": round(conversion_rate, 4),
    }


async def ledger_for_user(user_id: str) -> Dict[str, Any]:
    commissions = await db.referral_commissions.find(
        {"referrer_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    payouts = await db.referral_payouts.find(
        {"referrer_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    earned = round(sum(float(c.get("commission_earned", 0)) for c in commissions), 2)
    paid = round(sum(float(p.get("amount", 0)) for p in payouts if p.get("status") == "paid"), 2)
    pending_payout = round(sum(float(p.get("amount", 0)) for p in payouts if p.get("status") in ("requested", "approved")), 2)
    available = round(sum(float(c.get("commission_earned", 0)) for c in commissions if c.get("status") == "pending_payout"), 2)
    fraud = await referral_fraud_signals(user_id)

    return {
        "threshold_usd": PAYOUT_THRESHOLD_USD,
        "earned": earned,
        "paid": paid,
        "pending_payout": pending_payout,
        "available": available,
        "can_request": available >= PAYOUT_THRESHOLD_USD and fraud["risk"] != "high",
        "fraud": fraud,
        "commissions": commissions[:100],
        "payouts": payouts[:100],
    }


async def request_payout(user: Dict[str, Any]) -> Dict[str, Any]:
    ledger = await ledger_for_user(user["id"])
    if ledger["available"] < PAYOUT_THRESHOLD_USD:
        return {"ok": False, "error": "threshold_not_met", "ledger": ledger}
    if ledger["fraud"]["risk"] == "high":
        return {"ok": False, "error": "fraud_review_required", "ledger": ledger}

    commission_ids = [
        c["id"] for c in ledger["commissions"]
        if c.get("status") == "pending_payout"
    ]
    doc = {
        "id": str(uuid.uuid4()),
        "referrer_user_id": user["id"],
        "email": user.get("email"),
        "amount": ledger["available"],
        "commission_ids": commission_ids,
        "status": "requested",
        "fraud": ledger["fraud"],
        "created_at": _now(),
    }
    await db.referral_payouts.insert_one(doc.copy())
    await db.referral_commissions.update_many(
        {"id": {"$in": commission_ids}},
        {"$set": {"status": "payout_requested", "payout_id": doc["id"]}},
    )
    try:
        await email_service.send_email(user["email"], "payout_requested", {"amount": doc["amount"]})
    except Exception:
        pass
    return {"ok": True, "payout": doc}


async def list_admin_payouts(status: Optional[str] = None) -> Dict[str, Any]:
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    rows = await db.referral_payouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"payouts": rows, "threshold_usd": PAYOUT_THRESHOLD_USD}


async def approve_payout(payout_id: str, admin_id: str) -> Optional[Dict[str, Any]]:
    payout = await db.referral_payouts.find_one({"id": payout_id}, {"_id": 0})
    if not payout:
        return None
    now = _now()
    await db.referral_payouts.update_one(
        {"id": payout_id},
        {"$set": {"status": "approved", "approved_by": admin_id, "approved_at": now}},
    )
    await db.referral_commissions.update_many(
        {"id": {"$in": payout.get("commission_ids", [])}},
        {"$set": {"status": "payout_approved"}},
    )
    user = await db.users.find_one({"id": payout["referrer_user_id"]}, {"_id": 0})
    if user:
        try:
            await email_service.send_email(user["email"], "payout_approved", {"amount": payout["amount"]})
        except Exception:
            pass
    return await db.referral_payouts.find_one({"id": payout_id}, {"_id": 0})


async def mark_payout_paid(payout_id: str, admin_id: str) -> Optional[Dict[str, Any]]:
    payout = await db.referral_payouts.find_one({"id": payout_id}, {"_id": 0})
    if not payout:
        return None
    now = _now()
    await db.referral_payouts.update_one(
        {"id": payout_id},
        {"$set": {"status": "paid", "paid_by": admin_id, "paid_at": now}},
    )
    await db.referral_commissions.update_many(
        {"id": {"$in": payout.get("commission_ids", [])}},
        {"$set": {"status": "paid", "paid_at": now}},
    )
    user = await db.users.find_one({"id": payout["referrer_user_id"]}, {"_id": 0})
    if user:
        try:
            await email_service.send_email(user["email"], "payout_paid", {"amount": payout["amount"]})
        except Exception:
            pass
    return await db.referral_payouts.find_one({"id": payout_id}, {"_id": 0})


async def reject_payout(payout_id: str, admin_id: str, reason: str = "") -> Optional[Dict[str, Any]]:
    payout = await db.referral_payouts.find_one({"id": payout_id}, {"_id": 0})
    if not payout:
        return None
    await db.referral_payouts.update_one(
        {"id": payout_id},
        {"$set": {"status": "rejected", "rejected_by": admin_id, "rejected_at": _now(), "reason": reason}},
    )
    await db.referral_commissions.update_many(
        {"id": {"$in": payout.get("commission_ids", [])}},
        {"$set": {"status": "pending_payout"}, "$unset": {"payout_id": ""}},
    )
    return await db.referral_payouts.find_one({"id": payout_id}, {"_id": 0})

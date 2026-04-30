"""Production Stripe billing — subscriptions, webhooks, portal, invoices."""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core_auth import current_user
from db import db
from services import email as email_service
from services import referrals as referral_service
from services import stripe_service

log = logging.getLogger("filthy.billing")

router = APIRouter(prefix="/api/billing", tags=["billing"])
webhook_router = APIRouter(prefix="/api/webhook", tags=["webhook"])

PLAN_LIMITS = {"free": 5, "starter": 50, "pro": 500, "enterprise": 999999}


class CheckoutReq(BaseModel):
    plan: Literal["starter", "pro", "enterprise"]
    origin_url: str
    coupon_code: Optional[str] = None
    referral_code: Optional[str] = None


class CancelReq(BaseModel):
    at_period_end: bool = True


class UpgradeReq(BaseModel):
    plan: Literal["starter", "pro", "enterprise"]


@router.get("/plans")
async def list_plans():
    await stripe_service.ensure_prices()
    return {
        "plans": [
            {"id": p, "name": p.title(), "amount_usd": c["amount_usd"],
             "monthly_limit": c["limit"], "price_id": stripe_service.PRICE_IDS.get(p)}
            for p, c in stripe_service.PLAN_CONFIG.items()
        ],
        "stripe_configured": stripe_service.configured(),
    }


@router.post("/create-checkout")
async def create_checkout(req: CheckoutReq, user=Depends(current_user)):
    origin = req.origin_url.rstrip("/")
    backend_base = os.environ.get("BACKEND_URL", origin).rstrip("/")
    success_url = f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"

    res = await stripe_service.create_checkout_session(
        plan=req.plan,
        user_id=user["id"],
        user_email=user["email"],
        success_url=success_url,
        cancel_url=cancel_url,
        coupon_code=req.coupon_code,
        referral_code=req.referral_code or user.get("referral_code_used"),
    )
    if not res.get("ok"):
        raise HTTPException(500, res.get("error", "stripe_error"))

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": res["session_id"],
        "user_id": user["id"],
        "email": user["email"],
        "plan": req.plan,
        "amount": stripe_service.PLAN_CONFIG[req.plan]["amount_usd"],
        "currency": "usd",
        "mode": "subscription",
        "price_id": res.get("price_id"),
        "coupon_code": req.coupon_code,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": res["url"], "session_id": res["session_id"]}


@router.get("/status/{session_id}")
async def checkout_status(session_id: str, user=Depends(current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    res = await stripe_service.get_session(session_id)
    if not res.get("ok"):
        return {
            "status": tx.get("status", "pending"),
            "payment_status": tx.get("payment_status", "pending"),
            "amount_total": int(float(tx.get("amount", 0)) * 100),
            "currency": tx.get("currency", "usd"),
            "plan": tx.get("plan"),
            "note": "provider_lookup_failed",
        }
    s_raw = res["session"]
    if isinstance(s_raw, dict):
        s = s_raw
    elif hasattr(s_raw, "to_dict_recursive"):
        s = s_raw.to_dict_recursive()
    elif hasattr(s_raw, "to_dict"):
        s = s_raw.to_dict()
    else:
        s = dict(s_raw)
    st_status = s.get("status")
    st_payment_status = s.get("payment_status")

    sub = s.get("subscription")
    sub_id = sub if isinstance(sub, str) else (sub.get("id") if isinstance(sub, dict) else None)
    customer = s.get("customer")
    customer_id = customer if isinstance(customer, str) else (customer.get("id") if isinstance(customer, dict) else None)

    # Subscription checkouts finalize as "complete" + payment_status "paid"
    if st_payment_status == "paid" and tx.get("payment_status") != "paid":
        plan = tx.get("plan", "starter")
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "plan": plan,
                "generations_used": 0,
                "subscription_id": sub_id,
                "stripe_customer_id": customer_id,
                "subscription_status": "active",
                "plan_updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": "paid",
                "status": st_status,
                "subscription_id": sub_id,
                "stripe_customer_id": customer_id,
                "paid_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        # Referral commission (first-time conversion only)
        try:
            amount_paid = stripe_service.PLAN_CONFIG.get(plan, {}).get("amount_usd", 0)
            await referral_service.record_commission(user["id"], plan, float(amount_paid))
        except Exception as ex:
            log.warning(f"referral commission skipped: {ex}")
        # Fire email
        try:
            await email_service.send_email(
                user["email"], "payment_succeeded",
                {"plan": plan, "amount": stripe_service.PLAN_CONFIG[plan]["amount_usd"],
                 "plan_limit": PLAN_LIMITS.get(plan)},
            )
        except Exception:
            pass

    return {
        "status": st_status,
        "payment_status": st_payment_status,
        "amount_total": int(s.get("amount_total") or 0),
        "currency": s.get("currency", "usd"),
        "plan": tx.get("plan"),
    }


@router.post("/cancel")
async def cancel_subscription(req: CancelReq, user=Depends(current_user)):
    sub_id = user.get("subscription_id")
    if not sub_id:
        raise HTTPException(400, "No active subscription")
    res = await stripe_service.cancel_subscription(sub_id, at_period_end=req.at_period_end)
    if not res.get("ok"):
        raise HTTPException(500, res.get("error"))
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "subscription_status": "cancel_scheduled" if req.at_period_end else "canceled",
            "subscription_cancelled_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    try:
        await email_service.send_email(user["email"], "plan_cancelled", {})
    except Exception:
        pass
    return {"ok": True}


@router.post("/reactivate")
async def reactivate_subscription(user=Depends(current_user)):
    sub_id = user.get("subscription_id")
    if not sub_id:
        raise HTTPException(400, "No subscription")
    res = await stripe_service.reactivate_subscription(sub_id)
    if not res.get("ok"):
        raise HTTPException(500, res.get("error"))
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"subscription_status": "active"}, "$unset": {"subscription_cancelled_at": ""}}
    )
    return {"ok": True}


@router.post("/change-plan")
async def change_plan(req: UpgradeReq, user=Depends(current_user)):
    sub_id = user.get("subscription_id")
    if not sub_id:
        raise HTTPException(400, "No active subscription")
    res = await stripe_service.update_subscription_plan(sub_id, req.plan)
    if not res.get("ok"):
        raise HTTPException(500, res.get("error"))
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"plan": req.plan, "plan_updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    try:
        await email_service.send_email(
            user["email"], "plan_upgraded",
            {"plan": req.plan, "plan_limit": PLAN_LIMITS.get(req.plan)},
        )
    except Exception:
        pass
    return {"ok": True}


@router.get("/portal")
async def billing_portal(user=Depends(current_user)):
    cid = user.get("stripe_customer_id")
    if not cid:
        raise HTTPException(400, "No Stripe customer")
    backend = os.environ.get("BACKEND_URL", "https://fiilthy.ai")
    res = await stripe_service.create_billing_portal_session(cid, f"{backend}/app")
    if not res.get("ok"):
        raise HTTPException(500, res.get("error"))
    return {"url": res["url"]}


@router.get("/invoices")
async def my_invoices(user=Depends(current_user)):
    cid = user.get("stripe_customer_id")
    if not cid:
        return {"invoices": []}
    res = await stripe_service.list_invoices_for_customer(cid)
    if not res.get("ok"):
        return {"invoices": []}
    rows = []
    for inv in res.get("invoices", []):
        rows.append({
            "id": inv.get("id"),
            "number": inv.get("number"),
            "status": inv.get("status"),
            "amount_paid": inv.get("amount_paid") / 100.0 if inv.get("amount_paid") else 0.0,
            "currency": inv.get("currency"),
            "created": inv.get("created"),
            "hosted_invoice_url": inv.get("hosted_invoice_url"),
            "invoice_pdf": inv.get("invoice_pdf"),
        })
    return {"invoices": rows}


# ---------- Webhook ----------
@webhook_router.post("/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    event = stripe_service.verify_webhook(payload, sig)
    if event is None:
        raise HTTPException(400, "Invalid signature")

    # Normalize event + object to plain dict
    if isinstance(event, dict):
        evt_dict = event
    elif hasattr(event, "to_dict_recursive"):
        evt_dict = event.to_dict_recursive()
    elif hasattr(event, "to_dict"):
        evt_dict = event.to_dict()
    else:
        evt_dict = dict(event)

    etype = evt_dict.get("type")
    event_id = evt_dict.get("id")
    obj = (evt_dict.get("data") or {}).get("object") or {}

    # Persist raw event (idempotent by event id)
    existing = await db.stripe_events.find_one({"id": event_id}, {"_id": 0})
    if existing:
        return {"received": True, "duplicate": True}
    await db.stripe_events.insert_one({
        "id": event_id,
        "type": etype,
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    meta = obj.get("metadata") or {}
    user_id = meta.get("filthy_user_id")
    plan = meta.get("filthy_plan")

    try:
        if etype == "checkout.session.completed":
            session_id = obj.get("id")
            sub_id = obj.get("subscription")
            customer_id = obj.get("customer")
            if user_id and plan:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {
                        "plan": plan,
                        "generations_used": 0,
                        "subscription_id": sub_id,
                        "stripe_customer_id": customer_id,
                        "subscription_status": "active",
                        "plan_updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "status": "complete",
                        "subscription_id": sub_id,
                        "stripe_customer_id": customer_id,
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                # Referral commission
                try:
                    amt = stripe_service.PLAN_CONFIG.get(plan, {}).get("amount_usd", 0)
                    await referral_service.record_commission(user_id, plan, float(amt))
                except Exception as ex:
                    log.warning(f"referral commission skipped: {ex}")
                # Email
                user = await db.users.find_one({"id": user_id}, {"_id": 0})
                if user:
                    try:
                        await email_service.send_email(
                            user["email"], "payment_succeeded",
                            {"plan": plan, "amount": stripe_service.PLAN_CONFIG[plan]["amount_usd"],
                             "plan_limit": PLAN_LIMITS.get(plan)},
                        )
                    except Exception:
                        pass

        elif etype == "invoice.paid":
            sub_id = obj.get("subscription")
            if sub_id:
                await db.users.update_one(
                    {"subscription_id": sub_id},
                    {"$set": {"subscription_status": "active", "last_paid_at": datetime.now(timezone.utc).isoformat()}},
                )

        elif etype == "invoice.payment_failed":
            sub_id = obj.get("subscription")
            if sub_id:
                user = await db.users.find_one({"subscription_id": sub_id}, {"_id": 0})
                if user:
                    await db.users.update_one({"id": user["id"]}, {"$set": {"subscription_status": "past_due"}})
                    try:
                        await email_service.send_email(user["email"], "payment_failed", {"plan": user.get("plan", "")})
                    except Exception:
                        pass

        elif etype == "customer.subscription.deleted":
            sub_id = obj.get("id")
            user = await db.users.find_one({"subscription_id": sub_id}, {"_id": 0})
            if user:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {
                        "plan": "free",
                        "subscription_status": "canceled",
                        "subscription_cancelled_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                try:
                    await email_service.send_email(user["email"], "plan_cancelled", {})
                except Exception:
                    pass

        elif etype == "customer.subscription.updated":
            sub_id = obj.get("id")
            status_val = obj.get("status")
            cancel_at_period_end = obj.get("cancel_at_period_end")
            new_plan = (obj.get("metadata") or {}).get("filthy_plan")
            update_doc = {"subscription_status": "cancel_scheduled" if cancel_at_period_end else status_val}
            if new_plan and new_plan in PLAN_LIMITS:
                update_doc["plan"] = new_plan
            await db.users.update_one({"subscription_id": sub_id}, {"$set": update_doc})

    except Exception as ex:
        log.error(f"webhook handler for {etype} failed: {ex}", exc_info=True)

    return {"received": True}

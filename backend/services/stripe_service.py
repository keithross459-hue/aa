"""Stripe subscription engine — create products/prices on startup, checkout, webhooks.

All Stripe calls run in asyncio.to_thread since the SDK is synchronous.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, Optional

import stripe

log = logging.getLogger("filthy.stripe")

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY") or ""
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

def _price(name: str, default: str) -> float:
    return round(float(os.environ.get(name, default)), 2)


PLAN_CONFIG = {
    "starter": {"amount_usd": _price("STRIPE_PRICE_STARTER_USD", "29"), "limit": 50},
    "pro": {"amount_usd": _price("STRIPE_PRICE_PRO_USD", "49.99"), "limit": 500},
    "enterprise": {"amount_usd": _price("STRIPE_PRICE_ENTERPRISE_USD", "299.99"), "limit": 999999},
}

# Runtime cache of Stripe Price IDs, populated by ensure_prices()
PRICE_IDS: Dict[str, str] = {}


def configured() -> bool:
    return bool(STRIPE_SECRET_KEY)


async def _to_thread(fn, *args, **kwargs):
    return await asyncio.to_thread(lambda: fn(*args, **kwargs))


async def ensure_prices() -> Dict[str, str]:
    """Idempotently create Stripe Products + monthly recurring Prices. Returns {plan: price_id}."""
    if not configured():
        log.warning("Stripe not configured — skipping price bootstrap.")
        return {}
    for plan, cfg in PLAN_CONFIG.items():
        try:
            # Find product by metadata.filthy_plan
            prods = await _to_thread(
                stripe.Product.search,
                query=f"metadata['filthy_plan']:'{plan}'",
                limit=1,
            )
            if prods.data:
                product = prods.data[0]
            else:
                product = await _to_thread(
                    stripe.Product.create,
                    name=f"FiiLTHY {plan.title()}",
                    metadata={"filthy_plan": plan},
                    description=f"FiiLTHY.AI — {plan.title()} plan ({cfg['limit']} monthly generations)",
                )
            # Find matching price
            prices = await _to_thread(
                stripe.Price.search,
                query=(
                    f"product:'{product.id}' AND "
                    f"currency:'usd' AND "
                    f"metadata['filthy_plan']:'{plan}'"
                ),
                limit=10,
            )
            price = None
            for p in (prices.data or []):
                if p.unit_amount == int(round(cfg["amount_usd"] * 100)) and p.recurring and p.recurring.interval == "month" and p.active:
                    price = p
                    break
            if not price:
                price = await _to_thread(
                    stripe.Price.create,
                    product=product.id,
                    unit_amount=int(round(cfg["amount_usd"] * 100)),
                    currency="usd",
                    recurring={"interval": "month"},
                    metadata={"filthy_plan": plan},
                )
            PRICE_IDS[plan] = price.id
        except Exception as ex:
            log.error(f"ensure_prices({plan}) failed: {ex}")
    log.info(f"Stripe prices ready: {PRICE_IDS}")
    return PRICE_IDS


async def create_checkout_session(
    plan: str,
    user_id: str,
    user_email: str,
    success_url: str,
    cancel_url: str,
    coupon_code: Optional[str] = None,
    referral_code: Optional[str] = None,
) -> Dict[str, Any]:
    if plan not in PLAN_CONFIG:
        return {"ok": False, "error": "invalid_plan"}
    if not configured():
        return {"ok": False, "error": "stripe_not_configured"}
    price_id = PRICE_IDS.get(plan)
    if not price_id:
        await ensure_prices()
        price_id = PRICE_IDS.get(plan)
    if not price_id:
        return {"ok": False, "error": "price_not_ready"}

    kwargs: Dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "customer_email": user_email,
        "metadata": {
            "filthy_user_id": user_id,
            "filthy_plan": plan,
            "filthy_referral": referral_code or "",
        },
        "subscription_data": {
            "metadata": {
                "filthy_user_id": user_id,
                "filthy_plan": plan,
                "filthy_referral": referral_code or "",
            },
        },
        "allow_promotion_codes": True,
        "billing_address_collection": "auto",
    }
    if coupon_code:
        try:
            promos = await _to_thread(
                stripe.PromotionCode.list, code=coupon_code, active=True, limit=1
            )
            if promos.data:
                kwargs["discounts"] = [{"promotion_code": promos.data[0].id}]
                kwargs.pop("allow_promotion_codes", None)
        except Exception as ex:
            log.warning(f"promo lookup failed: {ex}")

    try:
        session = await _to_thread(stripe.checkout.Session.create, **kwargs)
        return {
            "ok": True,
            "session_id": session.id,
            "url": session.url,
            "price_id": price_id,
        }
    except Exception as ex:
        log.error(f"create_checkout_session failed: {ex}")
        return {"ok": False, "error": str(ex)}


async def create_product_unlock_session(
    product_id: str,
    product_title: str,
    amount_usd: float,
    user_id: str,
    user_email: str,
    success_url: str,
    cancel_url: str,
) -> Dict[str, Any]:
    if not configured():
        return {"ok": False, "error": "stripe_not_configured"}
    try:
        session = await _to_thread(
            stripe.checkout.Session.create,
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": int(round(float(amount_usd) * 100)),
                    "product_data": {
                        "name": f"FiiLTHY Product Package - {product_title[:80]}",
                        "description": "One-time unlock for the complete product, store package, cover, sales copy, and promo videos.",
                        "metadata": {"filthy_product_id": product_id},
                    },
                },
                "quantity": 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user_email,
            metadata={
                "filthy_user_id": user_id,
                "filthy_product_id": product_id,
                "filthy_purchase_type": "product_unlock",
            },
            payment_intent_data={
                "metadata": {
                    "filthy_user_id": user_id,
                    "filthy_product_id": product_id,
                    "filthy_purchase_type": "product_unlock",
                }
            },
            billing_address_collection="auto",
        )
        return {"ok": True, "session_id": session.id, "url": session.url}
    except Exception as ex:
        log.error(f"create_product_unlock_session failed: {ex}")
        return {"ok": False, "error": str(ex)}


async def get_session(session_id: str) -> Dict[str, Any]:
    try:
        s = await _to_thread(
            stripe.checkout.Session.retrieve, session_id, expand=["subscription", "customer"]
        )
        return {"ok": True, "session": s}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


async def cancel_subscription(subscription_id: str, at_period_end: bool = True) -> Dict[str, Any]:
    try:
        if at_period_end:
            sub = await _to_thread(
                stripe.Subscription.modify, subscription_id, cancel_at_period_end=True
            )
        else:
            sub = await _to_thread(stripe.Subscription.cancel, subscription_id)
        return {"ok": True, "subscription": sub}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


async def reactivate_subscription(subscription_id: str) -> Dict[str, Any]:
    try:
        sub = await _to_thread(
            stripe.Subscription.modify, subscription_id, cancel_at_period_end=False
        )
        return {"ok": True, "subscription": sub}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


async def update_subscription_plan(subscription_id: str, new_plan: str) -> Dict[str, Any]:
    """Upgrade / downgrade — prorates by default."""
    if new_plan not in PLAN_CONFIG:
        return {"ok": False, "error": "invalid_plan"}
    price_id = PRICE_IDS.get(new_plan)
    if not price_id:
        await ensure_prices()
        price_id = PRICE_IDS.get(new_plan)
    if not price_id:
        return {"ok": False, "error": "price_not_ready"}
    try:
        sub = await _to_thread(stripe.Subscription.retrieve, subscription_id)
        items = sub["items"]["data"]
        if not items:
            return {"ok": False, "error": "no_subscription_items"}
        updated = await _to_thread(
            stripe.Subscription.modify,
            subscription_id,
            items=[{"id": items[0]["id"], "price": price_id}],
            proration_behavior="always_invoice",
            metadata={**(sub.metadata or {}), "filthy_plan": new_plan},
        )
        return {"ok": True, "subscription": updated}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


async def list_invoices_for_customer(customer_id: str, limit: int = 20) -> Dict[str, Any]:
    try:
        invs = await _to_thread(stripe.Invoice.list, customer=customer_id, limit=limit)
        rows = []
        for i in (invs.data or []):
            if isinstance(i, dict):
                rows.append(i)
            elif hasattr(i, "to_dict_recursive"):
                rows.append(i.to_dict_recursive())
            elif hasattr(i, "to_dict"):
                rows.append(i.to_dict())
            else:
                rows.append(dict(i))
        return {"ok": True, "invoices": rows}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


async def retrieve_invoice(invoice_id: str) -> Dict[str, Any]:
    try:
        inv = await _to_thread(stripe.Invoice.retrieve, invoice_id)
        if hasattr(inv, "to_dict_recursive"):
            inv = inv.to_dict_recursive()
        elif hasattr(inv, "to_dict"):
            inv = inv.to_dict()
        return {"ok": True, "invoice": inv}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


async def list_payment_methods(customer_id: str) -> Dict[str, Any]:
    try:
        methods = await _to_thread(stripe.PaymentMethod.list, customer=customer_id, type="card")
        rows = []
        for m in (methods.data or []):
            raw = m.to_dict_recursive() if hasattr(m, "to_dict_recursive") else (m.to_dict() if hasattr(m, "to_dict") else dict(m))
            card = raw.get("card") or {}
            rows.append({
                "id": raw.get("id"),
                "brand": card.get("brand"),
                "last4": card.get("last4"),
                "exp_month": card.get("exp_month"),
                "exp_year": card.get("exp_year"),
            })
        return {"ok": True, "payment_methods": rows}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


async def create_billing_portal_session(customer_id: str, return_url: str) -> Dict[str, Any]:
    try:
        p = await _to_thread(
            stripe.billing_portal.Session.create, customer=customer_id, return_url=return_url
        )
        return {"ok": True, "url": p.url}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


def verify_webhook(payload: bytes, signature: str) -> Optional[Any]:
    """Returns a Stripe Event on success, None on verification failure.
    Requires STRIPE_WEBHOOK_SECRET — unsigned events are rejected."""
    if not STRIPE_WEBHOOK_SECRET:
        log.error("STRIPE_WEBHOOK_SECRET not set — refusing to process webhook.")
        return None
    try:
        return stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError as ex:
        log.error(f"webhook signature verify failed: {ex}")
        return None
    except Exception as ex:
        log.error(f"webhook exception: {ex}")
        return None

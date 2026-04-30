"""Executive analytics aggregation for revenue, products, funnels, and retention."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from db import db
from services import stripe_service


def _dt(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


PLAN_PRICES = {k: float(v["amount_usd"]) for k, v in stripe_service.PLAN_CONFIG.items()}


async def executive_dashboard() -> Dict[str, Any]:
    users = await db.users.find({}, {"_id": 0, "id": 1, "plan": 1, "created_at": 1, "subscription_status": 1}).to_list(10000)
    paid_users = [u for u in users if u.get("plan") in PLAN_PRICES and u.get("subscription_status") != "canceled"]
    mrr = round(sum(PLAN_PRICES.get(u.get("plan"), 0) for u in paid_users), 2)
    arr = round(mrr * 12, 2)

    tx_paid = await db.payment_transactions.find({"payment_status": "paid"}, {"_id": 0}).to_list(10000)
    gross = round(sum(float(t.get("amount", 0)) for t in tx_paid), 2)
    cac_spend = 0.0
    ad_spend_rows = await db.ad_spend.find({}, {"_id": 0}).to_list(10000)
    if ad_spend_rows:
        cac_spend = round(sum(float(r.get("amount", 0)) for r in ad_spend_rows), 2)
    paid_count = max(len(paid_users), 1)
    ltv = round(gross / paid_count, 2) if tx_paid else 0.0
    cac = round(cac_spend / paid_count, 2) if cac_spend else 0.0

    cancelled_30d = await db.users.count_documents({"subscription_status": "canceled", "subscription_cancelled_at": {"$gte": _dt(30)}})
    churn = round(cancelled_30d / max(len(paid_users) + cancelled_30d, 1), 4)
    signups_30d = await db.users.count_documents({"created_at": {"$gte": _dt(30)}})
    paid_30d = await db.users.count_documents({"plan": {"$in": list(PLAN_PRICES)}, "plan_updated_at": {"$gte": _dt(30)}})
    conversion = round(paid_30d / max(signups_30d, 1), 4)

    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    launches = await db.listings.find({}, {"_id": 0}).to_list(10000)
    successful_launches = [l for l in launches if l.get("status") in ("LIVE", "SIMULATED")]
    launch_success_rate = round(len(successful_launches) / max(len(launches), 1), 4)
    onboarding_completion = round(
        len([u for u in users if any(p.get("user_id") == u["id"] for p in products)]) / max(len(users), 1),
        4,
    )

    tracking = await db.tracking_events.find({}, {"_id": 0}).to_list(20000)
    clicks = len([e for e in tracking if e.get("event_type") == "click"])
    sales = len([e for e in tracking if e.get("event_type") == "sale"])
    funnel_dropoff = {
        "signup_to_paid": round(1 - conversion, 4),
        "click_to_sale": round(1 - (sales / max(clicks, 1)), 4),
    }

    def top_counts(field: str, rows: List[Dict[str, Any]], limit: int = 8):
        counts: Dict[str, int] = {}
        for row in rows:
            val = row.get(field) or "unknown"
            counts[val] = counts.get(val, 0) + 1
        return [{"name": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]]

    product_revenue = sorted(
        [{"id": p.get("id"), "title": p.get("title"), "revenue": round(float(p.get("revenue", 0)), 2), "sales": p.get("sales_count", 0)}
         for p in products],
        key=lambda x: (x["revenue"], x["sales"]), reverse=True,
    )[:8]

    ad_perf = await db.tracking_events.aggregate([
        {"$group": {"_id": {"source": "$source", "content_id": "$content_id"}, "events": {"$sum": 1}, "revenue": {"$sum": {"$ifNull": ["$value", 0]}}}},
        {"$sort": {"revenue": -1, "events": -1}},
        {"$limit": 8},
    ]).to_list(8)

    cohorts = []
    for days in (7, 30, 60, 90):
        cohort_users = [u for u in users if u.get("created_at", "") >= _dt(days)]
        active = [u for u in cohort_users if u.get("subscription_status") in ("active", "trialing")]
        cohorts.append({"window_days": days, "users": len(cohort_users), "retained_paid": len(active), "retention": round(len(active) / max(len(cohort_users), 1), 4)})

    return {
        "revenue": {"mrr": mrr, "arr": arr, "gross_lifetime": gross, "ltv": ltv, "cac": cac},
        "growth": {"churn": churn, "conversion": conversion, "onboarding_completion": onboarding_completion, "launch_success_rate": launch_success_rate},
        "content": {
            "top_niches": top_counts("target_audience", products),
            "best_products": product_revenue,
            "best_ads": [{"source": r["_id"].get("source"), "content_id": r["_id"].get("content_id"), "events": r["events"], "revenue": round(r.get("revenue", 0), 2)} for r in ad_perf],
            "best_emails": [],
        },
        "retention_cohorts": cohorts,
        "funnel_dropoff": funnel_dropoff,
        "posthog": {
            "heatmaps": "enabled_when_posthog_snippet_configured",
            "session_recordings": "enabled_when_posthog_snippet_configured",
            "ab_tests": "managed_in_posthog_feature_flags",
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

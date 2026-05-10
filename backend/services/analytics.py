"""Executive analytics aggregation for revenue, products, funnels, and retention."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from db import db
from services import stripe_service


def _cutoff_dt(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _as_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            return None
    return None


PLAN_PRICES = {k: float(v["amount_usd"]) for k, v in stripe_service.PLAN_CONFIG.items()}


async def executive_dashboard() -> Dict[str, Any]:
    # Aggregated user stats
    user_stats_pipeline = [
        {
            "$facet": {
                "total": [{"$count": "count"}],
                "plans": [{"$group": {"_id": "$plan", "count": {"$sum": 1}}}],
                "active_subscriptions": [
                    {"$match": {"subscription_status": {"$in": ["active", "trialing"]}}},
                    {"$group": {"_id": "$plan", "count": {"$sum": 1}}},
                ],
                "recent_signups": [
                    {"$match": {"created_at": {"$gte": _cutoff_dt(30).isoformat()}}},
                    {"$count": "count"},
                ],
                "cancelled_30d": [
                    {"$match": {
                        "subscription_status": "canceled",
                        "subscription_cancelled_at": {"$gte": _cutoff_dt(30).isoformat()}
                    }},
                    {"$count": "count"}
                ]
            }
        }
    ]
    
    u_agg = (await db.users.aggregate(user_stats_pipeline).to_list(1))[0]
    total_users = (u_agg["total"][0]["count"] if u_agg["total"] else 1)
    
    active_plans = {p["_id"]: p["count"] for p in u_agg["active_subscriptions"]}
    mrr = round(sum(PLAN_PRICES.get(plan, 0) * count for plan, count in active_plans.items()), 2)
    arr = round(mrr * 12, 2)

    signups_30d = u_agg["recent_signups"][0]["count"] if u_agg["recent_signups"] else 0
    cancelled_30d = u_agg["cancelled_30d"][0]["count"] if u_agg["cancelled_30d"] else 0
    churn = round(cancelled_30d / max(len(active_plans) + cancelled_30d, 1), 4)

    # Conversion (Paid in last 30d)
    paid_30d = await db.users.count_documents({
        "plan": {"$in": list(PLAN_PRICES.keys())},
        "plan_updated_at": {"$gte": _cutoff_dt(30).isoformat()}
    })
    conversion = round(paid_30d / max(signups_30d, 1), 4)

    # Gross revenue
    tx_agg = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": {"$toDouble": "$amount"}}, "count": {"$sum": 1}}}
    ]).to_list(1)
    
    gross = round(tx_agg[0]["total"] if tx_agg else 0.0, 2)
    paid_count = max(sum(active_plans.values()), 1)
    ltv = round(gross / paid_count, 2)

    # CAC from ad_spend
    ad_spend_agg = await db.ad_spend.aggregate([
        {"$group": {"_id": None, "total": {"$sum": {"$toDouble": "$amount"}}}}
    ]).to_list(1)
    cac_spend = ad_spend_agg[0]["total"] if ad_spend_agg else 0.0
    cac = round(cac_spend / paid_count, 2)

    # Product and Launch stats
    product_count = await db.products.count_documents({})
    launch_stats = await db.listings.aggregate([
        {"$facet": {
            "total": [{"$count": "count"}],
            "successful": [{"$match": {"status": "LIVE", "real": True}}, {"$count": "count"}]
        }}
    ]).to_list(1)
    
    l_stats = launch_stats[0]
    total_launches = l_stats["total"][0]["count"] if l_stats["total"] else 0
    success_launches = l_stats["successful"][0]["count"] if l_stats["successful"] else 0
    launch_success_rate = round(success_launches / max(total_launches, 1), 4)

    # Onboarding: % users with at least 1 product
    users_with_products = len(await db.products.distinct("user_id"))
    onboarding_completion = round(users_with_products / total_users, 4)

    # Tracking stats
    tracking_agg = await db.tracking_events.aggregate([
        {"$facet": {
            "clicks": [{"$match": {"event_type": "click"}}, {"$count": "count"}],
            "sales": [{"$match": {"event_type": "sale"}}, {"$count": "count"}]
        }}
    ]).to_list(1)
    
    t_stats = tracking_agg[0]
    clicks = t_stats["clicks"][0]["count"] if t_stats["clicks"] else 0
    sales = t_stats["sales"][0]["count"] if t_stats["sales"] else 0

    funnel_dropoff = {
        "signup_to_paid": round(1 - conversion, 4),
        "click_to_sale": round(1 - (sales / max(clicks, 1)), 4),
    }

    # Best Products by revenue
    product_revenue = await db.products.find({}, {"_id": 0, "id": 1, "title": 1, "revenue": 1, "sales_count": 1}).sort([("revenue", -1), ("sales_count", -1)]).limit(8).to_list(8)
    product_revenue = [{"id": p.get("id"), "title": p.get("title"), "revenue": round(float(p.get("revenue", 0)), 2), "sales": p.get("sales_count", 0)} for p in product_revenue]

    # Best Ads
    ad_perf = await db.tracking_events.aggregate([
        {"$group": {"_id": {"source": "$source", "content_id": "$content_id"}, "events": {"$sum": 1}, "revenue": {"$sum": {"$ifNull": ["$value", 0]}}}},
        {"$sort": {"revenue": -1, "events": -1}},
        {"$limit": 8},
    ]).to_list(8)

    return {
        "revenue": {"mrr": mrr, "arr": arr, "gross_lifetime": gross, "ltv": ltv, "cac": cac},
        "growth": {"churn": churn, "conversion": conversion, "onboarding_completion": onboarding_completion, "launch_success_rate": launch_success_rate},
        "content": {
            "best_products": product_revenue,
            "best_ads": [{"source": r["_id"].get("source"), "content_id": r["_id"].get("content_id"), "events": r["events"], "revenue": round(r.get("revenue", 0), 2)} for r in ad_perf],
        },
        "funnel_dropoff": funnel_dropoff,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

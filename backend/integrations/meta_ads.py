"""Meta Marketing API integration — auto-launch paid ad campaigns.

Graph API: https://graph.facebook.com/v19.0/

Required env:
    META_ACCESS_TOKEN
    META_AD_ACCOUNT_ID   (without 'act_' prefix)
    META_PIXEL_ID
    META_PAGE_ID
"""
import os
import logging
from typing import Optional, List, Dict, Any

import httpx

log = logging.getLogger("filthy.meta")

GRAPH_BASE = "https://graph.facebook.com/v19.0"


def _account_path(ad_account_id: str) -> str:
    aid = ad_account_id if ad_account_id.startswith("act_") else f"act_{ad_account_id}"
    return f"{GRAPH_BASE}/{aid}"


def _meta_error(resp: httpx.Response) -> Dict[str, Any]:
    try:
        data = resp.json()
    except Exception:
        data = {"error": {"message": resp.text or "unknown"}}
    err = data.get("error", {}) if isinstance(data, dict) else {}
    return {
        "ok": False,
        "status_code": resp.status_code,
        "error_code": err.get("code"),
        "error_type": err.get("type"),
        "error_subcode": err.get("error_subcode"),
        "error_user_title": err.get("error_user_title"),
        "message": err.get("message") or str(data),
        "fbtrace_id": err.get("fbtrace_id"),
    }


async def _post(url: str, data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, data=data)
        if r.status_code >= 400:
            err = _meta_error(r)
            log.error(f"Meta API error POST {url}: {err}")
            return err
        return {"ok": True, "data": r.json()}
    except httpx.HTTPError as e:
        log.error(f"Meta HTTP error POST {url}: {e}")
        return {"ok": False, "message": f"http_error: {e}"}
    except Exception as e:
        log.error(f"Meta unknown error POST {url}: {e}")
        return {"ok": False, "message": f"unknown: {e}"}


# ---------- Public API ----------
async def create_campaign(ad_account_id: str, access_token: str, name: str = "FiiLTHY Auto Campaign") -> Dict[str, Any]:
    """Create a PAUSED OUTCOME_SALES campaign. Returns {ok, campaign_id} or {ok:false, ...}."""
    url = f"{_account_path(ad_account_id)}/campaigns"
    res = await _post(url, {
        "name": name[:200],
        "objective": "OUTCOME_SALES",
        "status": "PAUSED",
        "special_ad_categories": "[]",
        "access_token": access_token,
    })
    if not res.get("ok"):
        return res
    return {"ok": True, "campaign_id": res["data"].get("id")}


async def create_ad_set(
    ad_account_id: str,
    campaign_id: str,
    access_token: str,
    name: str = "FiiLTHY Auto AdSet",
    pixel_id: Optional[str] = None,
    daily_budget_cents: int = 500,
    countries: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Create a PAUSED ad set optimized for offsite PURCHASE conversions."""
    import json as _json
    pixel = pixel_id or os.environ.get("META_PIXEL_ID", "")
    countries = countries or ["US", "CA"]
    targeting = {"geo_locations": {"countries": countries}}
    promoted_object = {"pixel_id": pixel, "custom_event_type": "PURCHASE"}

    url = f"{_account_path(ad_account_id)}/adsets"
    res = await _post(url, {
        "name": name[:200],
        "campaign_id": campaign_id,
        "daily_budget": daily_budget_cents,
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "OFFSITE_CONVERSIONS",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "targeting": _json.dumps(targeting),
        "promoted_object": _json.dumps(promoted_object),
        "status": "PAUSED",
        "access_token": access_token,
    })
    if not res.get("ok"):
        return res
    return {"ok": True, "adset_id": res["data"].get("id")}


async def create_ad_creative(
    ad_account_id: str,
    access_token: str,
    headline: str,
    primary_text: str,
    image_url: str,
    link: str,
    page_id: Optional[str] = None,
    name: str = "FiiLTHY Auto Creative",
) -> Dict[str, Any]:
    """Create an ad creative using object_story_spec link_data."""
    import json as _json
    pid = page_id or os.environ.get("META_PAGE_ID", "")
    story_spec = {
        "page_id": pid,
        "link_data": {
            "message": primary_text[:1800],
            "link": link,
            "name": headline[:255],
            "image_url": image_url,
        },
    }
    url = f"{_account_path(ad_account_id)}/adcreatives"
    res = await _post(url, {
        "name": name[:200],
        "object_story_spec": _json.dumps(story_spec),
        "access_token": access_token,
    })
    if not res.get("ok"):
        return res
    return {"ok": True, "creative_id": res["data"].get("id")}


async def create_ad(
    ad_account_id: str,
    ad_set_id: str,
    creative_id: str,
    access_token: str,
    name: str = "FiiLTHY Auto Ad",
) -> Dict[str, Any]:
    """Create a PAUSED ad under the given ad set + creative."""
    import json as _json
    url = f"{_account_path(ad_account_id)}/ads"
    res = await _post(url, {
        "name": name[:200],
        "adset_id": ad_set_id,
        "creative": _json.dumps({"creative_id": creative_id}),
        "status": "PAUSED",
        "access_token": access_token,
    })
    if not res.get("ok"):
        return res
    return {"ok": True, "ad_id": res["data"].get("id")}


async def set_status(node_id: str, status: str, access_token: str) -> Dict[str, Any]:
    """Flip a campaign / adset / ad to ACTIVE or PAUSED."""
    if status not in ("ACTIVE", "PAUSED"):
        return {"ok": False, "message": f"invalid status: {status}"}
    url = f"{GRAPH_BASE}/{node_id}"
    res = await _post(url, {"status": status, "access_token": access_token})
    if not res.get("ok"):
        return res
    return {"ok": True, "id": node_id, "status": status}

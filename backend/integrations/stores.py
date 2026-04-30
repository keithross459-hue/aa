"""Additional real store integrations — Stan Store, Whop, Payhip.

These use user-supplied API tokens. Each function returns:
    {ok: bool, short_url?: str, product_id?: str, error?: str, raw?: dict}
"""
from typing import Optional, Dict, Any

import httpx


async def _post_json(url: str, headers: Dict[str, str], json_body: Dict[str, Any], timeout: float = 20.0) -> httpx.Response:
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.post(url, headers=headers, json=json_body)


# ---------- Stan Store ----------
# Stan Store's public API is in beta/private; endpoints documented at:
# https://developers.stan.store/ (requires Pro plan creator token).
STAN_BASE = "https://api.stan.store/v1"


async def stan_create_product(
    access_token: str, name: str, price_cents: int, description: str
) -> Dict[str, Any]:
    if not access_token:
        return {"ok": False, "error": "stan_not_configured"}
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    body = {
        "title": name[:200],
        "price": max(price_cents / 100.0, 1.0),
        "description": description[:5000],
        "type": "digital",
        "published": True,
    }
    try:
        r = await _post_json(f"{STAN_BASE}/products", headers, body)
        data = r.json() if r.content else {}
        if r.status_code >= 400:
            return {"ok": False, "error": data.get("message", f"http_{r.status_code}"), "raw": data}
        prod = data.get("product") or data
        return {
            "ok": True,
            "product_id": prod.get("id"),
            "short_url": prod.get("url") or prod.get("short_url"),
            "raw": prod,
        }
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"http_error: {e}"}
    except Exception as e:
        return {"ok": False, "error": f"unknown: {e}"}


# ---------- Whop ----------
# Whop REST API: https://docs.whop.com/api-reference/v2
WHOP_BASE = "https://api.whop.com/v5"


async def whop_create_product(
    api_key: str, name: str, price_cents: int, description: str
) -> Dict[str, Any]:
    if not api_key:
        return {"ok": False, "error": "whop_not_configured"}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "name": name[:200],
        "description": description[:5000],
        "visibility": "visible",
    }
    try:
        # Create product
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(f"{WHOP_BASE}/products", headers=headers, json=body)
        data = r.json() if r.content else {}
        if r.status_code >= 400:
            return {"ok": False, "error": data.get("message", f"http_{r.status_code}"), "raw": data}
        prod = data.get("data") or data
        product_id = prod.get("id")
        short_url = prod.get("route") or prod.get("checkout_url") or prod.get("url")
        # Attach a one-time price plan
        if product_id and price_cents > 0:
            try:
                plan_body = {
                    "product_id": product_id,
                    "plan_type": "one_time",
                    "initial_price": price_cents / 100.0,
                    "base_currency": "usd",
                    "visibility": "visible",
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.post(f"{WHOP_BASE}/plans", headers=headers, json=plan_body)
            except Exception:
                pass
        return {"ok": True, "product_id": product_id, "short_url": short_url, "raw": prod}
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"http_error: {e}"}
    except Exception as e:
        return {"ok": False, "error": f"unknown: {e}"}


# ---------- Payhip ----------
# Payhip public API: https://payhip.com/docs/api
PAYHIP_BASE = "https://payhip.com/api/v2"


async def payhip_create_product(
    api_key: str, name: str, price_cents: int, description: str
) -> Dict[str, Any]:
    if not api_key:
        return {"ok": False, "error": "payhip_not_configured"}
    headers = {"payhip-api-key": api_key, "Content-Type": "application/json"}
    body = {
        "name": name[:200],
        "description": description[:5000],
        "price": max(price_cents / 100.0, 0.99),
        "currency": "USD",
        "type": "digital",
        "is_published": True,
    }
    try:
        r = await _post_json(f"{PAYHIP_BASE}/products", headers, body)
        data = r.json() if r.content else {}
        if r.status_code >= 400:
            return {"ok": False, "error": data.get("message", f"http_{r.status_code}"), "raw": data}
        prod = data.get("data") or data
        return {
            "ok": True,
            "product_id": prod.get("id") or prod.get("product_id"),
            "short_url": prod.get("link") or prod.get("url"),
            "raw": prod,
        }
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"http_error: {e}"}
    except Exception as e:
        return {"ok": False, "error": f"unknown: {e}"}

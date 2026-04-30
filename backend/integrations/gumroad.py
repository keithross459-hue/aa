"""Gumroad API integration — real digital product publishing.

Accepts an explicit `access_token` (per-user) — falls back to env if not provided.
"""
import os
import httpx
from typing import Optional

GUMROAD_API = "https://api.gumroad.com/v2"


async def create_product(
    name: str,
    price_cents: int,
    description: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict:
    """Create a Gumroad product. Returns {ok, product_id, short_url, raw}."""
    token = access_token or os.environ.get("GUMROAD_ACCESS_TOKEN")
    if not token:
        return {"ok": False, "error": "gumroad_not_configured"}

    payload = {
        "access_token": token,
        "name": name[:200],
        "price": max(price_cents, 99),  # min $0.99 per Gumroad rules
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(f"{GUMROAD_API}/products", data=payload)
        data = r.json() if r.content else {}
        if not data.get("success"):
            return {"ok": False, "error": data.get("message", f"http_{r.status_code}"), "raw": data}
        prod = data.get("product", {})
        short_url = prod.get("short_url") or prod.get("url")
        product_id = prod.get("id") or prod.get("custom_permalink")

        # Best-effort description update (non-fatal)
        if description and product_id:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.put(
                        f"{GUMROAD_API}/products/{product_id}",
                        data={"access_token": token, "description": description[:5000]},
                    )
            except Exception:
                pass

        # Best-effort publish (default products are unpublished)
        if product_id:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.put(
                        f"{GUMROAD_API}/products/{product_id}/enable",
                        data={"access_token": token},
                    )
            except Exception:
                pass

        return {"ok": True, "product_id": product_id, "short_url": short_url, "raw": prod}
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"http_error: {e}"}
    except Exception as e:
        return {"ok": False, "error": f"unknown: {e}"}


async def verify_token(access_token: str) -> dict:
    """Lightweight token test via /user endpoint."""
    if not access_token:
        return {"ok": False, "error": "missing_token"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{GUMROAD_API}/user", params={"access_token": access_token})
        data = r.json() if r.content else {}
        if data.get("success"):
            user = data.get("user", {}) or {}
            return {"ok": True, "email": user.get("email"), "name": user.get("name")}
        return {"ok": False, "error": data.get("message", f"http_{r.status_code}")}
    except Exception as e:
        return {"ok": False, "error": f"unknown: {e}"}

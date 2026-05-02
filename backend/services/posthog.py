"""Optional PostHog capture helper.

The app works without PostHog credentials. When POSTHOG_API_KEY is present,
events are sent server-side so product, billing, launch, and referral actions
can feed dashboards without blocking user requests.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, Optional

import requests

log = logging.getLogger("filthy.posthog")

POSTHOG_API_KEY = os.environ.get("POSTHOG_API_KEY", "")
POSTHOG_HOST = os.environ.get("POSTHOG_HOST", "https://app.posthog.com").rstrip("/")


def configured() -> bool:
    return bool(POSTHOG_API_KEY)


async def capture(
    distinct_id: str,
    event: str,
    properties: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not configured():
        return {"ok": False, "skipped": True, "error": "posthog_not_configured"}

    payload = {
        "api_key": POSTHOG_API_KEY,
        "event": event,
        "distinct_id": distinct_id,
        "properties": properties or {},
    }

    def _send():
        return requests.post(f"{POSTHOG_HOST}/capture/", json=payload, timeout=8)

    try:
        resp = await asyncio.to_thread(_send)
        return {"ok": 200 <= resp.status_code < 300, "status_code": resp.status_code}
    except Exception as ex:
        log.warning("posthog capture failed: %s", ex)
        return {"ok": False, "error": str(ex)}

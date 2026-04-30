"""Production smoke tests for deployed FiiLTHY environments."""
from __future__ import annotations

import os
import sys

import requests


def check(url: str) -> None:
    resp = requests.get(url, timeout=15)
    if resp.status_code >= 400:
        raise RuntimeError(f"{url} failed: {resp.status_code} {resp.text[:200]}")
    print(f"OK {url}")


def main() -> int:
    base = os.environ.get("SMOKE_BACKEND_URL", "http://localhost:8001").rstrip("/")
    for path in ["/api/health", "/api/ready", "/api/status", "/api/billing/plans", "/api/referrals/leaderboard", "/api/legal/privacy", "/api/legal/terms"]:
        check(f"{base}{path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as ex:
        print(f"SMOKE FAILED: {ex}", file=sys.stderr)
        raise SystemExit(1)

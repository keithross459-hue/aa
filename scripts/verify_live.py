"""Live deployment verifier.

Usage:
  python scripts/verify_live.py --backend https://api.example.com --frontend https://example.com
Optionally set FIILTHY_TEST_EMAIL/FIILTHY_TEST_PASSWORD for auth checks.
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import Dict

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def get_json(url: str, headers: Dict[str, str] | None = None) -> dict:
    r = requests.get(url, headers=headers or {}, timeout=20)
    if r.status_code >= 400:
        raise RuntimeError(f"GET {url} -> {r.status_code}: {r.text[:200]}")
    return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--backend", required=True)
    p.add_argument("--frontend", required=True)
    args = p.parse_args()
    backend = args.backend.rstrip("/")
    frontend = args.frontend.rstrip("/")

    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retries))

    checks = [
        "/api/health",
        "/api/ready",
        "/api/status",
        "/api/billing/plans",
        "/api/referrals/leaderboard",
        "/api/legal/privacy",
        "/api/legal/terms",
    ]

    print("--- Starting Backend Health Checks ---")
    for path in checks:
        try:
            r = session.get(f"{backend}{path}", timeout=20)
            if r.status_code >= 400:
                raise RuntimeError(f"GET {path} -> {r.status_code}")
            
            res = r.json() if "application/json" in r.headers.get("content-type", "").lower() else {}
            
            if path == "/api/status":
                analytics_status = res.get("analytics")
                if analytics_status == "not_configured":
                    print(f"!! WARNING: PostHog (analytics) is NOT_CONFIGURED at {path}")
                else:
                    print(f"OK: Analytics Status: {analytics_status}")
            print(f"PASS: {path}")
        except Exception as e:
            print(f"FAIL: {path} - {e}")
            return 1

    print("\n--- Starting Frontend Health Checks ---")
    f = session.get(frontend, timeout=20)
    if f.status_code >= 400:
        raise RuntimeError(f"frontend failed: {f.status_code}")
    print(f"PASS: {frontend} (Status: {f.status_code})")

    email = os.environ.get("FIILTHY_TEST_EMAIL")
    password = os.environ.get("FIILTHY_TEST_PASSWORD")
    if email and password:
        print("\n--- Starting Authenticated Checks ---")
        r = session.post(f"{backend}/api/auth/login", json={"email": email, "password": password}, timeout=20)
        if r.status_code >= 400:
            raise RuntimeError(f"login failed: {r.status_code} {r.text[:200]}")
        token = r.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        for path in ["/api/auth/me", "/api/stats", "/api/billing/invoices", "/api/referrals/me"]:
            r = session.get(f"{backend}{path}", headers=headers, timeout=20)
            if r.status_code >= 400:
                raise RuntimeError(f"Auth check failed for {path}: {r.status_code}")
            print(f"PASS: Authed {path}")
    else:
        print("SKIP authed checks: set FIILTHY_TEST_EMAIL/FIILTHY_TEST_PASSWORD")
        print("\nSKIP: Authenticated checks (set FIILTHY_TEST_EMAIL/FIILTHY_TEST_PASSWORD)")

    print("\nALL SYSTEMS GREEN: Deployment verified.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as ex:
        print(f"VERIFY FAILED: {ex}", file=sys.stderr)
        raise SystemExit(1)

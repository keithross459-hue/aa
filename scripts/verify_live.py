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

    checks = [
        "/api/health",
        "/api/ready",
        "/api/status",
        "/api/billing/plans",
        "/api/referrals/leaderboard",
        "/api/legal/privacy",
        "/api/legal/terms",
    ]
    for path in checks:
        get_json(f"{backend}{path}")
        print(f"OK backend {path}")

    f = requests.get(frontend, timeout=20)
    if f.status_code >= 400:
        raise RuntimeError(f"frontend failed: {f.status_code}")
    print("OK frontend /")

    email = os.environ.get("FIILTHY_TEST_EMAIL")
    password = os.environ.get("FIILTHY_TEST_PASSWORD")
    if email and password:
        r = requests.post(f"{backend}/api/auth/login", json={"email": email, "password": password}, timeout=20)
        if r.status_code >= 400:
            raise RuntimeError(f"login failed: {r.status_code} {r.text[:200]}")
        token = r.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        for path in ["/api/auth/me", "/api/stats", "/api/billing/invoices", "/api/referrals/me"]:
            get_json(f"{backend}{path}", headers=headers)
            print(f"OK authed {path}")
    else:
        print("SKIP authed checks: set FIILTHY_TEST_EMAIL/FIILTHY_TEST_PASSWORD")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as ex:
        print(f"VERIFY FAILED: {ex}", file=sys.stderr)
        raise SystemExit(1)

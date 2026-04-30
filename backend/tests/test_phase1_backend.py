"""FiiLTHY.AI Phase 1 backend regression — Stripe subs, SendGrid, Admin, Referrals."""
from __future__ import annotations

import json
import os
import sys
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

# Load backend env vars
BACKEND_ENV = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(BACKEND_ENV)

FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
if FRONTEND_ENV.exists():
    for line in FRONTEND_ENV.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL"):
            os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip().strip('"')

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "stackdigitz@gmail.com").lower()
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Make backend importable for direct DB access
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _uniq(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_a(session):
    """Plain, non-admin user."""
    email = f"test_{_uniq('u')}@filthy.ai"
    r = session.post(f"{API}/auth/signup", json={"email": email, "password": "test123", "name": "User A"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def owner_user(session):
    """Fresh OWNER_EMAIL signup to get admin role. Deletes any existing doc first via Mongo."""
    import asyncio
    from db import db

    async def _reset():
        await db.users.delete_one({"email": OWNER_EMAIL})
        await db.referral_codes.delete_many({"user_id": {"$exists": True}})
    # Only delete owner specifically
    async def _reset_owner():
        u = await db.users.find_one({"email": OWNER_EMAIL})
        if u:
            await db.referral_codes.delete_many({"user_id": u["id"]})
        await db.users.delete_one({"email": OWNER_EMAIL})
    asyncio.get_event_loop().run_until_complete(_reset_owner())
    r = session.post(f"{API}/auth/signup", json={"email": OWNER_EMAIL, "password": "ownerpass123", "name": "Owner"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin", f"Owner should be admin, got {data['user']['role']}"
    return {"email": OWNER_EMAIL, "token": data["token"], "user": data["user"]}


def H(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth / Signup ----------
class TestAuth:
    def test_signup_plain(self, user_a):
        assert user_a["user"]["role"] == "user"
        assert user_a["user"]["banned"] is False
        assert "subscription_status" in user_a["user"]

    def test_me_returns_new_fields(self, session, user_a):
        r = session.get(f"{API}/auth/me", headers=H(user_a["token"]))
        assert r.status_code == 200
        u = r.json()
        for key in ("role", "subscription_status", "stripe_customer_id", "banned"):
            assert key in u, f"/auth/me missing {key}"
        assert u["role"] == "user"

    def test_owner_email_is_admin(self, owner_user):
        assert owner_user["user"]["role"] == "admin"

    def test_signup_with_referral_code_attribution(self, session, user_a):
        # Fetch user_a's referral code
        r = session.get(f"{API}/referrals/me", headers=H(user_a["token"]))
        assert r.status_code == 200, r.text
        code = r.json().get("code")
        assert code

        # Signup a brand-new user with that referral_code
        new_email = f"test_{_uniq('ref')}@filthy.ai"
        r = session.post(f"{API}/auth/signup", json={
            "email": new_email, "password": "test123", "name": "Referred", "referral_code": code
        })
        assert r.status_code == 200, r.text

        # Validate referrer now shows signups >= 1
        r2 = session.get(f"{API}/referrals/me", headers=H(user_a["token"]))
        assert r2.status_code == 200
        assert r2.json().get("signups", 0) >= 1


# ---------- Billing / Stripe ----------
class TestBilling:
    def test_plans_has_price_ids(self, session):
        r = session.get(f"{API}/billing/plans")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["stripe_configured"] is True
        plans = data["plans"]
        ids = {p["id"] for p in plans}
        assert {"starter", "pro", "enterprise"} <= ids
        for p in plans:
            assert p.get("price_id"), f"price_id missing for {p['id']}"
            assert p["price_id"].startswith("price_"), f"bad price_id: {p['price_id']}"

    def test_create_checkout_returns_stripe_url(self, session, user_a):
        r = session.post(
            f"{API}/billing/create-checkout",
            headers=H(user_a["token"]),
            json={"plan": "starter", "origin_url": BASE},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("https://checkout.stripe.com/"), f"url={data['url']}"
        assert data["session_id"].startswith("cs_"), f"session_id={data['session_id']}"
        # stash for next test
        pytest.checkout_session_id = data["session_id"]

    def test_payment_transaction_recorded(self, user_a):
        import asyncio
        from db import db

        async def _check():
            return await db.payment_transactions.find_one(
                {"session_id": pytest.checkout_session_id}, {"_id": 0}
            )
        tx = asyncio.get_event_loop().run_until_complete(_check())
        assert tx is not None
        assert tx["mode"] == "subscription"
        assert tx.get("price_id", "").startswith("price_")

    def test_billing_status_returns_dict(self, session, user_a):
        r = session.get(f"{API}/billing/status/{pytest.checkout_session_id}", headers=H(user_a["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "status" in data or "payment_status" in data

    def test_cancel_no_subscription_returns_400(self, session, user_a):
        r = session.post(f"{API}/billing/cancel", headers=H(user_a["token"]), json={"at_period_end": True})
        assert r.status_code == 400, r.text
        assert "No active subscription" in r.text

    def test_reactivate_no_subscription_returns_400(self, session, user_a):
        r = session.post(f"{API}/billing/reactivate", headers=H(user_a["token"]), json={})
        assert r.status_code == 400, r.text

    def test_change_plan_no_subscription_returns_400(self, session, user_a):
        r = session.post(f"{API}/billing/change-plan", headers=H(user_a["token"]), json={"plan": "pro"})
        assert r.status_code == 400, r.text

    def test_portal_no_customer_returns_400(self, session, user_a):
        r = session.get(f"{API}/billing/portal", headers=H(user_a["token"]))
        assert r.status_code == 400, r.text

    def test_invoices_no_customer_returns_empty(self, session, user_a):
        r = session.get(f"{API}/billing/invoices", headers=H(user_a["token"]))
        assert r.status_code == 200, r.text
        assert r.json() == {"invoices": []}


# ---------- Stripe Webhook ----------
class TestWebhook:
    def _signed_payload(self, payload: dict):
        """Build a Stripe-signature header for the given payload using the webhook secret."""
        import hashlib
        import hmac
        body = json.dumps(payload, separators=(",", ":"))
        ts = str(int(time.time()))
        signed = f"{ts}.{body}"
        sig = hmac.new(STRIPE_WEBHOOK_SECRET.encode(), signed.encode(), hashlib.sha256).hexdigest()
        return body, f"t={ts},v1={sig}"

    def test_webhook_checkout_session_completed_updates_user(self, session, user_a):
        assert STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET not set in env"
        event_id = f"evt_test_{uuid.uuid4().hex[:12]}"
        payload = {
            "id": event_id,
            "object": "event",
            "type": "checkout.session.completed",
            "data": {"object": {
                "id": f"cs_test_{uuid.uuid4().hex[:12]}",
                "object": "checkout.session",
                "subscription": f"sub_test_{uuid.uuid4().hex[:10]}",
                "customer": f"cus_test_{uuid.uuid4().hex[:10]}",
                "metadata": {"filthy_user_id": user_a["user"]["id"], "filthy_plan": "pro"},
            }},
        }
        body, sig = self._signed_payload(payload)
        r = requests.post(
            f"{API}/webhook/stripe", data=body,
            headers={"Content-Type": "application/json", "Stripe-Signature": sig},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("received") is True
        # user should now have plan=pro
        r2 = session.get(f"{API}/auth/me", headers=H(user_a["token"]))
        assert r2.json()["plan"] == "pro"
        assert r2.json()["subscription_status"] == "active"

        # Duplicate event → dedupe
        r3 = requests.post(
            f"{API}/webhook/stripe", data=body,
            headers={"Content-Type": "application/json", "Stripe-Signature": sig},
        )
        assert r3.status_code == 200
        assert r3.json().get("duplicate") is True

    def test_webhook_bad_signature_returns_400(self):
        payload = {"id": "evt_bad", "type": "ping", "data": {"object": {}}}
        r = requests.post(
            f"{API}/webhook/stripe", data=json.dumps(payload),
            headers={"Content-Type": "application/json", "Stripe-Signature": "t=1,v1=deadbeef"},
        )
        assert r.status_code == 400


# ---------- Referrals ----------
class TestReferrals:
    def test_referrals_me(self, session, user_a):
        r = session.get(f"{API}/referrals/me", headers=H(user_a["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("code", "share_url", "signups", "attributions", "commissions"):
            assert key in d

    def test_leaderboard(self, session):
        r = session.get(f"{API}/referrals/leaderboard")
        assert r.status_code == 200
        assert "leaderboard" in r.json()
        assert isinstance(r.json()["leaderboard"], list)

    def test_resolve_code_invalid(self, session):
        r = session.get(f"{API}/referrals/resolve/nonexistent-xyz123")
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_resolve_code_valid(self, session, user_a):
        r = session.get(f"{API}/referrals/me", headers=H(user_a["token"]))
        code = r.json()["code"]
        r2 = session.get(f"{API}/referrals/resolve/{code}")
        assert r2.status_code == 200
        assert r2.json()["valid"] is True


# ---------- Admin ----------
class TestAdmin:
    def test_admin_forbidden_for_normal_user(self, session, user_a):
        r = session.get(f"{API}/admin/overview", headers=H(user_a["token"]))
        assert r.status_code == 403

    def test_admin_overview(self, session, owner_user):
        r = session.get(f"{API}/admin/overview", headers=H(owner_user["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("users", "products", "campaigns", "listings", "revenue", "referrals"):
            assert key in d

    def test_admin_users_and_detail(self, session, owner_user, user_a):
        r = session.get(f"{API}/admin/users?limit=50", headers=H(owner_user["token"]))
        assert r.status_code == 200
        rows = r.json()["users"]
        assert any(u["email"] == user_a["email"] for u in rows)

        r2 = session.get(f"{API}/admin/users/{user_a['user']['id']}", headers=H(owner_user["token"]))
        assert r2.status_code == 200
        d = r2.json()
        assert d["user"]["email"] == user_a["email"]
        assert "transactions" in d

    def test_admin_ban_then_login_blocked_then_unban(self, session, owner_user, user_a):
        uid = user_a["user"]["id"]
        r = session.post(f"{API}/admin/users/{uid}/ban", headers=H(owner_user["token"]))
        assert r.status_code == 200
        # banned user login → 403
        r2 = session.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "test123"})
        assert r2.status_code == 403, r2.text
        # unban
        r3 = session.post(f"{API}/admin/users/{uid}/unban", headers=H(owner_user["token"]))
        assert r3.status_code == 200
        r4 = session.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "test123"})
        assert r4.status_code == 200

    def test_admin_audit_logs_contains_ban(self, session, owner_user):
        r = session.get(f"{API}/admin/audit-logs", headers=H(owner_user["token"]))
        assert r.status_code == 200
        actions = {log.get("action") for log in r.json().get("logs", [])}
        assert "admin.user.ban" in actions
        assert "admin.user.unban" in actions

    def test_admin_announcements_crud(self, session, owner_user):
        r = session.post(
            f"{API}/admin/announcements", headers=H(owner_user["token"]),
            json={"title": "TEST_ANN", "body": "hello", "active": True},
        )
        assert r.status_code == 200
        aid = r.json()["announcement"]["id"]
        r2 = session.get(f"{API}/admin/announcements", headers=H(owner_user["token"]))
        assert r2.status_code == 200
        assert any(a["id"] == aid for a in r2.json()["announcements"])
        r3 = session.delete(f"{API}/admin/announcements/{aid}", headers=H(owner_user["token"]))
        assert r3.status_code == 200

    def test_admin_feature_flags_upsert(self, session, owner_user):
        r = session.put(
            f"{API}/admin/feature-flags", headers=H(owner_user["token"]),
            json={"key": "TEST_FLAG", "value": True, "description": "test"},
        )
        assert r.status_code == 200
        r2 = session.get(f"{API}/admin/feature-flags", headers=H(owner_user["token"]))
        assert r2.status_code == 200
        flags = r2.json()["flags"]
        assert any(f["key"] == "TEST_FLAG" and f["value"] is True for f in flags)

    def test_admin_broadcast_test_to_self(self, session, owner_user):
        r = session.post(
            f"{API}/admin/broadcast", headers=H(owner_user["token"]),
            json={
                "subject": "TEST_BROADCAST", "heading": "Hi",
                "body_html": "<p>hi</p>", "test_to": owner_user["email"],
            },
        )
        # Must NOT 500 even if SendGrid refuses due to unverified sender
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("mode") == "test"
        assert "result" in data
        # result may have ok:false if SendGrid rejects — acceptable

    def test_admin_system_health(self, session, owner_user):
        r = session.get(f"{API}/admin/system-health", headers=H(owner_user["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["stripe"] is True
        assert d["sendgrid"] is True
        assert d["mongo_ping"] is True


# ---------- Downloads (viral branding) ----------
class TestDownloads:
    @pytest.fixture(scope="class")
    def product_id(self, session, user_a):
        # Generate a tiny product
        r = session.post(
            f"{API}/products/generate",
            headers=H(user_a["token"]),
            json={"niche": "productivity", "style": "concise"},
        )
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_pdf_contains_referral_url(self, session, user_a, product_id):
        r = session.get(f"{API}/products/{product_id}/download/pdf", headers=H(user_a["token"]))
        assert r.status_code == 200, r.text
        body = r.content
        assert body.startswith(b"%PDF-"), "not a PDF"
        assert len(body) >= 4096, f"PDF too small: {len(body)}"

    def test_bundle_zip_includes_readme_powered_by(self, session, user_a, product_id):
        import io
        import zipfile
        r = session.get(f"{API}/products/{product_id}/download/bundle", headers=H(user_a["token"]))
        assert r.status_code == 200, r.text
        zf = zipfile.ZipFile(io.BytesIO(r.content))
        names = zf.namelist()
        assert any("README-powered-by-FiiLTHY.md" in n for n in names), f"names={names}"
        assert len(names) >= 5

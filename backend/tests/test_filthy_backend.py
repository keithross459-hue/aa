"""
FiiLTHY.AI backend regression suite.

Covers: auth, settings (CRUD + merge + redaction + test endpoint),
product generate, downloads (PDF / bundle ZIP / library ZIP),
campaign generation, launch (NOT_CONFIGURED path), stats, listings, stores.
"""
import io
import os
import time
import uuid
import zipfile
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

# Ensure REACT_APP_BACKEND_URL is loaded from frontend/.env
load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = f"test_filthy_{uuid.uuid4().hex[:8]}@filthy.ai"
PASSWORD = "test123"
NAME = "Test User"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{API}/auth/signup", json={"email": EMAIL, "password": PASSWORD, "name": NAME}, timeout=20)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    token = data["token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    return {"token": token, "user": data["user"]}


# ---------- Auth ----------
class TestAuth:
    def test_login(self, session, auth):
        r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == EMAIL
        assert isinstance(body["token"], str) and len(body["token"]) > 20

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me(self, session, auth):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == EMAIL
        assert u["plan"] == "free"
        assert u["plan_limit"] == 5


# ---------- Settings ----------
class TestSettings:
    def test_get_initial_settings(self, session, auth):
        r = session.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        body = r.json()
        providers = body["providers"]
        # 13 providers
        assert len(providers) == 13
        for pid, info in providers.items():
            assert info["configured"] is False
            assert info["fields"] == {}

    def test_save_gumroad_only_then_partial_update(self, session, auth):
        # Save gumroad
        r = session.put(f"{API}/settings", json={"providers": {"gumroad": {"access_token": "GR_SECRET_123456"}}}, timeout=15)
        assert r.status_code == 200
        providers = r.json()["providers"]
        assert providers["gumroad"]["configured"] is True
        # Secret redacted
        token_redacted = providers["gumroad"]["fields"]["access_token"]
        assert "GR_SECRET_123456" != token_redacted
        assert "••••" in token_redacted or len(token_redacted) <= 20

        # Save meta with mixed plain + secret
        r = session.put(f"{API}/settings", json={"providers": {"meta": {
            "access_token": "META_TOKEN_ABCDEFG",
            "ad_account_id": "act_1234567",
            "pixel_id": "555000111",
            "page_id": "777888"
        }}}, timeout=15)
        assert r.status_code == 200
        providers = r.json()["providers"]
        # Gumroad must remain configured (merging works)
        assert providers["gumroad"]["configured"] is True
        # ad_account_id is plain — must come back as-is
        assert providers["meta"]["fields"]["ad_account_id"] == "act_1234567"
        assert providers["meta"]["fields"]["pixel_id"] == "555000111"
        assert providers["meta"]["fields"]["page_id"] == "777888"
        # access_token should be redacted (not equal to plain)
        assert providers["meta"]["fields"]["access_token"] != "META_TOKEN_ABCDEFG"

    def test_clear_field_via_empty_string(self, session, auth):
        # Clear meta.pixel_id only
        r = session.put(f"{API}/settings", json={"providers": {"meta": {"pixel_id": ""}}}, timeout=15)
        assert r.status_code == 200
        meta_fields = r.json()["providers"]["meta"]["fields"]
        assert "pixel_id" not in meta_fields, f"pixel_id should be cleared, got {meta_fields}"
        # Other meta fields preserved
        assert meta_fields.get("ad_account_id") == "act_1234567"
        assert "access_token" in meta_fields

    def test_test_provider_unconfigured(self, session, auth):
        # stripe not configured
        r = session.post(f"{API}/settings/test/stripe", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False
        assert body.get("error") == "not_configured"

    def test_test_provider_gumroad_bad_creds(self, session, auth):
        r = session.post(f"{API}/settings/test/gumroad", timeout=20)
        assert r.status_code == 200
        body = r.json()
        # Bad token saved earlier => should NOT crash
        assert body["ok"] is False
        assert "error" in body

    def test_test_provider_meta_bad_creds(self, session, auth):
        r = session.post(f"{API}/settings/test/meta", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False
        assert "error" in body

    def test_test_provider_other_returns_ok(self, session, auth):
        # Save tiktok creds
        session.put(f"{API}/settings", json={"providers": {"tiktok": {"access_token": "tt_token", "advertiser_id": "adv_1"}}}, timeout=15)
        r = session.post(f"{API}/settings/test/tiktok", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True

    def test_delete_provider(self, session, auth):
        # Configure stripe then delete
        session.put(f"{API}/settings", json={"providers": {"stripe": {"secret_key": "sk_test_xxx_dummy"}}}, timeout=15)
        r = session.delete(f"{API}/settings/stripe", timeout=15)
        assert r.status_code == 200
        providers = r.json()["providers"]
        assert providers["stripe"]["configured"] is False
        assert providers["stripe"]["fields"] == {}
        # gumroad still configured (single-field, untouched)
        assert providers["gumroad"]["configured"] is True
        # meta still has access_token + ad_account_id + page_id (pixel cleared earlier)
        assert "access_token" in providers["meta"]["fields"]
        assert providers["meta"]["fields"].get("ad_account_id") == "act_1234567"

    def test_delete_unknown_provider(self, session, auth):
        r = session.delete(f"{API}/settings/not_a_provider", timeout=15)
        # Endpoint accepts only known providers
        assert r.status_code == 400


# ---------- Stores ----------
class TestStores:
    def test_list_stores(self, session, auth):
        r = session.get(f"{API}/stores", timeout=15)
        assert r.status_code == 200
        stores = r.json()["stores"]
        assert len(stores) == 7
        real_count = sum(1 for s in stores if s.get("real"))
        assert real_count == 4
        # Check expected real stores
        real_ids = {s["id"] for s in stores if s["real"]}
        assert real_ids == {"gumroad", "stan_store", "whop", "payhip"}


# ---------- Product generation + downloads ----------
@pytest.fixture(scope="module")
def product(session, auth):
    r = session.post(
        f"{API}/products/generate",
        json={"niche": "AI side hustles for beginners", "audience": "creators", "product_type": "ebook"},
        timeout=120,
    )
    assert r.status_code == 200, f"generate failed: {r.status_code} {r.text[:300]}"
    p = r.json()
    assert p["title"]
    assert p["description"]
    assert isinstance(p["price"], (int, float))
    assert isinstance(p["bullet_features"], list) and len(p["bullet_features"]) >= 1
    assert isinstance(p["outline"], list) and len(p["outline"]) >= 1
    assert p["sales_copy"]
    return p


class TestProducts:
    def test_list_products(self, session, auth, product):
        r = session.get(f"{API}/products", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert any(p["id"] == product["id"] for p in rows)

    def test_get_product(self, session, auth, product):
        r = session.get(f"{API}/products/{product['id']}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == product["id"]

    def test_get_unknown_product_404(self, session, auth):
        r = session.get(f"{API}/products/does-not-exist", timeout=15)
        assert r.status_code == 404


class TestDownloads:
    def test_pdf_download(self, session, auth, product):
        r = session.get(f"{API}/products/{product['id']}/download/pdf", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and ".pdf" in cd.lower()
        body = r.content
        assert len(body) > 1000
        assert body[:5] == b"%PDF-"

    def test_bundle_zip(self, session, auth, product):
        r = session.get(f"{API}/products/{product['id']}/download/bundle", timeout=30)
        assert r.status_code == 200
        body = r.content
        assert body[:4] == b"PK\x03\x04"
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            names = set(z.namelist())
        expected = {"product.pdf", "product.md", "ad_campaigns.md", "tiktok_posts.md", "sales_copy.txt"}
        assert expected.issubset(names), f"missing: {expected - names}"

    def test_library_zip(self, session, auth, product):
        r = session.get(f"{API}/products/download/all", timeout=60)
        assert r.status_code == 200
        body = r.content
        assert body[:4] == b"PK\x03\x04"
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            names = z.namelist()
        # Folder per product
        assert any(n.endswith("/product.pdf") for n in names)


# ---------- Campaigns ----------
class TestCampaigns:
    def test_generate_campaign(self, session, auth, product):
        r = session.post(f"{API}/campaigns/generate", json={"product_id": product["id"]}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        camp = r.json()
        assert camp["product_id"] == product["id"]
        assert isinstance(camp["variants"], list)
        # 5 platforms expected
        platforms = {v["platform"] for v in camp["variants"]}
        assert len(platforms) >= 3
        assert isinstance(camp["daily_budget_suggestion"], (int, float))


# ---------- Launch (NOT_CONFIGURED path) ----------
class TestLaunch:
    @pytest.fixture(scope="class")
    def fresh_user(self):
        # New user with no store creds at all
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"TEST_launch_{uuid.uuid4().hex[:8]}@filthy.ai"
        r = s.post(f"{API}/auth/signup", json={"email": email, "password": "test123", "name": "Launch"}, timeout=15)
        assert r.status_code == 200
        s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
        # Generate a product
        rp = s.post(f"{API}/products/generate", json={"niche": "Notion templates for ADHD"}, timeout=120)
        assert rp.status_code == 200
        return {"session": s, "product": rp.json()}

    def test_download_all_returns_404_when_empty(self):
        # New user with NO products
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"TEST_empty_{uuid.uuid4().hex[:8]}@filthy.ai"
        r = s.post(f"{API}/auth/signup", json={"email": email, "password": "test123", "name": "Empty"}, timeout=15)
        assert r.status_code == 200
        s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
        r = s.get(f"{API}/products/download/all", timeout=20)
        assert r.status_code == 404

    def test_launch_unconfigured_real_stores(self, fresh_user):
        s = fresh_user["session"]
        pid = fresh_user["product"]["id"]
        r = s.post(f"{API}/launch", json={"product_id": pid}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        listings = r.json()["listings"]
        by_id = {lst["store_id"]: lst for lst in listings}
        # 4 real stores -> NOT_CONFIGURED w/ error & friendly url
        for sid in ("gumroad", "stan_store", "whop", "payhip"):
            assert sid in by_id, f"missing listing for {sid}"
            assert by_id[sid]["status"] == "NOT_CONFIGURED", f"{sid} status={by_id[sid]['status']}"
            assert by_id[sid]["error"]
            assert "Settings" in by_id[sid]["error"]
            assert by_id[sid]["listing_url"].startswith("http")
            assert by_id[sid]["real"] is False
        # Other 3 simulated
        for sid in ("etsy_digital", "stripe_link", "shopify_digital"):
            assert sid in by_id
            assert by_id[sid]["status"] == "SIMULATED"

    def test_listings_after_launch(self, fresh_user):
        s = fresh_user["session"]
        r = s.get(f"{API}/listings", timeout=15)
        assert r.status_code == 200
        rows = r.json()["listings"]
        statuses = {r["status"] for r in rows}
        assert "NOT_CONFIGURED" in statuses
        assert "SIMULATED" in statuses


# ---------- Stats ----------
class TestStats:
    def test_stats_includes_integration_counts(self, session, auth):
        r = session.get(f"{API}/stats", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "integrations_configured" in body
        assert "integrations_total" in body
        assert body["integrations_total"] == 13
        # gumroad + tiktok fully configured (meta missing pixel_id from earlier clear test)
        assert body["integrations_configured"] >= 2

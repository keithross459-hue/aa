"""
FiiLTHY.AI backend tests:
- auth (signup/login/me)
- products generate/list/get
- campaigns generate/list (+ filter)
- stores
- launch (real-only store publishing)
- listings list (+ filter)
- stats
- usage limit (free plan caps at 5 generations -> 6th -> 403 LIMIT_REACHED)
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

ROOT_DIR = os.environ.get("APP_ROOT")
if ROOT_DIR:
    ROOT_DIR = os.path.abspath(ROOT_DIR)
else:
    ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

load_dotenv(os.path.join(ROOT_DIR, "backend", ".env"))

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Read from frontend .env
    with open(os.path.join(ROOT_DIR, "frontend", ".env")) as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1].rstrip("/")
                break

API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TS = int(time.time())
EMAIL = f"test_{TS}@filthy.ai"
PWD = "testpass123"
NAME = "Tester"

state = {}


# ---- helpers ----
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---- root ----
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    j = r.json()
    assert j.get("app") == "FiiLTHY.AI"
    assert j.get("status") == "live"


# ---- auth ----
def test_signup():
    r = requests.post(f"{API}/auth/signup", json={"email": EMAIL, "password": PWD, "name": NAME})
    assert r.status_code == 200, r.text
    j = r.json()
    assert "token" in j and j["token"]
    u = j["user"]
    assert u["email"] == EMAIL.lower()
    assert u["plan"] == "free"
    assert u["generations_used"] == 0
    assert u["plan_limit"] == 5
    state["token"] = j["token"]
    state["user_id"] = u["id"]


def test_signup_duplicate():
    r = requests.post(f"{API}/auth/signup", json={"email": EMAIL, "password": PWD, "name": NAME})
    assert r.status_code == 400


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": "wrongpw"})
    assert r.status_code == 401


def test_login_valid():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PWD})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == EMAIL.lower()


def test_me():
    r = requests.get(f"{API}/auth/me", headers=auth_headers(state["token"]))
    assert r.status_code == 200
    assert r.json()["id"] == state["user_id"]


def test_me_no_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---- stores ----
def test_stores():
    r = requests.get(f"{API}/stores")
    assert r.status_code == 200
    stores = r.json()["stores"]
    assert len(stores) == 4
    ids = {s["id"] for s in stores}
    assert ids == {"gumroad", "stan_store", "whop", "payhip"}


# ---- product generate (slow LLM call) ----
def test_generate_product():
    r = requests.post(
        f"{API}/products/generate",
        headers=auth_headers(state["token"]),
        json={"niche": "AI productivity for indie hackers", "product_type": "ebook"},
        timeout=120,
    )
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["title"] and len(p["title"]) > 0
    assert p["tagline"]
    assert p["description"]
    assert p["target_audience"]
    assert isinstance(p["price"], (int, float))
    assert isinstance(p["bullet_features"], list) and len(p["bullet_features"]) >= 3
    assert isinstance(p["outline"], list) and len(p["outline"]) >= 5
    assert p["sales_copy"]
    assert p["cover_concept"]
    state["product_id"] = p["id"]

    # generations_used incremented
    me = requests.get(f"{API}/auth/me", headers=auth_headers(state["token"])).json()
    assert me["generations_used"] == 1


def test_list_products():
    r = requests.get(f"{API}/products", headers=auth_headers(state["token"]))
    assert r.status_code == 200
    rows = r.json()
    assert any(p["id"] == state["product_id"] for p in rows)


def test_get_product():
    r = requests.get(f"{API}/products/{state['product_id']}", headers=auth_headers(state["token"]))
    assert r.status_code == 200
    assert r.json()["id"] == state["product_id"]


def test_get_product_404():
    r = requests.get(f"{API}/products/non-existent-id", headers=auth_headers(state["token"]))
    assert r.status_code == 404


# ---- campaign generate (slow LLM call) ----
def test_generate_campaign():
    r = requests.post(
        f"{API}/campaigns/generate",
        headers=auth_headers(state["token"]),
        json={"product_id": state["product_id"]},
        timeout=180,
    )
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["product_id"] == state["product_id"]
    assert c["angle"]
    assert isinstance(c["daily_budget_suggestion"], (int, float))
    assert len(c["variants"]) == 5
    platforms = {v["platform"] for v in c["variants"]}
    expected = {"TikTok Ads", "Meta Ads", "YouTube Ads", "Twitter Ads", "Pinterest Ads"}
    assert platforms == expected, f"Got platforms: {platforms}"
    for v in c["variants"]:
        assert v["hook"] and v["script"] and v["cta"]
        assert isinstance(v["hashtags"], list)
        assert v["targeting"]
    state["campaign_id"] = c["id"]

    # product.campaigns_count incremented + user.generations_used now 2
    p = requests.get(f"{API}/products/{state['product_id']}", headers=auth_headers(state["token"])).json()
    assert p["campaigns_count"] == 1
    me = requests.get(f"{API}/auth/me", headers=auth_headers(state["token"])).json()
    assert me["generations_used"] == 2


def test_list_campaigns():
    r = requests.get(f"{API}/campaigns", headers=auth_headers(state["token"]))
    assert r.status_code == 200
    assert any(c["id"] == state["campaign_id"] for c in r.json())


def test_list_campaigns_filter():
    r = requests.get(
        f"{API}/campaigns",
        headers=auth_headers(state["token"]),
        params={"product_id": state["product_id"]},
    )
    assert r.status_code == 200
    rows = r.json()
    assert all(c["product_id"] == state["product_id"] for c in rows)
    assert len(rows) >= 1


# ---- launch ----
def test_launch_gumroad_only_real():
    """Launch only to gumroad — must be REAL: status=LIVE, real=true, gumroad.com URL."""
    r = requests.post(
        f"{API}/launch",
        headers=auth_headers(state["token"]),
        json={"product_id": state["product_id"], "stores": ["gumroad"]},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert len(j["listings"]) == 1
    g = j["listings"][0]
    assert g["store_id"] == "gumroad"
    assert g["status"] == "LIVE", f"Expected LIVE, got {g['status']} err={g.get('error')}"
    assert g["real"] is True
    assert g["error"] is None
    assert g["listing_url"].startswith("https://"), g["listing_url"]
    assert "gumroad.com" in g["listing_url"], g["listing_url"]
    assert "fiilthy.ai" not in g["listing_url"]
    state["gumroad_url"] = g["listing_url"]


def test_launch_all_stores_mixed():
    """Launch to real store integrations only."""
    r = requests.post(
        f"{API}/launch",
        headers=auth_headers(state["token"]),
        json={"product_id": state["product_id"]},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["product_id"] == state["product_id"]
    assert len(j["listings"]) == 4
    by_id = {l["store_id"]: l for l in j["listings"]}

    g = by_id["gumroad"]
    assert g["status"] == "LIVE"
    assert g["real"] is True
    assert "gumroad.com" in g["listing_url"]

    for sid in ["stan_store", "whop", "payhip"]:
        l = by_id[sid]
        assert l["status"] in ("NOT_CONFIGURED", "FAILED", "LIVE"), f"{sid}: {l['status']}"
        if l["status"] != "LIVE":
            assert l["real"] is False

    # product.launched_stores includes only real LIVE publishes
    p = requests.get(f"{API}/products/{state['product_id']}", headers=auth_headers(state["token"])).json()
    assert all(s in {"gumroad", "stan_store", "whop", "payhip"} for s in p["launched_stores"])


def test_listings():
    r = requests.get(f"{API}/listings", headers=auth_headers(state["token"]))
    assert r.status_code == 200
    assert len(r.json()["listings"]) >= 4


def test_listings_filter():
    r = requests.get(
        f"{API}/listings",
        headers=auth_headers(state["token"]),
        params={"product_id": state["product_id"]},
    )
    assert r.status_code == 200
    rows = r.json()["listings"]
    assert all(l["product_id"] == state["product_id"] for l in rows)


# ---- stats ----
def test_stats():
    r = requests.get(f"{API}/stats", headers=auth_headers(state["token"]))
    assert r.status_code == 200
    j = r.json()
    assert j["products"] >= 1
    assert j["campaigns"] >= 1
    assert j["listings"] >= 8
    assert j["plan"] == "free"
    assert j["plan_limit"] == 5
    assert j["generations_used"] == 2


# ---- usage limit (uses a separate user with generations_used pre-set to 5) ----
def test_usage_limit_reached():
    """Create a fresh user, bump generations_used to 5 directly in DB, then 6th call should 403."""
    email2 = f"test_limit_{TS}@filthy.ai"
    r = requests.post(f"{API}/auth/signup", json={"email": email2, "password": PWD, "name": "LimitUser"})
    assert r.status_code == 200
    token2 = r.json()["token"]
    uid2 = r.json()["user"]["id"]

    # Bump to limit via direct DB write (avoid 5 slow LLM calls)
    mc = MongoClient(MONGO_URL)
    mc[DB_NAME].users.update_one({"id": uid2}, {"$set": {"generations_used": 5}})
    mc.close()

    # Verify
    me = requests.get(f"{API}/auth/me", headers=auth_headers(token2)).json()
    assert me["generations_used"] == 5
    assert me["plan_limit"] == 5

    # 6th call should fail
    r = requests.post(
        f"{API}/products/generate",
        headers=auth_headers(token2),
        json={"niche": "test", "product_type": "ebook"},
    )
    assert r.status_code == 403, r.text
    detail = r.json().get("detail", {})
    assert detail.get("code") == "LIMIT_REACHED"
    state["limit_user_id"] = uid2


# ---- billing (Stripe Checkout via emergentintegrations) ----
def test_billing_create_checkout_no_auth():
    r = requests.post(
        f"{API}/billing/create-checkout",
        json={"plan": "starter", "origin_url": "https://example.com"},
    )
    assert r.status_code == 401


def test_billing_create_checkout_invalid_plan():
    r = requests.post(
        f"{API}/billing/create-checkout",
        headers=auth_headers(state["token"]),
        json={"plan": "totally_fake_plan", "origin_url": "https://example.com"},
    )
    # Pydantic Literal validation -> 422; or backend 400. Either is acceptable rejection.
    assert r.status_code in (400, 422), r.text


def test_billing_create_checkout_starter():
    r = requests.post(
        f"{API}/billing/create-checkout",
        headers=auth_headers(state["token"]),
        json={"plan": "starter", "origin_url": "https://stackdigitz-preview.preview.emergentagent.com"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert "url" in j and j["url"].startswith("https://checkout.stripe.com"), j
    assert "session_id" in j and j["session_id"]
    state["session_id"] = j["session_id"]

    # payment_transactions row was created
    mc = MongoClient(MONGO_URL)
    tx = mc[DB_NAME].payment_transactions.find_one({"session_id": j["session_id"]})
    mc.close()
    assert tx is not None, "payment_transactions row missing"
    assert tx["user_id"] == state["user_id"]
    assert tx["plan"] == "starter"
    assert tx["amount"] == 29.00
    assert tx["currency"] == "usd"
    assert tx["status"] == "initiated"
    assert tx["payment_status"] == "pending"


def test_billing_status_requires_auth():
    r = requests.get(f"{API}/billing/status/{state['session_id']}")
    assert r.status_code == 401


def test_billing_status_ownership():
    """Another user must not be able to see this user's session."""
    email3 = f"test_other_{TS}@filthy.ai"
    r = requests.post(f"{API}/auth/signup", json={"email": email3, "password": PWD, "name": "Other"})
    assert r.status_code == 200
    other_token = r.json()["token"]
    state["other_user_id"] = r.json()["user"]["id"]
    r2 = requests.get(
        f"{API}/billing/status/{state['session_id']}",
        headers=auth_headers(other_token),
    )
    assert r2.status_code == 404


def test_billing_status_owner_ok():
    r = requests.get(
        f"{API}/billing/status/{state['session_id']}",
        headers=auth_headers(state["token"]),
        timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert "status" in j
    assert "payment_status" in j
    assert j["plan"] == "starter"
    # In Stripe checkout, session is "open" + payment_status "unpaid" until paid
    assert j["payment_status"] in ("unpaid", "paid", "no_payment_required")


def test_billing_create_checkout_pro():
    r = requests.post(
        f"{API}/billing/create-checkout",
        headers=auth_headers(state["token"]),
        json={"plan": "pro", "origin_url": "https://example.com"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["url"].startswith("https://checkout.stripe.com")
    mc = MongoClient(MONGO_URL)
    tx = mc[DB_NAME].payment_transactions.find_one({"session_id": j["session_id"]})
    mc.close()
    assert tx and tx["amount"] == 79.00 and tx["plan"] == "pro"


# ---- cleanup ----
def test_cleanup():
    """Remove TEST_-prefixed test data created."""
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    if state.get("user_id"):
        db.users.delete_one({"id": state["user_id"]})
        db.products.delete_many({"user_id": state["user_id"]})
        db.campaigns.delete_many({"user_id": state["user_id"]})
        db.listings.delete_many({"user_id": state["user_id"]})
    if state.get("limit_user_id"):
        db.users.delete_one({"id": state["limit_user_id"]})
    if state.get("other_user_id"):
        db.users.delete_one({"id": state["other_user_id"]})
    # Clean payment_transactions for this user
    if state.get("user_id"):
        db.payment_transactions.delete_many({"user_id": state["user_id"]})
    mc.close()

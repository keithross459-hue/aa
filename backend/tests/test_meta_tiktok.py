"""
FiiLTHY.AI - Iteration 3 new feature tests:
- GET /api/meta/export/{product_id}
- POST /api/tiktok/generate/{product_id}
- GET /api/tiktok/export/{product_id}
- /api/launch auto-gen TikTok posts
- Usage limit enforcement on tiktok/generate
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

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open(os.path.join(ROOT_DIR, "frontend", ".env")) as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1]
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TS = int(time.time())
EMAIL = f"test_mt_{TS}@filthy.ai"
PWD = "testpass123"

state = {}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---- Setup user + product (no campaign to save LLM calls) ----
def test_01_signup():
    r = requests.post(f"{API}/auth/signup", json={"email": EMAIL, "password": PWD, "name": "MT Tester"})
    assert r.status_code == 200, r.text
    state["token"] = r.json()["token"]
    state["user_id"] = r.json()["user"]["id"]


def test_02_generate_product():
    r = requests.post(
        f"{API}/products/generate",
        headers=auth_headers(state["token"]),
        json={"niche": "side hustle blueprints", "product_type": "ebook"},
        timeout=120,
    )
    assert r.status_code == 200, r.text
    state["product_id"] = r.json()["id"]


# ---- /api/meta/export/{product_id} ----
def test_03_meta_export_no_auth():
    r = requests.get(f"{API}/meta/export/{state['product_id']}")
    assert r.status_code == 401


def test_04_meta_export_not_found():
    r = requests.get(f"{API}/meta/export/does-not-exist", headers=auth_headers(state["token"]))
    assert r.status_code == 404


def test_05_meta_export_ok():
    r = requests.get(f"{API}/meta/export/{state['product_id']}", headers=auth_headers(state["token"]))
    assert r.status_code == 200, r.text
    j = r.json()
    # campaign
    assert "campaign" in j
    assert "name" in j["campaign"]
    assert j["campaign"]["objective"] == "Sales"
    # targeting
    assert "targeting" in j
    assert j["targeting"]["locations"] == ["US", "CA"]
    assert j["targeting"]["type"] == "broad"
    assert "optimization" in j["targeting"]
    # creatives - 3 items, first recommended
    assert isinstance(j["creatives"], list) and len(j["creatives"]) == 3
    for c in j["creatives"]:
        assert "headline" in c and c["headline"]
        assert "primary_text" in c and c["primary_text"]
        assert "image_url" in c and c["image_url"]
        assert "recommended" in c
    assert j["creatives"][0]["recommended"] is True
    assert j["creatives"][1]["recommended"] is False
    assert j["creatives"][2]["recommended"] is False
    # product_url + ads_manager_url
    assert "product_url" in j
    assert "adsmanager.facebook.com" in j["ads_manager_url"]


def test_06_meta_export_ownership():
    """Another user must get 404, not see product."""
    email_o = f"test_mt_o_{TS}@filthy.ai"
    r = requests.post(f"{API}/auth/signup", json={"email": email_o, "password": PWD, "name": "Other"})
    assert r.status_code == 200
    other_token = r.json()["token"]
    state["other_user_id"] = r.json()["user"]["id"]
    r2 = requests.get(
        f"{API}/meta/export/{state['product_id']}",
        headers=auth_headers(other_token),
    )
    assert r2.status_code == 404


# ---- /api/tiktok/export BEFORE any generation - should be empty ----
def test_07_tiktok_export_empty_before_gen():
    r = requests.get(
        f"{API}/tiktok/export/{state['product_id']}",
        headers=auth_headers(state["token"]),
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["product_title"]
    assert "product_url" in j
    assert j["posts"] == []
    assert j["count"] == 0


# ---- /api/launch does not create simulated TikTok posts ----
def test_08_launch_auto_generates_tiktok():
    """Launch with only stan_store should not create a simulated listing."""
    # capture current usage before launch
    me_before = requests.get(f"{API}/auth/me", headers=auth_headers(state["token"])).json()
    state["gen_used_before_launch"] = me_before["generations_used"]

    r = requests.post(
        f"{API}/launch",
        headers=auth_headers(state["token"]),
        json={"product_id": state["product_id"], "stores": ["stan_store"]},
        timeout=120,
    )
    assert r.status_code == 200, r.text
    listings = r.json()["listings"]
    assert len(listings) == 1
    assert listings[0]["store_id"] == "stan_store"
    assert listings[0]["status"] in ("NOT_CONFIGURED", "FAILED", "LIVE")
    state["stan_launch_live"] = listings[0]["status"] == "LIVE" and listings[0].get("real") is True

    # Usage should NOT have incremented from launch auto-gen
    me_after = requests.get(f"{API}/auth/me", headers=auth_headers(state["token"])).json()
    assert me_after["generations_used"] == state["gen_used_before_launch"], (
        f"Launch auto-gen must NOT increment usage: before={state['gen_used_before_launch']}, after={me_after['generations_used']}"
    )


def test_09_tiktok_export_after_launch_has_5_posts():
    """/api/launch only auto-generates TikTok posts after a real live publish."""
    r = requests.get(
        f"{API}/tiktok/export/{state['product_id']}",
        headers=auth_headers(state["token"]),
    )
    assert r.status_code == 200, r.text
    j = r.json()
    expected = 5 if state.get("stan_launch_live") else 0
    assert j["count"] == expected, f"Expected {expected} auto-generated posts, got {j['count']}"
    assert len(j["posts"]) == expected
    for p in j["posts"]:
        assert p.get("id")
        assert p.get("hook")
        assert p.get("script")
        assert p.get("caption")
        assert isinstance(p.get("hashtags"), list)
        assert 8 <= len(p["hashtags"]) <= 15, f"hashtags len={len(p['hashtags'])}"
        assert p.get("visual_idea")
        assert p.get("created_at")


# ---- /api/tiktok/generate - auth + 404 + success + replace behavior ----
def test_10_tiktok_generate_no_auth():
    r = requests.post(f"{API}/tiktok/generate/{state['product_id']}")
    assert r.status_code == 401


def test_11_tiktok_generate_404():
    r = requests.post(
        f"{API}/tiktok/generate/does-not-exist",
        headers=auth_headers(state["token"]),
    )
    assert r.status_code == 404


def test_12_tiktok_generate_success_increments_usage():
    me_before = requests.get(f"{API}/auth/me", headers=auth_headers(state["token"])).json()
    used_before = me_before["generations_used"]

    r = requests.post(
        f"{API}/tiktok/generate/{state['product_id']}",
        headers=auth_headers(state["token"]),
        timeout=120,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["count"] == 5
    assert len(j["posts"]) == 5
    for p in j["posts"]:
        assert p.get("id")
        assert p.get("hook")
        assert p.get("script")
        assert p.get("caption")
        assert isinstance(p["hashtags"], list)
        assert 8 <= len(p["hashtags"]) <= 15
        assert p.get("visual_idea")
        assert p.get("created_at")

    me_after = requests.get(f"{API}/auth/me", headers=auth_headers(state["token"])).json()
    assert me_after["generations_used"] == used_before + 1, (
        f"Manual tiktok/generate must increment usage: before={used_before}, after={me_after['generations_used']}"
    )


def test_13_tiktok_generate_replaces_not_duplicates():
    """Calling generate twice should result in count=5, not 10."""
    # Bump user plan to pro via direct DB to avoid hitting limit on a 2nd generate call
    mc = MongoClient(MONGO_URL)
    mc[DB_NAME].users.update_one({"id": state["user_id"]}, {"$set": {"plan": "pro"}})
    mc.close()

    r = requests.post(
        f"{API}/tiktok/generate/{state['product_id']}",
        headers=auth_headers(state["token"]),
        timeout=120,
    )
    assert r.status_code == 200, r.text
    assert r.json()["count"] == 5

    # Export should still show exactly 5
    r2 = requests.get(
        f"{API}/tiktok/export/{state['product_id']}",
        headers=auth_headers(state["token"]),
    )
    assert r2.status_code == 200
    j = r2.json()
    assert j["count"] == 5, f"After second generate, export count must be 5 (replace), got {j['count']}"

    # DB-level check
    mc = MongoClient(MONGO_URL)
    cnt = mc[DB_NAME].tiktok_posts.count_documents({
        "product_id": state["product_id"], "user_id": state["user_id"]
    })
    mc.close()
    assert cnt == 5, f"DB has {cnt} tiktok_posts, expected 5"


# ---- Usage limit on tiktok/generate ----
def test_14_tiktok_generate_limit_reached():
    """Fresh user capped at free plan limit=5; bump usage to 5 directly; 6th call must 403."""
    email_l = f"test_mt_l_{TS}@filthy.ai"
    r = requests.post(f"{API}/auth/signup", json={"email": email_l, "password": PWD, "name": "Limit"})
    assert r.status_code == 200
    token_l = r.json()["token"]
    uid_l = r.json()["user"]["id"]
    state["limit_user_id"] = uid_l

    # Generate a product first (costs 1 gen), then bump usage to 5
    r = requests.post(
        f"{API}/products/generate",
        headers=auth_headers(token_l),
        json={"niche": "simple test", "product_type": "ebook"},
        timeout=120,
    )
    assert r.status_code == 200
    pid_l = r.json()["id"]

    mc = MongoClient(MONGO_URL)
    mc[DB_NAME].users.update_one({"id": uid_l}, {"$set": {"generations_used": 5}})
    mc.close()

    r = requests.post(
        f"{API}/tiktok/generate/{pid_l}",
        headers=auth_headers(token_l),
    )
    assert r.status_code == 403, r.text
    detail = r.json().get("detail", {})
    assert detail.get("code") == "LIMIT_REACHED", detail


# ---- Regression: /api/meta/export ownership check ----
def test_15_tiktok_export_ownership():
    """Other user sees 404 for someone else's product."""
    # reuse other_user_id from test_06
    assert state.get("other_user_id")
    # login as other user - actually the token was lost. Re-signup another one quickly.
    email_o2 = f"test_mt_o2_{TS}@filthy.ai"
    r = requests.post(f"{API}/auth/signup", json={"email": email_o2, "password": PWD, "name": "Other2"})
    assert r.status_code == 200
    other_token = r.json()["token"]
    state["other_user_id_2"] = r.json()["user"]["id"]
    r2 = requests.post(
        f"{API}/tiktok/generate/{state['product_id']}",
        headers=auth_headers(other_token),
    )
    assert r2.status_code == 404


# ---- Cleanup ----
def test_99_cleanup():
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    for uid_key in ("user_id", "other_user_id", "other_user_id_2", "limit_user_id"):
        uid = state.get(uid_key)
        if uid:
            db.users.delete_one({"id": uid})
            db.products.delete_many({"user_id": uid})
            db.campaigns.delete_many({"user_id": uid})
            db.listings.delete_many({"user_id": uid})
            db.tiktok_posts.delete_many({"user_id": uid})
            db.meta_launches.delete_many({"user_id": uid})
    mc.close()

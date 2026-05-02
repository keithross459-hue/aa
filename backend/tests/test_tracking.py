"""
FiiLTHY.AI iter4 tracking + analytics + winner detection tests.
Seeds products/listings directly in MongoDB to avoid burning LLM budget.
Covers:
- POST /api/track/click (auth required, ownership 404)
- POST /api/track/sale (auth required, ownership 404, increments revenue+sales_count, recomputes winners)
- GET  /api/track/go (PUBLIC, 302 with UTMs, 400 invalid source, 404 unknown product)
- GET  /api/analytics/{product_id} (auth, totals, performance, winners, rules)
- Winner rule #1 (conversion >= 2% with >=20 clicks)
- Winner rule #2 (revenue >= $50)
- Non-winner case
- /api/tiktok/export and /api/meta/export now return content_id + tracking_url
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs
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
BACKEND_URL_ENV = os.environ.get("BACKEND_URL", "")

TS = int(time.time())
EMAIL_A = f"test_trk_a_{TS}@filthy.ai"
EMAIL_B = f"test_trk_b_{TS}@filthy.ai"
PWD = "testpass123"

state = {}


def H(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _seed_product(uid: str, title: str = "Test Tracking Product"):
    """Insert a product row directly to skip LLM."""
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    pid = str(uuid.uuid4())
    db.products.insert_one({
        "id": pid,
        "user_id": uid,
        "title": title,
        "tagline": "Tag",
        "description": "Desc",
        "target_audience": "creators",
        "price": 19.0,
        "product_type": "ebook",
        "bullet_features": ["a", "b", "c"],
        "outline": ["x", "y", "z"],
        "sales_copy": "buy",
        "cover_concept": "neon",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "campaigns_count": 0,
        "launched_stores": [],
    })
    # Seed a real-flag gumroad listing so /track/go has a destination
    db.listings.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "product_id": pid,
        "store_id": "gumroad",
        "store_name": "Gumroad",
        "listing_url": "https://gumroad.com/l/abc123?ref=existing",
        "status": "LIVE",
        "listing_title": title,
        "listing_description": "Desc",
        "launched_at": datetime.now(timezone.utc).isoformat(),
        "real": True,
        "error": None,
    })
    mc.close()
    return pid


# -------------- setup users --------------
def test_00_setup_users():
    r = requests.post(f"{API}/auth/signup", json={"email": EMAIL_A, "password": PWD, "name": "A"})
    assert r.status_code == 200, r.text
    state["token_a"] = r.json()["token"]
    state["uid_a"] = r.json()["user"]["id"]
    r = requests.post(f"{API}/auth/signup", json={"email": EMAIL_B, "password": PWD, "name": "B"})
    assert r.status_code == 200, r.text
    state["token_b"] = r.json()["token"]
    state["uid_b"] = r.json()["user"]["id"]
    state["pid"] = _seed_product(state["uid_a"], "FiiLTHY Tracking Test")


# -------------- /track/click --------------
def test_01_track_click_no_auth():
    r = requests.post(f"{API}/track/click", json={"product_id": state["pid"], "source": "tiktok", "content_id": "x"})
    assert r.status_code == 401


def test_02_track_click_owner_ok():
    r = requests.post(
        f"{API}/track/click",
        headers=H(state["token_a"]),
        json={"product_id": state["pid"], "source": "tiktok", "content_id": "tiktok_post_1"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True


def test_03_track_click_not_owner_404():
    r = requests.post(
        f"{API}/track/click",
        headers=H(state["token_b"]),
        json={"product_id": state["pid"], "source": "tiktok", "content_id": "x"},
    )
    assert r.status_code == 404


def test_04_track_click_invalid_source_422():
    r = requests.post(
        f"{API}/track/click",
        headers=H(state["token_a"]),
        json={"product_id": state["pid"], "source": "facebook", "content_id": "x"},
    )
    assert r.status_code == 422  # Pydantic Literal rejection


# -------------- /track/sale --------------
def test_05_track_sale_owner_ok_increments_revenue():
    r = requests.post(
        f"{API}/track/sale",
        headers=H(state["token_a"]),
        json={"product_id": state["pid"], "source": "meta", "content_id": "meta_ad_2", "value": 55.0},
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["ok"] is True
    assert isinstance(j.get("winners"), list)
    # Winner rule #2 — single $55 sale should mark this content as winner
    assert "meta:meta_ad_2" in j["winners"]

    # Verify product doc stamped with revenue/sales_count/winners
    p = requests.get(f"{API}/products/{state['pid']}", headers=H(state["token_a"])).json()
    # revenue/sales_count are not in Product model — fetch raw via mongo
    mc = MongoClient(MONGO_URL)
    raw = mc[DB_NAME].products.find_one({"id": state["pid"]})
    mc.close()
    assert raw.get("revenue") == 55.0, raw.get("revenue")
    assert raw.get("sales_count") == 1, raw.get("sales_count")
    assert "meta:meta_ad_2" in raw.get("winners", [])


def test_06_track_sale_not_owner_404():
    r = requests.post(
        f"{API}/track/sale",
        headers=H(state["token_b"]),
        json={"product_id": state["pid"], "source": "meta", "content_id": "x", "value": 10.0},
    )
    assert r.status_code == 404


# -------------- /track/go (PUBLIC redirect) --------------
def test_07_track_go_public_302_with_utms():
    # No auth header
    r = requests.get(
        f"{API}/track/go",
        params={"product_id": state["pid"], "source": "tiktok", "content_id": "tiktok_post_3"},
        allow_redirects=False,
    )
    assert r.status_code == 302, r.text
    loc = r.headers.get("Location", "")
    assert loc, "missing Location header"
    parsed = urlparse(loc)
    qs = parse_qs(parsed.query)
    assert qs.get("utm_source") == ["tiktok"]
    assert qs.get("utm_campaign") == [state["pid"]]
    assert qs.get("utm_content") == ["tiktok_post_3"]
    # Existing query string preserved
    assert qs.get("ref") == ["existing"]
    assert "gumroad.com" in loc


def test_08_track_go_invalid_source_400():
    r = requests.get(
        f"{API}/track/go",
        params={"product_id": state["pid"], "source": "youtube", "content_id": "x"},
        allow_redirects=False,
    )
    assert r.status_code == 400


def test_09_track_go_unknown_product_404():
    r = requests.get(
        f"{API}/track/go",
        params={"product_id": "does-not-exist", "source": "tiktok", "content_id": "x"},
        allow_redirects=False,
    )
    assert r.status_code == 404


# -------------- winner rules: build event volumes --------------
def test_10_winner_rule_conversion():
    """20 clicks + 1 sale @ $19 on tiktok_post_1 => winner via conversion (1/20=5% >= 2%)."""
    # We already have 1 click on tiktok_post_1 from test_02. Add 19 more to reach 20.
    for _ in range(19):
        r = requests.post(
            f"{API}/track/click",
            headers=H(state["token_a"]),
            json={"product_id": state["pid"], "source": "tiktok", "content_id": "tiktok_post_1"},
        )
        assert r.status_code == 200
    # Track 1 sale @ $19
    r = requests.post(
        f"{API}/track/sale",
        headers=H(state["token_a"]),
        json={"product_id": state["pid"], "source": "tiktok", "content_id": "tiktok_post_1", "value": 19.0},
    )
    assert r.status_code == 200, r.text
    winners = r.json()["winners"]
    assert "tiktok:tiktok_post_1" in winners
    assert "meta:meta_ad_2" in winners  # still there from before


def test_11_non_winner_meta_ad_1():
    """5 clicks 0 sales on meta_ad_1 => not winner."""
    for _ in range(5):
        r = requests.post(
            f"{API}/track/click",
            headers=H(state["token_a"]),
            json={"product_id": state["pid"], "source": "meta", "content_id": "meta_ad_1"},
        )
        assert r.status_code == 200


# -------------- /analytics --------------
def test_12_analytics_no_auth():
    r = requests.get(f"{API}/analytics/{state['pid']}")
    assert r.status_code == 401


def test_13_analytics_not_owner_404():
    r = requests.get(f"{API}/analytics/{state['pid']}", headers=H(state["token_b"]))
    assert r.status_code == 404


def test_14_analytics_full_payload():
    r = requests.get(f"{API}/analytics/{state['pid']}", headers=H(state["token_a"]))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["product_id"] == state["pid"]
    assert j["product_title"] == "FiiLTHY Tracking Test"
    # totals
    t = j["totals"]
    # 20 tiktok_post_1 + 5 meta_ad_1 + 1 tiktok_post_3 (from test_07 /track/go) = 26 clicks
    assert t["clicks"] == 26, t
    assert t["sales"] == 2, t
    assert abs(t["revenue"] - 74.0) < 0.01
    assert t["conversion_rate"] == round(2 / 26, 4)
    # rules
    assert j["rules"] == {"min_clicks": 20, "min_conversion": 0.02, "min_revenue": 50}
    # performance rows
    by = {(p["source"], p["content_id"]): p for p in j["performance"]}
    tt1 = by[("tiktok", "tiktok_post_1")]
    assert tt1["clicks"] == 20 and tt1["sales"] == 1
    assert tt1["is_winner"] is True
    assert abs(tt1["conversion_rate"] - 0.05) < 0.001
    ma2 = by[("meta", "meta_ad_2")]
    assert ma2["clicks"] == 0 and ma2["sales"] == 1 and ma2["revenue"] == 55.0
    assert ma2["is_winner"] is True
    ma1 = by[("meta", "meta_ad_1")]
    assert ma1["clicks"] == 5 and ma1["sales"] == 0
    assert ma1["is_winner"] is False
    # winners list
    assert "tiktok:tiktok_post_1" in j["winners"]
    assert "meta:meta_ad_2" in j["winners"]
    assert "meta:meta_ad_1" not in j["winners"]


# -------------- exports include content_id + tracking_url --------------
def test_15_meta_export_has_content_id_and_tracking_url():
    r = requests.get(f"{API}/meta/export/{state['pid']}", headers=H(state["token_a"]))
    assert r.status_code == 200, r.text
    j = r.json()
    creatives = j["creatives"]
    assert len(creatives) == 3
    for i, c in enumerate(creatives, start=1):
        assert c["content_id"] == f"meta_ad_{i}"
        assert "tracking_url" in c and c["tracking_url"]
        # When BACKEND_URL is set, tracking_url should hit /api/track/go
        if BACKEND_URL_ENV:
            assert "/api/track/go" in c["tracking_url"]
            assert f"product_id={state['pid']}" in c["tracking_url"]
            assert "source=meta" in c["tracking_url"]
            assert f"content_id=meta_ad_{i}" in c["tracking_url"]
    # First creative is recommended
    assert creatives[0]["recommended"] is True
    assert creatives[1]["recommended"] is False


def test_16_tiktok_export_has_content_id_and_tracking_url():
    # Insert 5 fake tiktok posts directly to skip LLM
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    db.tiktok_posts.delete_many({"product_id": state["pid"]})
    now = datetime.now(timezone.utc).isoformat()
    db.tiktok_posts.insert_many([
        {
            "id": str(uuid.uuid4()),
            "user_id": state["uid_a"],
            "product_id": state["pid"],
            "hook": f"hook {i}",
            "script": f"script {i}",
            "caption": f"cap {i}",
            "hashtags": ["a"] * 8,
            "visual_idea": "neon",
            "created_at": now,
        } for i in range(5)
    ])
    mc.close()

    r = requests.get(f"{API}/tiktok/export/{state['pid']}", headers=H(state["token_a"]))
    assert r.status_code == 200, r.text
    j = r.json()
    posts = j["posts"]
    assert len(posts) == 5
    seen = set()
    for idx, p in enumerate(posts, start=1):
        # Posts are sorted by created_at desc — content_id is positional based on iteration order
        assert p["content_id"].startswith("tiktok_post_")
        seen.add(p["content_id"])
        assert "tracking_url" in p and p["tracking_url"]
        if BACKEND_URL_ENV:
            assert "/api/track/go" in p["tracking_url"]
            assert "source=tiktok" in p["tracking_url"]
            assert f"product_id={state['pid']}" in p["tracking_url"]
    assert seen == {f"tiktok_post_{i}" for i in range(1, 6)}


# -------------- regression: /track/go records click event --------------
def test_17_track_go_records_click_in_db():
    # Hit the public redirect once for a fresh content_id
    r = requests.get(
        f"{API}/track/go",
        params={"product_id": state["pid"], "source": "tiktok", "content_id": "regress_check"},
        allow_redirects=False,
    )
    assert r.status_code == 302
    # Verify analytics now shows this row
    a = requests.get(f"{API}/analytics/{state['pid']}", headers=H(state["token_a"])).json()
    by = {(p["source"], p["content_id"]): p for p in a["performance"]}
    assert ("tiktok", "regress_check") in by
    assert by[("tiktok", "regress_check")]["clicks"] >= 1


# -------------- cleanup --------------
def test_99_cleanup():
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    for uid in (state.get("uid_a"), state.get("uid_b")):
        if not uid:
            continue
        db.users.delete_one({"id": uid})
        db.products.delete_many({"user_id": uid})
        db.campaigns.delete_many({"user_id": uid})
        db.listings.delete_many({"user_id": uid})
        db.tiktok_posts.delete_many({"user_id": uid})
        db.tracking_events.delete_many({"user_id": uid})
        db.payment_transactions.delete_many({"user_id": uid})
    mc.close()

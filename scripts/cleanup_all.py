#!/usr/bin/env python3
"""
Clean out ALL data: products, campaigns, stores, analytics, transactions, etc.
WARNING: This is destructive. Use with caution.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB", "filthy")

COLLECTIONS_TO_WIPE = [
    "products",
    "campaigns",
    "listings",
    "tiktok_posts",
    "tiktok_posts_rejected",
    "analytics_events",
    "analytics_sessions",
    "payment_transactions",
    "product_unlocks",
    "referral_attributions",
    "referral_commissions",
    "user_integrations",
    "store_configs",
    "gumroad_products",
    "payhip_products",
    "stan_products",
    "whop_products",
    "meta_ads_campaigns",
    "tiktok_oauth_tokens",
]


async def cleanup_all():
    """Wipe all data collections."""
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    print(f"🚨 Connecting to {DB_NAME} at {MONGO_URI}")
    print(f"⚠️  About to DELETE all data from {len(COLLECTIONS_TO_WIPE)} collections:")
    for col in COLLECTIONS_TO_WIPE:
        print(f"   - {col}")
    
    confirm = input("\nType 'DELETE_ALL' to confirm: ")
    if confirm != "DELETE_ALL":
        print("❌ Cancelled.")
        return
    
    for collection_name in COLLECTIONS_TO_WIPE:
        try:
            result = await db[collection_name].delete_many({})
            print(f"✅ {collection_name}: deleted {result.deleted_count} documents")
        except Exception as e:
            print(f"❌ {collection_name}: {e}")
    
    print("\n🧹 Cleanup complete!")
    client.close()


if __name__ == "__main__":
    asyncio.run(cleanup_all())

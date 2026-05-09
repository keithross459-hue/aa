#!/usr/bin/env python3
"""
Cleanup script: Remove all dummy/test data from MongoDB.
Keeps production users and their real data intact.
Removes: test users, their products, campaigns, listings, analytics, payments, etc.
"""
import asyncio
import os
from db import db

# Test email patterns to identify dummy data
TEST_PATTERNS = ["test_", "@filthy.ai", "testpass"]
OWNER_EMAIL = (os.environ.get("OWNER_EMAIL", "") or "").lower()


async def cleanup_dummy_data():
    """Remove all test/dummy data from the database."""
    
    print("🧹 Starting FiiLTHY dummy data cleanup...")
    print(f"   Owner email (protected): {OWNER_EMAIL or 'NOT SET'}\n")
    
    # Find all test users
    test_users = await db.users.find({"email": {"$regex": "test_|@filthy.ai"}}, {"_id": 0, "id": 1, "email": 1}).to_list(10000)
    test_user_ids = [u["id"] for u in test_users if u["email"].lower() != OWNER_EMAIL]
    
    if not test_user_ids:
        print("✅ No dummy users found. Database is clean!")
        return
    
    print(f"Found {len(test_user_ids)} test user accounts:")
    for u in test_users:
        if u["id"] in test_user_ids:
            print(f"   - {u['email']} (ID: {u['id']})")
    print()
    
    # Count items to be deleted
    products = await db.products.count_documents({"user_id": {"$in": test_user_ids}})
    campaigns = await db.campaigns.count_documents({"user_id": {"$in": test_user_ids}})
    listings = await db.listings.count_documents({"user_id": {"$in": test_user_ids}})
    clicks = await db.clicks.count_documents({"user_id": {"$in": test_user_ids}})
    sales = await db.sales.count_documents({"user_id": {"$in": test_user_ids}})
    unlocks = await db.product_unlocks.count_documents({"user_id": {"$in": test_user_ids}})
    transactions = await db.payment_transactions.count_documents({"user_id": {"$in": test_user_ids}})
    
    print("📊 Dummy data breakdown:")
    print(f"   - Products: {products}")
    print(f"   - Campaigns: {campaigns}")
    print(f"   - Listings: {listings}")
    print(f"   - Clicks tracked: {clicks}")
    print(f"   - Sales tracked: {sales}")
    print(f"   - Product unlocks: {unlocks}")
    print(f"   - Payment transactions: {transactions}")
    print(f"   - User accounts: {len(test_user_ids)}\n")
    
    # Confirm before deletion
    total = products + campaigns + listings + clicks + sales + unlocks + transactions + len(test_user_ids)
    response = input(f"⚠️  Delete {total} items? Type 'yes' to confirm: ").strip().lower()
    
    if response != "yes":
        print("❌ Cleanup cancelled.")
        return
    
    print("\n🗑️  Deleting dummy data...\n")
    
    # Delete in order (respect foreign keys)
    await db.clicks.delete_many({"user_id": {"$in": test_user_ids}})
    print(f"✅ Deleted {clicks} click records")
    
    await db.sales.delete_many({"user_id": {"$in": test_user_ids}})
    print(f"✅ Deleted {sales} sale records")
    
    await db.product_unlocks.delete_many({"user_id": {"$in": test_user_ids}})
    print(f"✅ Deleted {unlocks} product unlock records")
    
    await db.payment_transactions.delete_many({"user_id": {"$in": test_user_ids}})
    print(f"✅ Deleted {transactions} payment transaction records")
    
    await db.listings.delete_many({"user_id": {"$in": test_user_ids}})
    print(f"✅ Deleted {listings} listings")
    
    await db.campaigns.delete_many({"user_id": {"$in": test_user_ids}})
    print(f"✅ Deleted {campaigns} campaigns")
    
    # Delete tiktok posts, analytics, tracking data for test users/products
    test_product_ids = {p["id"] async for p in db.products.find({"user_id": {"$in": test_user_ids}}, {"_id": 0, "id": 1})}
    
    await db.tiktok_posts.delete_many({"user_id": {"$in": test_user_ids}})
    await db.analytics.delete_many({"user_id": {"$in": test_user_ids}})
    await db.audit.delete_many({"user_id": {"$in": test_user_ids}})
    
    await db.products.delete_many({"user_id": {"$in": test_user_ids}})
    print(f"✅ Deleted {products} products")
    
    # Delete users
    await db.users.delete_many({"id": {"$in": test_user_ids}})
    print(f"✅ Deleted {len(test_user_ids)} test user accounts\n")
    
    print("✨ Dummy data cleanup complete!")


if __name__ == "__main__":
    asyncio.run(cleanup_dummy_data())

"""Dummy data cleanup endpoint for admin panel."""


class CleanupConfirmReq:
    """Confirmation request to clean up dummy data."""
    confirm: bool = False


async def cleanup_dummy_data_handler(admin=Depends(current_admin)):
    """
    Admin endpoint: DELETE all dummy/test data from the database.
    Test users = those with emails matching "test_" or "@filthy.ai"
    Keeps production users and owner email intact.
    """
    import os
    
    OWNER_EMAIL = (os.environ.get("OWNER_EMAIL", "") or "").lower()
    
    # Find all test users
    test_users = await db.users.find(
        {"email": {"$regex": "test_|@filthy.ai"}},
        {"_id": 0, "id": 1, "email": 1}
    ).to_list(10000)
    
    test_user_ids = [u["id"] for u in test_users if u["email"].lower() != OWNER_EMAIL]
    
    if not test_user_ids:
        return {"ok": True, "message": "No dummy users found.", "deleted": 0}
    
    # Delete in reverse dependency order
    await db.clicks.delete_many({"user_id": {"$in": test_user_ids}})
    await db.sales.delete_many({"user_id": {"$in": test_user_ids}})
    await db.product_unlocks.delete_many({"user_id": {"$in": test_user_ids}})
    await db.payment_transactions.delete_many({"user_id": {"$in": test_user_ids}})
    await db.listings.delete_many({"user_id": {"$in": test_user_ids}})
    await db.campaigns.delete_many({"user_id": {"$in": test_user_ids}})
    await db.tiktok_posts.delete_many({"user_id": {"$in": test_user_ids}})
    await db.analytics.delete_many({"user_id": {"$in": test_user_ids}})
    await db.audit.delete_many({"user_id": {"$in": test_user_ids}})
    
    products_deleted = await db.products.delete_many({"user_id": {"$in": test_user_ids}})
    users_deleted = await db.users.delete_many({"id": {"$in": test_user_ids}})
    
    total_deleted = users_deleted.deleted_count + products_deleted.deleted_count
    
    # Log this cleanup action
    await log_event({
        "action": "cleanup_dummy_data",
        "admin_id": admin["id"],
        "admin_email": admin["email"],
        "dummy_users_removed": users_deleted.deleted_count,
        "products_removed": products_deleted.deleted_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "ok": True,
        "message": f"Cleaned up {total_deleted} dummy data items",
        "users_deleted": users_deleted.deleted_count,
        "test_users": [u["email"] for u in test_users if u["id"] in test_user_ids],
    }


# Add this endpoint to the router in admin.py:
# @router.post("/cleanup-dummy-data")
# async def cleanup(admin=Depends(current_admin)):
#     return await cleanup_dummy_data_handler(admin)

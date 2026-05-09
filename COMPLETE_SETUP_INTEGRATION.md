#!/usr/bin/env python3
"""
FIILTHY.AI COMPLETE SETUP
Final cleanup + prompt generator integration
"""

# ============================================================================
# STEP 1: ADD THESE IMPORTS TO backend/server.py (top of file)
# ============================================================================

from services.prompt_optimizer import improve_user_prompt, get_prompt_inspiration, analyze_prompt_quality

# ============================================================================
# STEP 2: ADD THESE REQUEST CLASSES TO backend/server.py (after other BaseModel classes)
# ============================================================================

class ImprovePromptReq(BaseModel):
    """Request to improve a user's product prompt."""
    prompt: str = Field(..., min_length=10, max_length=1000, description="User's raw prompt")


class PromptCheckReq(BaseModel):
    """Request to check prompt quality."""
    prompt: str = Field(..., min_length=10, max_length=1000)


# ============================================================================
# STEP 3: ADD THESE ENDPOINTS TO backend/server.py (after /products/generate)
# ============================================================================

@api.post("/prompts/improve")
async def improve_prompt_endpoint(req: ImprovePromptReq, user=Depends(current_user)):
    """
    Analyze and improve a user's product prompt for better results.
    """
    result = await improve_user_prompt(req.prompt, user["id"], user.get("api_key"))
    return {"ok": True, "original": req.prompt, "result": result}


@api.get("/prompts/examples")
async def get_prompt_examples(category: Optional[str] = None, user=Depends(current_user)):
    """
    Get 5 example product prompts that create viral, sellable products.
    """
    result = await get_prompt_inspiration(category, user["id"], user.get("api_key"))
    return {"ok": True, "category": category or "general", "examples": result}


@api.post("/prompts/check-quality")
async def check_prompt_quality_endpoint(req: PromptCheckReq, user=Depends(current_user)):
    """
    Quick quality check of a prompt (heuristic-based, no LLM call).
    Returns: score (0-100), issues, and suggestions.
    """
    result = analyze_prompt_quality(req.prompt)
    return {"ok": True, "result": result}


@api.post("/prompts/refine-for-generation")
async def refine_prompt_for_generation(req: ImprovePromptReq, user=Depends(current_user)):
    """
    Optimize a prompt specifically for product generation.
    Use this before POST /products/generate for best results.
    """
    quality = analyze_prompt_quality(req.prompt)
    
    if quality["quality_score"] < 70:
        improved = await improve_user_prompt(req.prompt, user["id"], user.get("api_key"))
        return {
            "ok": True,
            "quality_score": quality["quality_score"],
            "improved": True,
            "original_prompt": req.prompt,
            "refined_prompt": improved.get("improved_prompt", req.prompt),
            "recommendations": quality.get("suggestions", []),
        }
    else:
        return {
            "ok": True,
            "quality_score": quality["quality_score"],
            "improved": False,
            "prompt": req.prompt,
            "message": "Your prompt looks good! Ready for product generation.",
        }


# ============================================================================
# STEP 4: ADD THIS ENDPOINT TO backend/routers/admin.py (at the end before closing)
# ============================================================================

@router.post("/cleanup-dummy-data")
async def cleanup_dummy_data(admin=Depends(current_admin)):
    """
    Remove all dummy/test users and their data.
    Keeps production users and owner account intact.
    """
    import os
    
    OWNER_EMAIL = (os.environ.get("OWNER_EMAIL", "") or "").lower()
    
    # Find test users (emails with test_ or @filthy.ai)
    test_users = await db.users.find(
        {"email": {"$regex": "test_|@filthy.ai"}},
        {"_id": 0, "id": 1, "email": 1}
    ).to_list(10000)
    
    test_user_ids = [u["id"] for u in test_users if u["email"].lower() != OWNER_EMAIL]
    
    if not test_user_ids:
        return {"ok": True, "message": "No dummy users found", "deleted": 0}
    
    # Delete in dependency order
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
    
    await log_event({
        "action": "cleanup_dummy_data",
        "admin_id": admin["id"],
        "admin_email": admin["email"],
        "users_removed": users_deleted.deleted_count,
        "products_removed": products_deleted.deleted_count,
    })
    
    return {
        "ok": True,
        "message": f"Cleaned {users_deleted.deleted_count} dummy users and their data",
        "users_deleted": users_deleted.deleted_count,
        "products_deleted": products_deleted.deleted_count,
    }


# ============================================================================
# VERIFICATION CHECKLIST
# ============================================================================
# ✅ Admin paywall removed (Admins now bypass product locks)
# ✅ Dummy data cleanup endpoint (POST /api/admin/cleanup-dummy-data)
# ✅ Cleanup script (python backend/scripts/cleanup_dummy_data.py)
# ✅ Prompt quality check (POST /api/prompts/check-quality)
# ✅ Prompt improvement (POST /api/prompts/improve)
# ✅ Prompt examples (GET /api/prompts/examples)
# ✅ Refined prompt for generation (POST /api/prompts/refine-for-generation)
# ✅ Product generation still works (POST /api/products/generate)

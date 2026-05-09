"""New prompt optimizer endpoints to add to server.py"""

# Add these imports at the top of server.py:
from services.prompt_optimizer import improve_user_prompt, get_prompt_inspiration, analyze_prompt_quality


# Add these endpoint definitions after @api.post("/products/generate"):

class ImprovePromptReq(BaseModel):
    """Request to improve a user's product prompt."""
    prompt: str = Field(..., min_length=10, max_length=1000, description="User's raw prompt")
    category: Optional[str] = None


class PromptCheckReq(BaseModel):
    """Request to check prompt quality."""
    prompt: str = Field(..., min_length=10, max_length=1000)


@api.post("/prompts/improve")
async def improve_prompt_endpoint(req: ImprovePromptReq, user=Depends(current_user)):
    """
    Analyze and improve a user's product prompt.
    Returns: improved prompt, issues found, and tips.
    """
    result = await improve_user_prompt(req.prompt, user["id"], user.get("api_key"))
    return {
        "ok": True,
        "original": req.prompt,
        "result": result
    }


@api.get("/prompts/examples")
async def get_prompt_examples(category: Optional[str] = None, user=Depends(current_user)):
    """
    Get 5 example product prompts that lead to viral, sellable products.
    Optional: filter by category (business, wellness, education, etc.)
    """
    result = await get_prompt_inspiration(category, user["id"], user.get("api_key"))
    return {
        "ok": True,
        "category": category or "general",
        "examples": result
    }


@api.post("/prompts/check-quality")
async def check_prompt_quality_endpoint(req: PromptCheckReq, user=Depends(current_user)):
    """
    Quick quality check of a prompt (no LLM call).
    Returns: score (0-100), issues, and suggestions.
    """
    result = analyze_prompt_quality(req.prompt)
    return {
        "ok": True,
        "result": result
    }


@api.post("/prompts/refine-for-product-gen")
async def refine_prompt_for_generation(req: ImprovePromptReq, user=Depends(current_user)):
    """
    Optimize a prompt specifically for the product generation endpoint.
    Use this before calling POST /products/generate for better results.
    """
    quality = analyze_prompt_quality(req.prompt)
    
    if quality["quality_score"] < 70:
        # Use LLM to improve it
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

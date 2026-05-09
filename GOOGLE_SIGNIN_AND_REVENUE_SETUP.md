"""
Integration guide for Google Sign-In and Revenue Sharing
Add these to backend/server.py
"""

# ============================================================================
# STEP 1: ADD THESE IMPORTS TO server.py (top of file, after other imports)
# ============================================================================

from services.google_oauth import (
    GoogleOAuthConfig, verify_google_token, get_google_user_info,
    get_google_oauth_url, exchange_google_code
)
from services.revenue_sharing import (
    RevenueSharing, record_product_sale_with_commission, get_creator_earnings
)


# ============================================================================
# STEP 2: ADD THESE REQUEST/RESPONSE CLASSES (after existing BaseModel classes)
# ============================================================================

class GoogleSignInReq(BaseModel):
    """Google Sign-In request with ID token."""
    id_token: str
    name: Optional[str] = None


class GoogleCallbackReq(BaseModel):
    """Google OAuth callback with authorization code."""
    code: str
    state: Optional[str] = None


class CommissionSummaryResp(BaseModel):
    """Commission earnings response."""
    user_id: str
    total_commission_earned: float
    total_pending: float
    total_paid: float
    pending_count: int
    paid_count: int


# ============================================================================
# STEP 3: ADD THESE ENDPOINTS TO server.py (after /auth/login)
# ============================================================================

@api.get("/auth/google-config")
async def get_google_config():
    """
    Get Google OAuth configuration for frontend.
    Frontend uses this to initialize Google Sign-In button.
    """
    return {
        "configured": GoogleOAuthConfig.is_configured(),
        "client_id": GoogleOAuthConfig.CLIENT_ID if GoogleOAuthConfig.is_configured() else None,
        "auth_url": get_google_oauth_url(),
    }


@api.post("/auth/google/signin")
async def google_signin(req: GoogleSignInReq):
    """
    Sign in with Google ID token (from frontend Sign-In button).
    
    Frontend flow:
    1. User clicks "Sign in with Google"
    2. Google returns id_token
    3. Frontend sends id_token to this endpoint
    4. Backend verifies token and creates/returns user
    """
    # Verify the token with Google
    user_info = await verify_google_token(req.id_token)
    if not user_info:
        raise HTTPException(401, "Invalid Google token")
    
    email = user_info["email"]
    
    # Check if user exists
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing:
        # Existing user — return token
        token = make_token(existing["id"])
        return {
            "ok": True,
            "user": _user_out(existing),
            "token": token,
            "method": "google_signin",
        }
    
    # New user — create account
    from datetime import datetime, timezone
    import secrets
    
    user_id = secrets.token_urlsafe(16)
    user_doc = {
        "id": user_id,
        "email": email,
        "name": user_info.get("name", email.split("@")[0]),
        "picture": user_info.get("picture", ""),
        "password": "",  # No password for OAuth users
        "role": "user",
        "plan": "free",
        "subscription_status": "none",
        "stripe_customer_id": None,
        "generations_used": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "oauth_provider": "google",
        "oauth_verified": user_info.get("email_verified", False),
    }
    
    await db.users.insert_one(user_doc)
    
    # Send welcome email
    try:
        await email_service.send_welcome(email, user_doc.get("name", email))
    except Exception as e:
        print(f"Welcome email failed: {e}")
    
    token = make_token(user_id)
    return {
        "ok": True,
        "user": _user_out(user_doc),
        "token": token,
        "method": "google_signin_new",
        "message": "Welcome! Your account has been created.",
    }


@api.get("/auth/google/authorize")
async def google_authorize_url(state: Optional[str] = None):
    """
    Get Google OAuth authorization URL for server-side flow.
    
    Use this if you want server-side OAuth (less common for SPA).
    Returns URL to redirect user to Google.
    """
    if not GoogleOAuthConfig.is_configured():
        raise HTTPException(503, "Google OAuth not configured")
    
    return {"auth_url": get_google_oauth_url(state)}


@api.post("/auth/google/callback")
async def google_callback(req: GoogleCallbackReq):
    """
    Google OAuth callback handler (server-side flow).
    
    Frontend redirects here after user authorizes on Google.
    Exchange code for tokens and create/return user.
    """
    if not GoogleOAuthConfig.is_configured():
        raise HTTPException(503, "Google OAuth not configured")
    
    # Exchange code for tokens
    tokens = await exchange_google_code(req.code)
    if not tokens:
        raise HTTPException(401, "Failed to exchange authorization code")
    
    # Get user info
    user_info = await get_google_user_info(tokens["access_token"])
    if not user_info:
        raise HTTPException(401, "Failed to retrieve user info from Google")
    
    email = user_info["email"]
    
    # Check if user exists
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing:
        token = make_token(existing["id"])
        return {
            "ok": True,
            "user": _user_out(existing),
            "token": token,
        }
    
    # Create new user
    from datetime import datetime, timezone
    import secrets
    
    user_id = secrets.token_urlsafe(16)
    user_doc = {
        "id": user_id,
        "email": email,
        "name": user_info.get("name", email.split("@")[0]),
        "picture": user_info.get("picture", ""),
        "password": "",
        "role": "user",
        "plan": "free",
        "subscription_status": "none",
        "stripe_customer_id": None,
        "generations_used": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "oauth_provider": "google",
    }
    
    await db.users.insert_one(user_doc)
    
    token = make_token(user_id)
    return {
        "ok": True,
        "user": _user_out(user_doc),
        "token": token,
    }


# ============================================================================
# COMMISSION / REVENUE ENDPOINTS (after /billing endpoints)
# ============================================================================

@api.get("/commissions/summary")
async def get_commission_summary(user=Depends(current_user)):
    """
    Get creator's commission earnings summary.
    Shows total earned, pending, paid, and transaction counts.
    """
    summary = await RevenueSharing.get_user_commission_summary(user["id"])
    
    return {
        "ok": True,
        "commissions": summary,
    }


@api.get("/commissions/history")
async def get_commission_history(
    status: Optional[str] = None,
    limit: int = 100,
    user=Depends(current_user),
):
    """
    Get detailed commission history for a creator.
    
    Args:
        status: Filter by "pending", "paid", or "failed"
        limit: Max records (default 100)
    """
    commissions = await RevenueSharing.get_user_commissions(
        user["id"],
        status=status,
        limit=limit,
    )
    
    return {
        "ok": True,
        "commissions": commissions,
        "count": len(commissions),
    }


@api.get("/admin/revenue")
async def admin_revenue_summary(admin=Depends(current_admin)):
    """
    ADMIN ONLY: Get platform-wide revenue summary.
    Shows total commissions earned, creator payouts, etc.
    """
    summary = await RevenueSharing.get_platform_revenue_summary()
    
    return {
        "ok": True,
        "platform_revenue": summary,
        "commission_rate_percent": 10,  # Or fetch from config
    }


# ============================================================================
# STEP 4: UPDATE PRODUCT UNLOCK ENDPOINT
# In the product unlock webhook handler (around line 492 in billing.py):
# After the unlock is marked as paid, add:
# ============================================================================

# Inside the checkout_status webhook handler, after payment is confirmed:
await record_product_sale_with_commission(
    user_id=tx.get("user_id"),
    product_id=tx.get("product_id"),
    sale_amount_usd=float(tx.get("amount", 0)),
    transaction_id=session_id,
)


# ============================================================================
# ENVIRONMENT VARIABLES TO SET
# ============================================================================

# Google OAuth (required for Sign-In with Google)
# GOOGLE_OAUTH_CLIENT_ID=xxxxxx.apps.googleusercontent.com
# GOOGLE_OAUTH_CLIENT_SECRET=xxxxxx_xxxxxx_xxxxxx
# GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/auth/google/callback

# Revenue Sharing (optional)
# PLATFORM_COMMISSION_PERCENT=10  # Default 10% commission

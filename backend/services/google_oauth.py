"""
Google OAuth 2.0 service for FiiLTHY.AI
Supports Sign-In with Google and JWT token generation.
"""
import os
import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timezone


class GoogleOAuthConfig:
    """Google OAuth configuration."""
    
    CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
    REDIRECT_URI = os.environ.get("GOOGLE_OAUTH_REDIRECT_URI", "https://app.fiilthy.ai/auth/google/callback")
    
    @classmethod
    def is_configured(cls) -> bool:
        """Check if Google OAuth is properly configured."""
        return bool(cls.CLIENT_ID and cls.CLIENT_SECRET)


async def verify_google_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify a Google ID token and extract user info.
    
    Args:
        token: Google ID token from frontend
        
    Returns:
        Dict with email, name, picture, or None if invalid
    """
    if not GoogleOAuthConfig.is_configured():
        return None
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token},
                timeout=10,
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            # Verify token is for our app
            if data.get("aud") != GoogleOAuthConfig.CLIENT_ID:
                return None
            
            # Extract user info
            return {
                "email": data.get("email", "").lower(),
                "name": data.get("name", ""),
                "picture": data.get("picture", ""),
                "email_verified": data.get("email_verified", False),
                "provider": "google",
            }
    except Exception as e:
        print(f"Google token verification failed: {e}")
        return None


async def get_google_user_info(access_token: str) -> Optional[Dict[str, Any]]:
    """
    Get user info from Google using access token.
    
    Args:
        access_token: Google OAuth access token
        
    Returns:
        User info dict or None if request fails
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            return {
                "email": data.get("email", "").lower(),
                "name": data.get("name", ""),
                "picture": data.get("picture", ""),
                "email_verified": data.get("verified_email", False),
                "provider": "google",
            }
    except Exception as e:
        print(f"Google user info fetch failed: {e}")
        return None


def get_google_oauth_url(state: str = "") -> str:
    """
    Generate Google OAuth authorization URL.
    
    Args:
        state: Optional state parameter for CSRF protection
        
    Returns:
        Full authorization URL for redirecting to Google
    """
    from urllib.parse import urlencode
    
    if not GoogleOAuthConfig.is_configured():
        return ""
    
    params = {
        "client_id": GoogleOAuthConfig.CLIENT_ID,
        "redirect_uri": GoogleOAuthConfig.REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
    }
    
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


async def exchange_google_code(code: str) -> Optional[Dict[str, str]]:
    """
    Exchange authorization code for access token.
    
    Args:
        code: Authorization code from Google
        
    Returns:
        Dict with access_token, id_token, refresh_token, or None if failed
    """
    if not GoogleOAuthConfig.is_configured():
        return None
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GoogleOAuthConfig.CLIENT_ID,
                    "client_secret": GoogleOAuthConfig.CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": GoogleOAuthConfig.REDIRECT_URI,
                },
                timeout=10,
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            return {
                "access_token": data.get("access_token", ""),
                "id_token": data.get("id_token", ""),
                "refresh_token": data.get("refresh_token", ""),
                "expires_in": data.get("expires_in", 3600),
            }
    except Exception as e:
        print(f"Google code exchange failed: {e}")
        return None

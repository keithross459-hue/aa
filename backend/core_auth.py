"""Auth helpers — JWT + bcrypt + FastAPI dependency."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt as pyjwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import db

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.environ.get("JWT_ISSUER", "fiilthy.ai")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "fiilthy-app")
JWT_PREVIOUS_SECRETS = [
    s.strip() for s in os.environ.get("JWT_PREVIOUS_SECRETS", "").split(",") if s.strip()
]
OWNER_EMAIL = (os.environ.get("OWNER_EMAIL", "") or "").lower()

bearer = HTTPBearer(auto_error=False)


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _decode_token(token: str):
    last_error = None
    for secret in [JWT_SECRET, *JWT_PREVIOUS_SECRETS]:
        try:
            return pyjwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience=JWT_AUDIENCE,
                issuer=JWT_ISSUER,
            )
        except pyjwt.InvalidAudienceError:
            # Backward compatibility for tokens minted before aud/iss existed.
            try:
                return pyjwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
            except Exception as ex:
                last_error = ex
        except Exception as ex:
            last_error = ex
    raise last_error or ValueError("Invalid token")


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = _decode_token(creds.credentials)
        uid = payload["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("banned"):
        raise HTTPException(403, "Account suspended")
    return user


async def current_admin(user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


def is_owner_email(email: str) -> bool:
    return bool(OWNER_EMAIL) and email.lower() == OWNER_EMAIL

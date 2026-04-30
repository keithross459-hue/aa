"""Per-user integration credentials — encrypted at rest with Fernet.

Providers:
  - gumroad          (access_token)
  - stripe           (secret_key)
  - meta             (access_token, ad_account_id, pixel_id, page_id)
  - tiktok           (access_token, advertiser_id?)
  - openai           (api_key)
  - anthropic        (api_key)
  - stan_store       (access_token)
  - whop             (api_key)
  - payhip           (api_key)
  - shopify          (store_domain, admin_api_token)
  - instagram        (access_token, user_id)
  - twitter          (bearer_token)
  - youtube          (access_token, channel_id)

Each provider value is a dict stored under `providers.<name>` in the user_settings doc.
"""
from __future__ import annotations

import base64
import hashlib
import os
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet, InvalidToken

PROVIDERS: Dict[str, List[str]] = {
    "gumroad": ["access_token"],
    "stripe": ["secret_key"],
    "meta": ["access_token", "ad_account_id", "pixel_id", "page_id"],
    "tiktok": ["access_token", "advertiser_id"],
    "openai": ["api_key"],
    "anthropic": ["api_key"],
    "stan_store": ["access_token"],
    "whop": ["api_key"],
    "payhip": ["api_key"],
    "shopify": ["store_domain", "admin_api_token"],
    "instagram": ["access_token", "user_id"],
    "twitter": ["bearer_token"],
    "youtube": ["access_token", "channel_id"],
}

# Fields that are considered "secret" and should be redacted on read.
_SECRET_FIELDS = {
    "access_token", "secret_key", "api_key", "admin_api_token",
    "bearer_token",
}


def _fernet() -> Fernet:
    raw = os.environ.get("SETTINGS_ENC_KEY", "filthy-default-enc-key-change-me").encode()
    # Fernet needs urlsafe base64 of exactly 32 bytes — derive via SHA-256
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def encrypt(value: str) -> str:
    if value is None:
        return ""
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except (InvalidToken, Exception):
        return ""


def redact(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "••••"
    return f"{value[:4]}••••{value[-4:]}"


def prepare_for_storage(provider: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Encrypt only secret fields; keep identifiers (like ad_account_id) plain."""
    out: Dict[str, Any] = {}
    allowed = PROVIDERS.get(provider, [])
    for k in allowed:
        if k not in payload:
            continue
        v = payload[k]
        if v is None:
            continue
        v = str(v).strip()
        if not v:
            continue
        if k in _SECRET_FIELDS:
            out[k] = {"enc": encrypt(v)}
        else:
            out[k] = {"plain": v}
    return out


def decrypt_for_use(provider_doc: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """Return {field: plain_value} for server-side use."""
    if not provider_doc:
        return {}
    out: Dict[str, str] = {}
    for k, v in provider_doc.items():
        if not isinstance(v, dict):
            continue
        if "enc" in v:
            out[k] = decrypt(v["enc"])
        elif "plain" in v:
            out[k] = v["plain"]
    return {k: v for k, v in out.items() if v}


def redact_for_display(provider_doc: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Returns UI-safe payload: identifiers shown as-is; secrets redacted."""
    if not provider_doc:
        return {}
    out: Dict[str, Any] = {}
    for k, v in provider_doc.items():
        if not isinstance(v, dict):
            continue
        if "enc" in v:
            # Try to decrypt just for redacted display
            plain = decrypt(v["enc"])
            out[k] = redact(plain)
        elif "plain" in v:
            out[k] = v["plain"]
    return out


def is_configured(provider_doc: Optional[Dict[str, Any]], required: List[str]) -> bool:
    if not provider_doc:
        return False
    plain = decrypt_for_use(provider_doc)
    return all(plain.get(r) for r in required)


async def get_user_providers(db, user_id: str) -> Dict[str, Dict[str, Any]]:
    doc = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    return (doc or {}).get("providers", {}) if doc else {}


async def get_provider_plain(db, user_id: str, provider: str) -> Dict[str, str]:
    """Fetch a single provider's decrypted creds for server-side use."""
    providers = await get_user_providers(db, user_id)
    return decrypt_for_use(providers.get(provider))

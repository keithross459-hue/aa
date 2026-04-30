"""Security middleware, health checks, indexes, and structured request logging."""
from __future__ import annotations

import logging
import os
import time
import uuid
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

log = logging.getLogger("filthy.security")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if os.environ.get("FORCE_HTTPS", "false").lower() == "true":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start = time.perf_counter()
        response = None
        try:
            response = await call_next(request)
            return response
        finally:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            status = getattr(response, "status_code", 500)
            log.info(
                "request",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": status,
                    "elapsed_ms": elapsed_ms,
                },
            )
            if response is not None:
                response.headers["X-Request-ID"] = request_id


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 120):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60
        self.hits: Dict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.url.path in {"/api/health", "/api/ready"}:
            return await call_next(request)

        forwarded = request.headers.get("X-Forwarded-For", "")
        ip = forwarded.split(",", 1)[0].strip() or (request.client.host if request.client else "unknown")
        key = f"{ip}:{request.url.path if request.url.path.startswith('/api/auth') else 'global'}"
        now = time.time()
        bucket = self.hits[key]
        while bucket and now - bucket[0] > self.window_seconds:
            bucket.popleft()
        limit = 20 if request.url.path.startswith("/api/auth") else self.requests_per_minute
        if len(bucket) >= limit:
            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
        bucket.append(now)
        return await call_next(request)


async def ensure_indexes(db):
    index_specs = [
        (db.users, [("id", 1)], {"unique": True}),
        (db.users, [("email", 1)], {"unique": True}),
        (db.users, [("plan", 1), ("subscription_status", 1)], {}),
        (db.products, [("user_id", 1), ("created_at", -1)], {}),
        (db.campaigns, [("user_id", 1), ("product_id", 1), ("created_at", -1)], {}),
        (db.listings, [("user_id", 1), ("product_id", 1), ("launched_at", -1)], {}),
        (db.tracking_events, [("product_id", 1), ("user_id", 1), ("event_type", 1)], {}),
        (db.payment_transactions, [("session_id", 1)], {"unique": False}),
        (db.referral_codes, [("code", 1)], {"unique": True}),
        (db.referral_attributions, [("referrer_user_id", 1), ("referred_user_id", 1)], {}),
        (db.referral_commissions, [("referrer_user_id", 1), ("status", 1)], {}),
        (db.referral_payouts, [("status", 1), ("created_at", -1)], {}),
        (db.password_reset_tokens, [("token_hash", 1), ("used", 1), ("expires_at", 1)], {}),
        (db.audit_logs, [("created_at", -1)], {}),
    ]
    for collection, keys, kwargs in index_specs:
        try:
            await collection.create_index(keys, background=True, **kwargs)
        except Exception as ex:
            log.warning("index creation skipped for %s: %s", collection.name, ex)

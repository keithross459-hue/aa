"""Lightweight audit log for admin actions."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from db import db


async def log_event(
    actor_id: str,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_id": actor_id,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

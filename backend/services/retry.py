"""Small async retry helper for network-bound integrations."""
from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")


async def with_retries(fn: Callable[[], Awaitable[T]], attempts: int = 3, base_delay: float = 0.5) -> T:
    last_error = None
    for attempt in range(attempts):
        try:
            return await fn()
        except Exception as ex:
            last_error = ex
            if attempt < attempts - 1:
                await asyncio.sleep(base_delay * (2 ** attempt))
    raise last_error

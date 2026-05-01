"""LLM key resolution for production environments."""
from __future__ import annotations

import os
from typing import List


def llm_api_key() -> str:
    return (
        os.environ.get("EMERGENT_LLM_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
        or ""
    )


def llm_api_keys() -> List[str]:
    keys: List[str] = []
    for name in ("EMERGENT_LLM_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"):
        value = os.environ.get(name)
        if value and value not in keys:
            keys.append(value)
    return keys


def llm_configured() -> bool:
    return bool(llm_api_key())

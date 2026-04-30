"""LLM key resolution for production environments."""
from __future__ import annotations

import os


def llm_api_key() -> str:
    return (
        os.environ.get("EMERGENT_LLM_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
        or ""
    )


def llm_configured() -> bool:
    return bool(llm_api_key())

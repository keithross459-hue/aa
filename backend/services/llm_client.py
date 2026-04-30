"""LLM generation adapter.

Keeps the existing Emergent integration when installed, with direct provider
fallbacks for production hosts where that private package is unavailable.
"""
from __future__ import annotations

import asyncio
import os
from typing import Optional

import requests

try:  # Optional private dependency used by the original app environment.
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except Exception:  # pragma: no cover - exercised only when package is absent.
    LlmChat = None
    UserMessage = None


def _provider_from_key(api_key: str) -> str:
    if api_key.startswith("sk-ant-"):
        return "anthropic"
    if api_key.startswith("AIza"):
        return "gemini"
    return "openai"


def _direct_generate(system: str, prompt: str, api_key: str) -> str:
    provider = _provider_from_key(api_key)
    timeout = float(os.environ.get("LLM_TIMEOUT_SECONDS", "60"))

    if provider == "anthropic":
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
                "max_tokens": int(os.environ.get("LLM_MAX_TOKENS", "4096")),
                "system": system,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        return "\n".join(part.get("text", "") for part in data.get("content", []) if part.get("type") == "text")

    if provider == "gemini":
        model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            params={"key": api_key},
            json={
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        return "\n".join(part.get("text", "") for part in parts)

    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
        json={
            "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


async def generate_text(
    system: str,
    prompt: str,
    session_id: str,
    api_key: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    if LlmChat and UserMessage:
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system,
        ).with_model(provider or "anthropic", model or "claude-sonnet-4-5-20250929")
        return await chat.send_message(UserMessage(text=prompt))

    return await asyncio.to_thread(_direct_generate, system, prompt, api_key)

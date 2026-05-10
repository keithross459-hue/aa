"""LLM generation adapter.

Keeps the existing Emergent integration when installed, with direct provider
fallbacks for production hosts where that private package is unavailable.
"""
from __future__ import annotations

import asyncio
import os
from typing import Optional

import requests

from services.llm_config import llm_api_keys

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


def _default_model_for_provider(provider: str) -> str:
    if provider == "anthropic":
        return os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    if provider == "gemini":
        return os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


class LlmProviderUnavailable(RuntimeError):
    pass


def _direct_generate(system: str, prompt: str, api_key: str) -> str:
    provider = _provider_from_key(api_key)
    model = _default_model_for_provider(provider)
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
                "model": model,
                "max_tokens": int(os.environ.get("LLM_MAX_TOKENS", "4096")),
                "system": system,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=timeout,
        )
        try:
            resp.raise_for_status()
        except requests.HTTPError as ex:
            raise LlmProviderUnavailable(f"anthropic_unavailable:{resp.status_code}") from ex
        data = resp.json()
        return "\n".join(part.get("text", "") for part in data.get("content", []) if part.get("type") == "text")

    if provider == "gemini":
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta2/models/{model}:generateMessage",
            params={"key": api_key},
            json={
                "temperature": float(os.environ.get("LLM_TEMPERATURE", "0.2")),
                "candidateCount": 1,
                "messages": [
                    {"author": "system", "content": [{"type": "text", "text": system}]},
                    {"author": "user", "content": [{"type": "text", "text": prompt}]},
                ],
            },
            timeout=timeout,
        )
        try:
            resp.raise_for_status()
        except requests.HTTPError as ex:
            raise LlmProviderUnavailable(f"gemini_unavailable:{resp.status_code}") from ex
        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise LlmProviderUnavailable("gemini_unavailable:no_candidates")
        parts = candidates[0].get("content", [])
        return "\n".join(item.get("text", "") for item in parts if item.get("text"))

    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": int(os.environ.get("LLM_MAX_TOKENS", "4096")),
            "temperature": float(os.environ.get("LLM_TEMPERATURE", "0.2")),
        },
        timeout=timeout,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError as ex:
        raise LlmProviderUnavailable(f"openai_unavailable:{resp.status_code}") from ex
    return resp.json()["choices"][0]["message"]["content"]


async def generate_text(
    system: str,
    prompt: str,
    session_id: str,
    api_key: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    provider = provider or _provider_from_key(api_key)
    model = model or _default_model_for_provider(provider)

    if provider == "anthropic" and LlmChat and UserMessage:
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system,
        ).with_model(provider, model)
        return await chat.send_message(UserMessage(text=prompt))

    return await asyncio.to_thread(_direct_generate, system, prompt, api_key)


async def generate_text_with_fallback(
    system: str,
    prompt: str,
    session_id: str,
    api_key_override: Optional[str] = None,
) -> str:
    keys = [api_key_override] if api_key_override else []
    keys.extend(llm_api_keys())
    deduped = []
    for key in keys:
        if key and key not in deduped:
            deduped.append(key)
    if not deduped:
        raise LlmProviderUnavailable("no_llm_keys_configured")

    errors = []
    for index, key in enumerate(deduped):
        try:
            return await generate_text(system, prompt, f"{session_id}-{index}", key)
        except Exception as ex:
            errors.append(str(ex))
            continue
    raise LlmProviderUnavailable("all_llm_providers_unavailable")

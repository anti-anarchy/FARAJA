"""
llm.py
──────
Hosted LLM client — no model runs on this server. Two engines with failover
(primary + backup). All error text is vendor-neutral so nothing but "Faraja"
ever reaches a user.

Public surface:
  chat()   multi-turn text with failover
  json()   chat constrained to a JSON object (parsed to dict)
  health() engine health by role (never by vendor name)
  close()  release the shared HTTP client
"""

import json as jsonlib
import re
from typing import Callable

import httpx

from app.config import settings


class LLMError(Exception):
    pass


_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=settings.LLM_TIMEOUT)
    return _client


async def close() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


# ── Gemini ────────────────────────────────────────────────────────────────────

def _gemini_contents(messages: list[dict]) -> tuple[list[dict], str | None]:
    system, contents = [], []
    for m in messages:
        if m["role"] == "system":
            system.append(m["content"]); continue
        contents.append({
            "role": "model" if m["role"] == "assistant" else "user",
            "parts": [{"text": m["content"]}],
        })
    return contents, ("\n\n".join(system) or None)


def _gemini_text(data: dict) -> str:
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return ""


async def _gemini_chat(messages: list[dict], temperature: float, max_tokens: int) -> str:
    if not settings.GEMINI_API_KEY:
        raise LLMError("AI engine not configured")
    contents, system = _gemini_contents(messages)
    payload: dict = {
        "contents": contents,
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    url = f"{settings.GEMINI_BASE_URL}/models/{settings.GEMINI_MODEL}:generateContent"
    try:
        r = await _http().post(url, params={"key": settings.GEMINI_API_KEY}, json=payload)
        r.raise_for_status()
        return _gemini_text(r.json()).strip()
    except httpx.HTTPStatusError as e:
        raise LLMError(f"AI engine error (HTTP {e.response.status_code})")
    except httpx.HTTPError:
        raise LLMError("AI engine unreachable")


# ── Groq (OpenAI-compatible) ─────────────────────────────────────────────────

async def _groq_chat(messages: list[dict], temperature: float, max_tokens: int) -> str:
    if not settings.GROQ_API_KEY:
        raise LLMError("AI engine not configured")
    payload = {"model": settings.GROQ_MODEL, "messages": messages,
               "temperature": temperature, "max_tokens": max_tokens}
    try:
        r = await _http().post(f"{settings.GROQ_BASE_URL}/chat/completions",
                               headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                               json=payload)
        r.raise_for_status()
        return (r.json()["choices"][0]["message"]["content"] or "").strip()
    except httpx.HTTPStatusError as e:
        raise LLMError(f"AI engine error (HTTP {e.response.status_code})")
    except httpx.HTTPError:
        raise LLMError("AI engine unreachable")


_CHAT_FNS: dict[str, Callable] = {"gemini": _gemini_chat, "groq": _groq_chat}


# ── Public (failover) ─────────────────────────────────────────────────────────

async def chat(messages: list[dict], temperature: float = 0.4, max_tokens: int = 500) -> str:
    last: Exception | None = None
    for name in settings.LLM_PROVIDERS:
        fn = _CHAT_FNS.get(name)
        if not fn:
            continue
        try:
            return await fn(messages, temperature, max_tokens)
        except LLMError as e:
            last = e
    raise LLMError(f"Faraja is temporarily unavailable ({last})")


def _extract_json(text: str) -> dict:
    text = re.sub(r"```(?:json)?\n?", "", text).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise LLMError("no JSON in model output")
    return jsonlib.loads(m.group())


async def json(messages: list[dict], temperature: float = 0.1, max_tokens: int = 700) -> dict:
    last: Exception | None = None
    for name in settings.LLM_PROVIDERS:
        fn = _CHAT_FNS.get(name)
        if not fn:
            continue
        try:
            return _extract_json(await fn(messages, temperature, max_tokens))
        except (LLMError, jsonlib.JSONDecodeError) as e:
            last = e
    raise LLMError(f"Faraja is temporarily unavailable ({last})")


async def _ping(name: str) -> str:
    try:
        if name == "gemini":
            if not settings.GEMINI_API_KEY:
                return "no_api_key"
            await _gemini_chat([{"role": "user", "content": "ping"}], 0.0, 5)
            return "ok"
        if name == "groq":
            if not settings.GROQ_API_KEY:
                return "no_api_key"
            await _groq_chat([{"role": "user", "content": "ping"}], 0.0, 5)
            return "ok"
    except LLMError as e:
        return f"error: {str(e)[:60]}"
    return "unknown"


async def health() -> dict:
    engines: dict[str, str] = {}
    for i, name in enumerate(settings.LLM_PROVIDERS):
        role = "primary" if i == 0 else ("backup" if i == 1 else f"fallback_{i}")
        engines[role] = await _ping(name)
    status = "ok" if any(v == "ok" for v in engines.values()) else "error"
    return {"status": status, "engines": engines}

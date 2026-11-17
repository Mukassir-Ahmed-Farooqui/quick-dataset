"""
Live model catalogs for each provider.

Each provider's ``list_models()`` returns the chat / text-generation models a
key can actually use right now, so the UI can offer a dropdown instead of a
hard-coded model id (which breaks when a provider retires a model, as Groq
did with ``llama-3.3-70b-versatile`` on 2026-08-16).

Speech (whisper / tts / audio), moderation / guard, embedding and image
models are filtered out because the app only does chat completions.
"""

from __future__ import annotations

import re
import time
from typing import Iterable

from app.schemas_extended import ModelInfo

# Substrings that mark a model as non-chat (speech, guard, embeddings, images...).
_EXCLUDE_PATTERNS = re.compile(
    r"(whisper|tts|transcribe|audio|speech|realtime|"
    r"guard|moderation|safeguard|prompt-guard|"
    r"embed|embedding|"
    r"dall-e|gpt-image|image|imagen|veo|sora|"
    r"search-preview|computer-use|codex-mini|"
    r"davinci|babbage)",
    re.IGNORECASE,
)

# OpenAI's /models lists everything the account can see; only these families
# are chat models usable through /chat/completions.
_OPENAI_CHAT_PREFIXES = ("gpt-", "o1", "o3", "o4", "chatgpt-")


def is_chat_model(model_id: str) -> bool:
    return not _EXCLUDE_PATTERNS.search(model_id or "")


def _sorted(models: Iterable[ModelInfo]) -> list[ModelInfo]:
    seen: dict[str, ModelInfo] = {}
    for m in models:
        if m.id and m.id not in seen:
            seen[m.id] = m
    return sorted(seen.values(), key=lambda m: m.id.lower())


def parse_openai_compatible(data: dict, provider: str) -> list[ModelInfo]:
    """Parse an OpenAI-style ``GET /models`` body (OpenAI, Groq, OpenRouter)."""
    out: list[ModelInfo] = []
    for item in data.get("data") or []:
        mid = item.get("id") or ""
        if not mid or not is_chat_model(mid):
            continue
        if item.get("active") is False:  # Groq marks retired models inactive
            continue
        if provider == "openai" and not mid.startswith(_OPENAI_CHAT_PREFIXES):
            continue
        if provider == "openrouter":
            arch = item.get("architecture") or {}
            outputs = arch.get("output_modalities")
            if isinstance(outputs, list) and outputs and "text" not in outputs:
                continue
        ctx = item.get("context_window") or item.get("context_length")
        out.append(ModelInfo(
            id=mid,
            name=item.get("name") or mid,
            context_window=int(ctx) if isinstance(ctx, (int, float)) else None,
            owned_by=item.get("owned_by"),
        ))
    return _sorted(out)


def parse_gemini(data: dict) -> list[ModelInfo]:
    """Parse Gemini ``GET /v1beta/models``, keeping text-generation models."""
    out: list[ModelInfo] = []
    for item in data.get("models") or []:
        methods = item.get("supportedGenerationMethods") or []
        if "generateContent" not in methods:
            continue
        mid = (item.get("name") or "").removeprefix("models/")
        if not mid or not is_chat_model(mid):
            continue
        ctx = item.get("inputTokenLimit")
        out.append(ModelInfo(
            id=mid,
            name=item.get("displayName") or mid,
            context_window=int(ctx) if isinstance(ctx, (int, float)) else None,
            owned_by="google",
        ))
    return _sorted(out)


# ── Per-key cache (about an hour) ────────────────────────────────────

MODEL_CACHE_TTL_SECONDS = 3600
_cache: dict[str, tuple[float, list[ModelInfo]]] = {}


def cache_get(key_id: str, fingerprint: str) -> list[ModelInfo] | None:
    hit = _cache.get(f"{key_id}:{fingerprint}")
    if hit and time.time() - hit[0] < MODEL_CACHE_TTL_SECONDS:
        return hit[1]
    return None


def cache_put(key_id: str, fingerprint: str, models: list[ModelInfo]) -> None:
    _cache[f"{key_id}:{fingerprint}"] = (time.time(), models)


def cache_clear(key_id: str | None = None) -> None:
    if key_id is None:
        _cache.clear()
        return
    for k in [k for k in _cache if k.startswith(f"{key_id}:")]:
        _cache.pop(k, None)


def is_model_unavailable_error(exc: BaseException) -> bool:
    """True when a provider error means the model is retired / unknown."""
    resp = getattr(exc, "response", None)
    status = getattr(resp, "status_code", None)
    text = ""
    try:
        text = (resp.text or "") if resp is not None else ""
    except Exception:
        text = ""
    text = (text or str(exc)).lower()
    markers = (
        "model_decommissioned", "decommissioned", "model_not_found",
        "does not exist", "not found for api version", "no longer supported",
        "is not a valid model", "invalid model", "no endpoints found",
    )
    if any(m in text for m in markers):
        return True
    return status == 404

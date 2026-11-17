"""Model dropdown: catalog parsing/filtering, model resolution, retired-model fallback."""
import asyncio
from types import SimpleNamespace

import httpx
import pytest

from app.services.llm import model_catalog
from app.services.generation import resolver
from app.services.llm import tracked_call


def test_groq_catalog_drops_speech_guard_and_inactive():
    data = {"data": [
        {"id": "openai/gpt-oss-120b", "owned_by": "OpenAI", "active": True, "context_window": 131072},
        {"id": "whisper-large-v3", "active": True},
        {"id": "playai-tts", "active": True},
        {"id": "meta-llama/llama-guard-4-12b", "active": True},
        {"id": "meta-llama/llama-prompt-guard-2-86m", "active": True},
        {"id": "openai/gpt-oss-safeguard-20b", "active": True},
        {"id": "llama-3.3-70b-versatile", "active": False},
        {"id": "llama-3.1-8b-instant", "active": True},
    ]}
    ids = [m.id for m in model_catalog.parse_openai_compatible(data, "groq")]
    assert ids == ["llama-3.1-8b-instant", "openai/gpt-oss-120b"]


def test_openai_catalog_keeps_only_chat_families():
    data = {"data": [{"id": i} for i in [
        "gpt-4o-mini", "o3-mini", "text-embedding-3-small", "dall-e-3",
        "whisper-1", "tts-1", "gpt-4o-realtime-preview", "omni-moderation-latest", "babbage-002",
    ]]}
    ids = [m.id for m in model_catalog.parse_openai_compatible(data, "openai")]
    assert ids == ["gpt-4o-mini", "o3-mini"]


def test_openrouter_catalog_drops_non_text_output():
    data = {"data": [
        {"id": "openai/gpt-4o-mini", "name": "GPT-4o mini", "context_length": 128000,
         "architecture": {"output_modalities": ["text"]}},
        {"id": "some/image-gen", "architecture": {"output_modalities": ["image"]}},
    ]}
    out = model_catalog.parse_openai_compatible(data, "openrouter")
    assert [m.id for m in out] == ["openai/gpt-4o-mini"]
    assert out[0].context_window == 128000 and out[0].name == "GPT-4o mini"


def test_gemini_catalog_keeps_generate_content_only():
    data = {"models": [
        {"name": "models/gemini-2.5-flash", "displayName": "Gemini 2.5 Flash",
         "supportedGenerationMethods": ["generateContent", "countTokens"], "inputTokenLimit": 1048576},
        {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]},
        {"name": "models/gemini-2.5-flash-preview-tts", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/imagen-3.0", "supportedGenerationMethods": ["predict"]},
    ]}
    out = model_catalog.parse_gemini(data)
    assert [m.id for m in out] == ["gemini-2.5-flash"]


def test_cache_respects_fingerprint_and_clear():
    model_catalog.cache_clear()
    m = [model_catalog.ModelInfo(id="x")]
    model_catalog.cache_put("k1", "fp", m)
    assert model_catalog.cache_get("k1", "fp") == m
    assert model_catalog.cache_get("k1", "other") is None
    model_catalog.cache_clear("k1")
    assert model_catalog.cache_get("k1", "fp") is None


def test_groq_default_is_no_longer_retired_llama():
    assert resolver.default_model_for("groq") == "openai/gpt-oss-120b"


def test_resolve_model_priority():
    assert resolver.resolve_model("req", "groq", "picked") == "req"
    assert resolver.resolve_model("", "groq", "picked") == "picked"
    assert resolver.resolve_model(None, "groq", None) == "openai/gpt-oss-120b"


def _http_error(status, body):
    req = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    resp = httpx.Response(status, request=req, text=body)
    return httpx.HTTPStatusError("err", request=req, response=resp)


def test_unavailable_error_detection():
    assert model_catalog.is_model_unavailable_error(
        _http_error(400, '{"error":{"code":"model_decommissioned"}}'))
    assert model_catalog.is_model_unavailable_error(_http_error(404, "nope"))
    assert not model_catalog.is_model_unavailable_error(_http_error(401, "invalid api key"))
    assert not model_catalog.is_model_unavailable_error(_http_error(429, "slow down"))


def test_tracked_complete_falls_back_when_model_retired(monkeypatch):
    calls = []

    async def fake_once(db, project_id, config, messages, model, **kw):
        calls.append(model)
        if model == "llama-3.3-70b-versatile":
            raise _http_error(400, '{"error":{"code":"model_decommissioned"}}')
        return SimpleNamespace(content="ok")

    monkeypatch.setattr(tracked_call, "_tracked_complete_once", fake_once)
    cfg = SimpleNamespace(provider="groq")
    out = asyncio.run(tracked_call.tracked_complete(None, "p", cfg, [], "llama-3.3-70b-versatile"))
    assert out.content == "ok"
    assert calls == ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]


def test_tracked_complete_does_not_mask_auth_errors(monkeypatch):
    async def fake_once(*a, **kw):
        raise _http_error(401, "invalid api key")

    monkeypatch.setattr(tracked_call, "_tracked_complete_once", fake_once)
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(tracked_call.tracked_complete(None, "p", SimpleNamespace(provider="groq"), [], "some-model"))

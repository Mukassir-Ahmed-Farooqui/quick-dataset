"""
Shared httpx.AsyncClient for all LLM providers.

Previously every ``complete()`` call opened a fresh ``httpx.AsyncClient``
(new TCP + TLS handshake per request). With concurrent generation that is
both slow and wasteful, so providers now share one pooled client.

An ``AsyncClient`` is bound to the event loop it was first used on, so we
keep one client per running loop (the app normally has exactly one; tests
create several).
"""

from __future__ import annotations

import asyncio
import os
import weakref
from typing import Optional

import httpx

_CLIENTS: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, httpx.AsyncClient]" = weakref.WeakKeyDictionary()
_FALLBACK: dict[str, httpx.AsyncClient] = {}


def _timeout() -> httpx.Timeout:
    read = float(os.getenv("LLM_HTTP_READ_TIMEOUT", "120"))
    return httpx.Timeout(connect=10.0, read=read, write=30.0, pool=60.0)


def _limits() -> httpx.Limits:
    max_conn = int(os.getenv("LLM_HTTP_MAX_CONNECTIONS", "64"))
    return httpx.Limits(max_connections=max_conn, max_keepalive_connections=min(32, max_conn))


def get_http_client() -> httpx.AsyncClient:
    """Return the pooled client for the current event loop (created lazily)."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    store = _CLIENTS if loop is not None else _FALLBACK
    key = loop if loop is not None else "default"
    client = store.get(key)
    if client is None or client.is_closed:
        client = httpx.AsyncClient(timeout=_timeout(), limits=_limits())
        store[key] = client
    return client


async def close_http_clients() -> None:
    """Close every pooled client (call on application shutdown)."""
    clients = list(_CLIENTS.values()) + list(_FALLBACK.values())
    _CLIENTS.clear()
    _FALLBACK.clear()
    for c in clients:
        try:
            await c.aclose()
        except Exception:
            pass

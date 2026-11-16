"""
Robust JSON extraction from LLM output — shared by every generator.

LLMs wrap JSON in all sorts of noise. This module handles, in order:

1. ``<think>...</think>`` / ``<thinking>...</thinking>`` reasoning blocks
   (reasoning models) — stripped before parsing, and exposed separately
   via :func:`split_think` so answers can keep them as chain-of-thought.
2. Markdown code fences (```json ... ``` or bare ``` ... ```), anywhere
   in the text, not only at the start.
3. Leading / trailing prose ("Here are the questions: [...] Hope this helps").
   We scan for the first *balanced* ``[...]`` / ``{...}`` block, respecting
   string literals, so trailing brackets in prose don't break it.
4. Light repairs: smart quotes, trailing commas, Python literals
   (single quotes, True/False/None) via ``ast.literal_eval``.

Ported from Easy Dataset's ``extractJsonFromLLMOutput`` (lib/llm/common/util.js)
and extended — Easy Dataset relies on the ``jsonrepair`` npm package; we
implement the subset of repairs that matter for our prompts without a new
dependency.
"""

from __future__ import annotations

import ast
import json
import re
from typing import Any, Optional

_THINK_TAGS = (("<think>", "</think>"), ("<thinking>", "</thinking>"))
_FENCE_RE = re.compile(r"```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)```")
_TRAILING_COMMA_RE = re.compile(r",\s*([\]}])")
_SMART_QUOTES = {
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
}


def split_think(text: str) -> tuple[str, str]:
    """Split ``<think>`` reasoning from the final answer.

    Returns ``(answer, think)``. ``think`` is ``""`` when no complete think
    block exists. An unterminated ``<think>`` at the start (truncated
    reasoning) is dropped from the answer.
    """
    if not text:
        return "", ""
    for start, end in _THINK_TAGS:
        s = text.find(start)
        if s == -1:
            continue
        e = text.find(end, s + len(start))
        if e == -1:
            # Truncated reasoning: keep whatever came before the tag.
            return text[:s].strip(), text[s + len(start):].strip()
        think = text[s + len(start):e].strip()
        answer = (text[:s] + " " + text[e + len(end):]).strip()
        return answer, think
    return text.strip(), ""


def _find_balanced(text: str, opener: str) -> Optional[str]:
    """Return the first balanced block starting with ``opener`` ('[' or '{').

    String-literal aware (both quote styles) so brackets inside strings
    don't confuse the depth counter.
    """
    closer = "]" if opener == "[" else "}"
    start = text.find(opener)
    while start != -1:
        depth = 0
        in_str: Optional[str] = None
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == in_str:
                    in_str = None
                continue
            if ch in ('"', "'"):
                # Treat an apostrophe inside a word (don't) as a literal char.
                if ch == "'" and i > 0 and text[i - 1].isalnum() and i + 1 < len(text) and text[i + 1].isalnum():
                    continue
                in_str = ch
            elif ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    return text[start:i + 1]
        start = text.find(opener, start + 1)
    return None


def _try_parse(candidate: str) -> Any:
    """Try strict JSON, then repaired JSON, then Python literal. Raises ValueError."""
    candidate = candidate.strip()
    if not candidate:
        raise ValueError("empty")
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, ValueError):
        pass

    repaired = candidate
    for k, v in _SMART_QUOTES.items():
        repaired = repaired.replace(k, v)
    repaired = _TRAILING_COMMA_RE.sub(r"\1", repaired)
    try:
        return json.loads(repaired)
    except (json.JSONDecodeError, ValueError):
        pass

    # Python-literal style: ['a', 'b'], {'k': True}
    py = re.sub(r"\btrue\b", "True", repaired)
    py = re.sub(r"\bfalse\b", "False", py)
    py = re.sub(r"\bnull\b", "None", py)
    try:
        value = ast.literal_eval(py)
        if isinstance(value, (list, dict, tuple)):
            return list(value) if isinstance(value, tuple) else value
    except (ValueError, SyntaxError, MemoryError, RecursionError):
        pass
    raise ValueError("unparseable")


def extract_json(text: Optional[str], expect: Optional[type] = None) -> Any:
    """Extract a JSON value from raw LLM output.

    Args:
        text: raw model output.
        expect: ``list`` or ``dict`` to require a particular top-level type.
            When ``expect is list`` and the model returned an object that
            wraps a single list (``{"questions": [...]}``), the list is
            unwrapped.

    Returns:
        The parsed value, or ``None`` if nothing usable was found.
    """
    if not text or not text.strip():
        return None
    body, _ = split_think(text)
    if not body:
        return None

    candidates: list[str] = [body]
    candidates.extend(m.group(1) for m in _FENCE_RE.finditer(body))
    # Unterminated fence (truncated output): take everything after the opener.
    if body.count("```") % 2 == 1:
        candidates.append(body.split("```", 1)[1].split("\n", 1)[-1])

    openers = ["[", "{"] if expect is not dict else ["{", "["]
    for cand in list(candidates):
        for op in openers:
            block = _find_balanced(cand, op)
            if block:
                candidates.append(block)

    for cand in candidates:
        try:
            value = _try_parse(cand)
        except ValueError:
            continue
        value = _coerce(value, expect)
        if value is not None:
            return value
    return None


def _coerce(value: Any, expect: Optional[type]) -> Any:
    if expect is None:
        return value
    if expect is list:
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            lists = [v for v in value.values() if isinstance(v, list)]
            if len(lists) == 1:
                return lists[0]
        return None
    if expect is dict:
        if isinstance(value, dict):
            return value
        if isinstance(value, list) and len(value) == 1 and isinstance(value[0], dict):
            return value[0]
        return None
    return value if isinstance(value, expect) else None

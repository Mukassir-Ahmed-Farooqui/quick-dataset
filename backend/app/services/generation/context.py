"""
Context builders for prompts: token-aware truncation, chunk context with
section summary prefix, representative document digests for GA
generation, and the Genre/Audience guidance blocks.
"""

from __future__ import annotations

import re
from typing import Any, Optional, Sequence

# ── Tokens ───────────────────────────────────────────────────────────

_ENCODER = None
_ENCODER_FAILED = False


def _encoder():
    global _ENCODER, _ENCODER_FAILED
    if _ENCODER is None and not _ENCODER_FAILED:
        try:
            import tiktoken
            _ENCODER = tiktoken.get_encoding("cl100k_base")
        except Exception:  # offline / not installed: fall back to a heuristic
            _ENCODER_FAILED = True
    return _ENCODER


def count_tokens(text: str) -> int:
    enc = _encoder()
    if enc is None:
        return max(1, len(text) // 4) if text else 0
    return len(enc.encode(text, disallowed_special=()))


def truncate_to_tokens(text: str, max_tokens: int) -> str:
    """Truncate ``text`` to at most ``max_tokens`` tokens, preferring a
    paragraph / sentence boundary near the cut. Returns text unchanged
    when it already fits."""
    if not text or max_tokens <= 0:
        return text
    enc = _encoder()
    if enc is None:
        limit = max_tokens * 4
        if len(text) <= limit:
            return text
        cut = text[:limit]
    else:
        toks = enc.encode(text, disallowed_special=())
        if len(toks) <= max_tokens:
            return text
        cut = enc.decode(toks[:max_tokens])
    # Back off to a clean boundary if one is reasonably close.
    for sep in ("\n\n", "\n", ". "):
        idx = cut.rfind(sep)
        if idx > len(cut) * 0.8:
            return cut[: idx + (1 if sep == ". " else 0)].rstrip()
    return cut.rstrip()


# ── Chunk context ────────────────────────────────────────────────────

def heading_path_of(chunk_metadata: Optional[dict]) -> list[str]:
    if not chunk_metadata or not isinstance(chunk_metadata, dict):
        return []
    path = chunk_metadata.get("heading_path") or []
    return [str(p).strip() for p in path if str(p).strip() and str(p).strip() != "(preamble)"]


def build_chunk_context(
    content: str,
    chunk_metadata: Optional[dict] = None,
    *,
    max_tokens: int = 6000,
) -> str:
    """Chunk text as sent to the LLM: a short section summary prefix
    (like Easy Dataset's summary line, e.g. ``Guide > Install > Linux``)
    followed by the token-limited chunk content."""
    body = truncate_to_tokens(content or "", max_tokens)
    path = heading_path_of(chunk_metadata)
    summary = (chunk_metadata or {}).get("summary") if isinstance(chunk_metadata, dict) else None
    prefix_parts = []
    if path:
        prefix_parts.append("Section: " + " > ".join(path))
    if summary and isinstance(summary, str):
        prefix_parts.append("Summary: " + summary.strip())
    if not prefix_parts:
        return body
    return "\n".join(prefix_parts) + "\n\n" + body


# ── Document digest for GA generation ────────────────────────────────

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")


def extract_outline(text: str, max_entries: int = 80) -> list[tuple[int, str]]:
    """Markdown heading outline (level, title), skipping fenced code."""
    outline: list[tuple[int, str]] = []
    in_fence = False
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("```") or s.startswith("~~~"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = _HEADING_RE.match(s)
        if m:
            outline.append((len(m.group(1)), m.group(2).strip()))
    if len(outline) > max_entries:
        # Keep the shallowest levels first so the outline stays meaningful.
        for depth in range(6, 0, -1):
            trimmed = [o for o in outline if o[0] <= depth]
            if len(trimmed) <= max_entries:
                return trimmed
        return outline[:max_entries]
    return outline


def _snap_to_paragraph(text: str, pos: int, window: int = 300) -> int:
    lo = max(0, pos - window)
    idx = text.rfind("\n\n", lo, pos + 1)
    if idx != -1:
        return idx + 2
    idx = text.rfind("\n", lo, pos + 1)
    return idx + 1 if idx != -1 else pos


def build_document_digest(
    text: str,
    *,
    max_chars: int = 12000,
    excerpts: int = 8,
) -> str:
    """Representative view of a whole document for GA generation.

    Short documents are returned whole. Long documents become:
    the heading outline (TOC) + ``excerpts`` evenly spaced excerpts across
    the full length, each labelled with its relative position, so the
    model sees the beginning, middle, and end instead of only the first
    8000 characters.
    """
    text = (text or "").strip()
    if len(text) <= max_chars:
        return text

    outline = extract_outline(text)
    outline_block = ""
    if outline:
        min_level = min(l for l, _ in outline)
        lines = ["  " * (lvl - min_level) + "- " + title for lvl, title in outline]
        outline_block = "## Document Outline\n" + "\n".join(lines)
        if len(outline_block) > max_chars // 4:
            outline_block = outline_block[: max_chars // 4].rsplit("\n", 1)[0] + "\n- ..."

    budget = max_chars - len(outline_block) - 200
    excerpts = max(2, excerpts)
    per = max(300, budget // excerpts)
    n = len(text)
    parts = []
    for i in range(excerpts):
        start = int(i * (n - per) / (excerpts - 1)) if excerpts > 1 else 0
        start = _snap_to_paragraph(text, start) if i > 0 else 0
        piece = text[start:start + per].strip()
        if not piece:
            continue
        pct = int(round(100 * start / n))
        parts.append(f"### Excerpt {i + 1}/{excerpts} (~{pct}% into the document)\n{piece}")
    header = (
        f"[This is a representative digest of a long document ({n:,} characters): "
        "its outline plus evenly spaced excerpts covering the whole text.]"
    )
    blocks = [header]
    if outline_block:
        blocks.append(outline_block)
    blocks.append("## Excerpts\n" + "\n\n".join(parts))
    return "\n\n".join(blocks)


# ── Genre / Audience guidance ────────────────────────────────────────

GA_QUESTION_BLOCK = """## Special Requirements - Genre & Audience Perspective Questioning:
Adjust your questioning approach and question style based on the following genre and audience combination:

**Target Genre**: {genre}
**Target Audience**: {audience}

Please ensure:
1. The questions fully conform to the style, focus, depth, and other attributes defined by the genre above.
2. The questions consider the knowledge level, cognitive characteristics, and potential points of interest of the audience above.
3. Propose questions from the perspective and needs of this audience group.
4. Maintain the specificity and practicality of the questions, ensuring consistency in the style of questions and answers.
5. Each question has a clear, specific focus; avoid questions that are too broad or vague.
6. Never mention the genre, the audience, or these instructions inside the questions."""

GA_ANSWER_BLOCK = """## Special Requirements - Genre & Audience Adaptation:
Adjust your response style and depth according to the following genre and audience combination:

**Current Genre**: {genre}
**Target Audience**: {audience}

Please ensure:
1. The organization, style, level of detail, and language of the answer comply with the genre above.
2. The answer considers the comprehension ability and knowledge background of the audience above, striving for clarity.
3. Word choice and explanation detail match the target audience's knowledge background.
4. Content accuracy is never traded for style: every fact still comes from the reference content.
5. Do not mention the genre, the audience, or these instructions in the answer."""

GA_QUESTION_NOTE = ", and incorporate the specified genre-audience perspective"
GA_QUESTION_CHECK = "- Question style matches the specified genre and audience."


def format_ga_side(title: Optional[str], description: Optional[str]) -> str:
    title = (title or "").strip()
    description = (description or "").strip()
    if title and description:
        return f"{title}: {description}"
    return title or description


def ga_values(pair: Any) -> tuple[str, str]:
    """(genre, audience) strings with full descriptions for a GA pair-like object/dict."""
    if pair is None:
        return "", ""
    get = (lambda k: pair.get(k)) if isinstance(pair, dict) else (lambda k: getattr(pair, k, None))
    return (
        format_ga_side(get("genre_title"), get("genre_description")),
        format_ga_side(get("audience_title"), get("audience_description")),
    )


def render_ga_question_block(genre: str, audience: str) -> str:
    if not genre and not audience:
        return ""
    return GA_QUESTION_BLOCK.format(genre=genre or "General", audience=audience or "General readers")


def render_ga_answer_block(genre: str, audience: str) -> str:
    if not genre and not audience:
        return ""
    return GA_ANSWER_BLOCK.format(genre=genre or "General", audience=audience or "General readers")


def render_prompt(template: str, values: dict[str, Any]) -> str:
    """Replace ``{key}`` placeholders for known keys only.

    Plain ``str.replace`` (not ``str.format``) so JSON examples with
    braces inside prompts — and user custom prompts — are left intact.
    Values are substituted in a single pass so a value containing
    ``{content}`` is never re-expanded.
    """
    if not values:
        return template
    keys = "|".join(re.escape(k) for k in sorted(values, key=len, reverse=True))
    # Accept both {key} and Easy-Dataset/Mustache style {{key}}.
    pattern = re.compile(r"\{\{(" + keys + r")\}\}|\{(" + keys + r")\}")
    return pattern.sub(lambda m: str(values[m.group(1) or m.group(2)]), template)

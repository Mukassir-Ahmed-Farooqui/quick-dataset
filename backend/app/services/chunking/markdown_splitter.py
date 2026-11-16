"""Heading-aware markdown splitter — ported from Easy Dataset's split-markdown
module (lib/file/split-markdown: parser.js, splitter.js, summary.js) and
improved.

- Splits markdown by headings (H1-H6), ignoring ``#`` lines inside fenced
  code blocks, and tracks the true heading hierarchy with a stack (the old
  implementation could attach stale sibling headings to a path).
- Respects a max length (``chunk_size``): oversized sections are split on
  paragraph / sentence boundaries with overlap instead of hard character cuts.
- Respects a min length (``min_chunk_size``): tiny sections are merged with
  their neighbours (headings kept inline) so chunks carry enough context to
  generate meaningful questions.
- Each chunk carries ``heading_path`` (deepest common path) and
  ``headings`` (every section path inside the chunk), used to build the
  Easy-Dataset-style summary prefix sent to the LLM.
"""
import re
from typing import List, Optional

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
FENCE_RE = re.compile(r"^\s*(```|~~~)")
PARAGRAPH_RE = re.compile(r"\n\s*\n+")


def split_by_headings(text: str) -> List[dict]:
    """Split markdown into sections based on headings.

    Returns list of ``{level, heading, heading_path, content}`` dicts. Content
    excludes the heading line itself. Sections with no body are dropped
    (their heading still appears in descendants' ``heading_path``).
    """
    if not text or not text.strip():
        return []

    sections: List[dict] = []
    stack: List[tuple] = []  # (level, title)
    cur_level = 0
    cur_heading: Optional[str] = None
    cur_path: List[str] = []
    cur_lines: List[str] = []
    in_fence = False

    def flush():
        body = "\n".join(cur_lines).strip()
        if body:
            sections.append({
                "level": cur_level,
                "heading": cur_heading or "(preamble)",
                "heading_path": list(cur_path),
                "content": body,
            })

    for line in text.split("\n"):
        if FENCE_RE.match(line):
            in_fence = not in_fence
            cur_lines.append(line)
            continue
        m = None
        indent = len(line) - len(line.lstrip())
        if not in_fence and indent < 4 and line.lstrip().startswith("#"):
            m = HEADING_RE.match(line.strip())
        if m:
            flush()
            level = len(m.group(1))
            title = m.group(2).strip()
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, title))
            cur_level, cur_heading = level, title
            cur_path = [t for _, t in stack]
            cur_lines = []
        else:
            cur_lines.append(line)
    flush()
    return sections


def _recursive_split(text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    """Split on paragraph -> line -> sentence -> word boundaries with overlap."""
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=min(chunk_overlap, chunk_size // 2),
            separators=["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""],
        )
        return [p for p in splitter.split_text(text) if p.strip()]
    except ImportError:  # pragma: no cover - dependency is in requirements
        return _split_oversized(text, chunk_size, chunk_overlap)


def _common_prefix(paths: List[List[str]]) -> List[str]:
    if not paths:
        return []
    prefix = list(paths[0])
    for p in paths[1:]:
        i = 0
        while i < len(prefix) and i < len(p) and prefix[i] == p[i]:
            i += 1
        prefix = prefix[:i]
    return prefix


def _render_unit(unit: dict) -> str:
    """Unit content with its heading line restored (used when merging)."""
    if unit.get("part") or not unit.get("heading_path"):
        return unit["content"]
    level = max(1, min(6, unit.get("level") or 1))
    return f"{'#' * level} {unit['heading_path'][-1]}\n{unit['content']}"


def split_markdown(
    text: str,
    chunk_size: int = 1500,
    chunk_overlap: int = 200,
    min_chunk_size: Optional[int] = None,
) -> List[dict]:
    """Split markdown into chunks between ``min_chunk_size`` and ``chunk_size``
    characters (where the structure allows), preserving heading context.

    Returns list of ``{content, heading_path, headings}`` dicts (plus
    ``part``/``total_parts`` for pieces of an oversized section).
    """
    if min_chunk_size is None:
        min_chunk_size = max(50, chunk_size // 4)
    min_chunk_size = min(min_chunk_size, chunk_size)

    sections = split_by_headings(text)
    units: List[dict] = []
    for section in sections:
        content = section["content"]
        path = section.get("heading_path") or []
        if len(content) <= chunk_size:
            units.append({"content": content, "heading_path": path, "level": section["level"]})
            continue
        parts = _recursive_split(content, chunk_size, chunk_overlap)
        for i, part in enumerate(parts, 1):
            units.append({
                "content": part, "heading_path": path, "level": section["level"],
                "part": i, "total_parts": len(parts),
            })

    # Merge pass: grow small units with their following neighbours.
    chunks: List[dict] = []
    buf: Optional[dict] = None
    for unit in units:
        if buf is None:
            buf = {"units": [unit], "len": len(unit["content"])}
            continue
        if buf["len"] < min_chunk_size:
            rendered = [_render_unit(u) for u in buf["units"]] + [_render_unit(unit)]
            merged_len = len("\n\n".join(rendered))
            if merged_len <= chunk_size:
                buf["units"].append(unit)
                buf["len"] = merged_len
                continue
        chunks.append(_finalize(buf["units"]))
        buf = {"units": [unit], "len": len(unit["content"])}
    if buf is not None:
        # A tiny trailing unit is folded back into the previous chunk if it fits.
        if chunks and buf["len"] < min_chunk_size and len(buf["units"]) == 1:
            prev_units = chunks[-1]["_units"]
            rendered = [_render_unit(u) for u in prev_units + buf["units"]]
            if len("\n\n".join(rendered)) <= chunk_size:
                chunks[-1] = _finalize(prev_units + buf["units"])
                buf = None
        if buf is not None:
            chunks.append(_finalize(buf["units"]))

    for c in chunks:
        c.pop("_units", None)
    return chunks


def _finalize(units: List[dict]) -> dict:
    if len(units) == 1:
        u = units[0]
        out = {"content": u["content"], "heading_path": list(u["heading_path"]), "headings": [" > ".join(u["heading_path"])] if u["heading_path"] else []}
        if u.get("part"):
            out["part"] = u["part"]
            out["total_parts"] = u["total_parts"]
        out["_units"] = units
        return out
    paths = [u["heading_path"] for u in units]
    headings = []
    for p in paths:
        joined = " > ".join(p)
        if joined and joined not in headings:
            headings.append(joined)
    return {
        "content": "\n\n".join(_render_unit(u) for u in units),
        "heading_path": _common_prefix(paths),
        "headings": headings,
        "_units": units,
    }


def heading_paths_for_chunks(text: str, chunks: List[str]) -> List[List[str]]:
    """Heading path in effect at the start of each chunk of ``text``.

    Used for non-markdown strategies (recursive / token) so every chunk
    still gets a section prefix. Chunks are located in order; a chunk that
    cannot be located inherits the previous path.
    """
    # Offsets of headings with their full paths.
    marks: List[tuple] = []
    stack: List[tuple] = []
    offset = 0
    in_fence = False
    for line in text.split("\n"):
        if FENCE_RE.match(line):
            in_fence = not in_fence
        elif not in_fence:
            m = HEADING_RE.match(line.strip()) if line.lstrip().startswith("#") else None
            if m:
                level = len(m.group(1))
                while stack and stack[-1][0] >= level:
                    stack.pop()
                stack.append((level, m.group(2).strip()))
                marks.append((offset, [t for _, t in stack]))
        offset += len(line) + 1

    result: List[List[str]] = []
    cursor = 0
    last: List[str] = []
    for chunk in chunks:
        probe = chunk.strip()[:80]
        pos = text.find(probe, cursor) if probe else -1
        if pos == -1 and probe:
            pos = text.find(probe)
        if pos != -1:
            cursor = pos + 1
            # If the chunk starts with a heading, that heading is in effect.
            path: List[str] = []
            for mo, mp in marks:
                if mo <= pos + len(chunk) - len(chunk.lstrip()):
                    path = mp
                else:
                    break
            last = path
        result.append(list(last))
    return result


def _split_oversized(text: str, chunk_size: int, overlap: int) -> List[str]:
    parts = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            space = text.rfind(" ", start + chunk_size // 2, end)
            if space != -1:
                end = space
        parts.append(text[start:end].strip())
        start = max(end - overlap, start + 1) if end < len(text) else len(text)
    return [p for p in parts if p]

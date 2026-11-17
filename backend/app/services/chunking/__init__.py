"""Unified chunking dispatcher — picks the right strategy."""
import re
from typing import List, Optional

from app.services.chunking.markdown_splitter import split_markdown, heading_paths_for_chunks
from app.services.chunking.langchain_splitters import split_recursive, split_by_tokens

try:
    import tiktoken
    ENCODER = tiktoken.get_encoding("cl100k_base")
except Exception:  # offline / missing encoding: heuristic fallback
    ENCODER = None


def count_tokens(text: str) -> int:
    if ENCODER is None:
        return max(1, len(text) // 4) if text else 0
    return len(ENCODER.encode(text, disallowed_special=()))


_MARKER_ONLY_RE = re.compile(r"^(?:#+\s*page\s+\d+\s*)+$", re.IGNORECASE)
DEFAULT_MIN_CHUNK_CHARS = 200


def merge_small_chunks(chunks: List[str], min_chunk_size: Optional[int] = None) -> List[str]:
    """Drop marker-only chunks ("## Page 7") and fold tiny chunks into a neighbour.

    Tiny chunks carry no learnable content but still cost an LLM call and tend
    to produce junk questions.
    """
    floor = DEFAULT_MIN_CHUNK_CHARS if min_chunk_size is None else max(0, int(min_chunk_size))
    out: List[str] = []
    carry = ""
    for c in chunks:
        c = c.strip()
        if not c or _MARKER_ONLY_RE.match(c):
            continue
        if carry:
            c = carry + "\n\n" + c
            carry = ""
        if len(c) < floor:
            if out:
                out[-1] = out[-1] + "\n\n" + c
            else:
                carry = c
            continue
        out.append(c)
    if carry:
        if out:
            out[-1] = out[-1] + "\n\n" + carry
        else:
            out.append(carry)
    return out


def chunk_document(
    text: str,
    strategy: str = "recursive",
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
    min_chunk_size: Optional[int] = None,
) -> List[dict]:
    """Chunk a document and return list of
    ``{content, token_count, heading_path[, headings, part, total_parts]}`` dicts.

    Every strategy now reports the heading path in effect for each chunk,
    so the section prefix can be sent to the LLM with the chunk.
    """
    if strategy == "markdown":
        raw = split_markdown(
            text, chunk_size=chunk_size, chunk_overlap=chunk_overlap,
            min_chunk_size=min_chunk_size,
        )
        out = []
        for chunk in raw:
            item = {
                "content": chunk["content"],
                "token_count": count_tokens(chunk["content"]),
                "heading_path": chunk.get("heading_path", []),
            }
            for key in ("headings", "part", "total_parts"):
                if chunk.get(key):
                    item[key] = chunk[key]
            out.append(item)
        return out

    if strategy == "token":
        token_chunks = split_by_tokens(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        paths = heading_paths_for_chunks(text, [c["content"] for c in token_chunks])
        for c, p in zip(token_chunks, paths):
            c["heading_path"] = p
        return token_chunks

    raw_chunks = split_recursive(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    raw_chunks = merge_small_chunks(
        raw_chunks, min_chunk_size if min_chunk_size is not None else min(DEFAULT_MIN_CHUNK_CHARS, chunk_size // 4)
    )
    paths = heading_paths_for_chunks(text, raw_chunks)
    return [
        {"content": c, "token_count": count_tokens(c), "heading_path": p}
        for c, p in zip(raw_chunks, paths)
    ]


def preview_chunks(
    text: str,
    strategy: str = "recursive",
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
    preview_count: int = 3,
    min_chunk_size: Optional[int] = None,
) -> dict:
    """Preview first N chunks without persisting."""
    chunks = chunk_document(
        text, strategy=strategy, chunk_size=chunk_size,
        chunk_overlap=chunk_overlap, min_chunk_size=min_chunk_size,
    )
    return {
        "sample_chunks": [c["content"][:500] for c in chunks[:preview_count]],
        "estimated_total_chunks": len(chunks),
    }

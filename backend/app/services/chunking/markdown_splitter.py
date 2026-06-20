"""Heading-aware markdown splitter — inspired by EasyDataset's split-markdown module.

Splits markdown by headings (H1-H6), tracks heading hierarchy per chunk,
and falls back to paragraph splitting for oversized sections.
"""
import re
from typing import List

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
PARAGRAPH_RE = re.compile(r"\n\n+")


def split_by_headings(text: str) -> List[dict]:
    """Split markdown into sections based on headings. Returns list of
    {level, heading, heading_path, content} dicts."""
    if not text.strip():
        return []

    lines = text.split("\n")
    sections = []
    current_heading = None
    current_level = 0
    current_path: List[str] = []
    current_lines: List[str] = []
    has_content_before_first_heading = False

    for line in lines:
        match = HEADING_RE.match(line)
        if match:
            if current_lines or current_heading is not None:
                sections.append({
                    "level": current_level,
                    "heading": current_heading or "(preamble)",
                    "heading_path": list(current_path),
                    "content": "\n".join(current_lines).strip(),
                })

            hashes = match.group(1)
            heading_text = match.group(2)
            current_level = len(hashes)
            current_heading = heading_text
            current_path = [h for h in current_path if sections and sections[-1]["level"] < current_level or True]
            # Rebuild path: remove headings at same or deeper level
            while current_path and sections and sections[-1]["level"] >= current_level:
                # This is a simplification — we track via stack
                pass
            current_path = _rebuild_path(sections, current_level) + [heading_text]
            current_lines = []
        else:
            if current_heading is not None or line.strip():
                if current_heading is None and line.strip():
                    has_content_before_first_heading = True
                current_lines.append(line)

    if current_lines or current_heading is not None:
        sections.append({
            "level": current_level,
            "heading": current_heading or "(preamble)",
            "heading_path": list(current_path),
            "content": "\n".join(current_lines).strip(),
        })

    if has_content_before_first_heading and not sections:
        sections.append({
            "level": 0,
            "heading": "(preamble)",
            "heading_path": [],
            "content": text.strip(),
        })

    return [s for s in sections if s["content"]]


def _rebuild_path(sections: List[dict], target_level: int) -> List[str]:
    path = []
    for s in sections:
        if s["level"] < target_level and s["heading"] not in path:
            path.append(s["heading"])
    return path


def split_markdown(text: str, chunk_size: int = 1500, chunk_overlap: int = 200) -> List[dict]:
    """Split markdown into chunks, preserving heading context.
    
    Returns list of {content, heading_path, token_count} dicts.
    Heading-aware: each chunk inherits its section's heading hierarchy
    as metadata.
    """
    sections = split_by_headings(text)
    chunks = []

    for section in sections:
        content = section["content"]
        path = section.get("heading_path", [section["heading"]])

        if len(content) <= chunk_size:
            chunks.append({"content": content, "heading_path": path})
        else:
            # Oversized section — split by paragraphs
            paragraphs = PARAGRAPH_RE.split(content)
            current_chunk = ""
            for para in paragraphs:
                if len(current_chunk) + len(para) + 2 <= chunk_size:
                    current_chunk = (current_chunk + "\n\n" + para).strip()
                else:
                    if current_chunk:
                        chunks.append({"content": current_chunk, "heading_path": path})
                    # If single paragraph is oversized, split it further
                    if len(para) > chunk_size:
                        sub = _split_oversized(para, chunk_size, chunk_overlap)
                        for s in sub:
                            chunks.append({"content": s, "heading_path": path})
                        current_chunk = ""
                    else:
                        current_chunk = para
            if current_chunk:
                chunks.append({"content": current_chunk, "heading_path": path})

    return chunks


def _split_oversized(text: str, chunk_size: int, overlap: int) -> List[str]:
    parts = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        parts.append(text[start:end])
        start = end - overlap if end < len(text) else len(text)
    return parts

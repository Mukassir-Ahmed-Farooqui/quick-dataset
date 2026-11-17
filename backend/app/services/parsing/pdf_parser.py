"""PDF → Markdown parser using pdfplumber.

Besides extracting text, this strips the layout noise that otherwise turns
into junk chunks and junk questions:

* rotated / vertical text (e.g. NIST's "This publication is available free of
  charge from ..." sidebar, which pdfplumber emits one word per line);
* running headers and footers repeated across pages (document title, page
  numbers, DOI lines);
* table-of-contents lines with dot leaders ("4.1 Purpose ........ 5").

Pages that are empty after cleaning are dropped entirely.
"""
from __future__ import annotations

import io
import re
from collections import Counter

import pdfplumber

_DOT_LEADER_RE = re.compile(r"(?:\.\s?){5,}\s*(?:[A-Z]{1,3}-)?[ivxlcdm\d]+(?:-\d+)?\s*$", re.IGNORECASE)
_PAGE_NUM_RE = re.compile(r"^(?:page\s+)?(?:[ivxlcdm]+|\d+)(?:\s+of\s+\d+)?$", re.IGNORECASE)
_EDGE_LINES = 3          # lines at the top/bottom of a page checked for headers
_REPEAT_SHARE = 0.3      # a line on ≥30% of pages' edges is a running header


def _norm(line: str) -> str:
    # Digits vary between pages ("Page 3", "3 of 48"); compare without them.
    return re.sub(r"\d+", "#", line.strip().lower())


def _page_lines(page) -> list[str]:
    try:
        upright = page.filter(lambda o: o.get("object_type") != "char" or o.get("upright", True))
        text = upright.extract_text()
    except Exception:  # pragma: no cover - defensive, fall back to raw text
        text = page.extract_text()
    return [l.rstrip() for l in (text or "").split("\n")]


def clean_pages(pages: list[list[str]]) -> list[list[str]]:
    """Remove running headers/footers, page numbers and TOC dot-leader lines."""
    n = len(pages)
    edge_counts: Counter[str] = Counter()
    for lines in pages:
        nonblank = [l for l in lines if l.strip()]
        edges = set(_norm(l) for l in nonblank[:_EDGE_LINES] + nonblank[-_EDGE_LINES:])
        edge_counts.update(edges)
    threshold = max(3, int(n * _REPEAT_SHARE)) if n >= 4 else n + 1
    repeated = {k for k, c in edge_counts.items() if c >= threshold}

    cleaned: list[list[str]] = []
    for lines in pages:
        nonblank_idx = [i for i, l in enumerate(lines) if l.strip()]
        edge_idx = set(nonblank_idx[:_EDGE_LINES] + nonblank_idx[-_EDGE_LINES:])
        out = []
        for i, line in enumerate(lines):
            s = line.strip()
            if not s:
                out.append("")
                continue
            if i in edge_idx and (_norm(s) in repeated or _PAGE_NUM_RE.match(s)):
                continue
            if _DOT_LEADER_RE.search(s):
                continue
            out.append(line)
        cleaned.append(out)
    return cleaned


async def parse_pdf(file_bytes: bytes, filename: str) -> str:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        raw_pages = [_page_lines(page) for page in pdf.pages]

    parts = []
    for i, lines in enumerate(clean_pages(raw_pages), 1):
        text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
        if len(text) >= 40:  # skip blank / near-empty pages ("This page intentionally left blank")
            parts.append(f"## Page {i}\n\n{text}")
    if not parts:
        parts.append("*(No extractable text found in PDF)*")
    return "\n\n".join(parts)

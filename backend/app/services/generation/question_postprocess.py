"""
Question post-processing: parse, clean, filter, and de-duplicate.

Applied to every batch of LLM-generated questions before they are saved:

- :func:`parse_questions_output` — JSON array first (via the shared
  extractor), falling back to line / numbered-list parsing.
- :func:`clean_question` — strips numbering, quotes, and the
  "According to the text, ..." style lead-ins the prompt forbids, then
  rejects questions that are too short, about document meta
  (author, chapter, table of contents, "this passage" ...), or that do
  not read as a question at all (refusals / chatter).
- :func:`dedupe_questions` — exact duplicates on a normalized form plus
  near-duplicates via token-set Jaccard and difflib ratio.
- :func:`random_remove_question_mark` — Easy Dataset's optional
  augmentation (questionMaskRemovingProbability); OFF by default here.
"""

from __future__ import annotations

import random
import re
import string
from difflib import SequenceMatcher
from typing import Iterable, Optional

from app.services.generation.json_utils import extract_json

MIN_QUESTION_CHARS = 12
MIN_QUESTION_WORDS = 3
MAX_QUESTION_CHARS = 600
NEAR_DUP_RATIO = 0.88
NEAR_DUP_JACCARD = 0.85

# Lead-in phrases the prompt forbids. Stripped when they are a removable
# prefix; if the question still refers to "the text" afterwards it is dropped.
_LEADIN_RE = re.compile(
    r"^\s*(?:according to|based on|as (?:described|stated|mentioned|discussed|explained) in|"
    r"in|from|per)\s+(?:the|this)\s+"
    r"(?:given\s+|provided\s+|above\s+)?"
    r"(?:text|passage|article|document|report|excerpt|content|material|section|paragraph|chapter|literature|table|context|source)"
    r"\s*[,:]?\s*",
    re.IGNORECASE,
)

_META_PATTERNS = [
    r"\b(?:the|this)\s+(?:given\s+|provided\s+|above\s+)?(?:text|passage|article|document|report|excerpt|paragraph|literature)\b",
    r"\bwho\s+(?:is|was)\s+the\s+author\b",
    r"\bthe\s+author(?:s)?\s+(?:of|say|says|state|states|argue|argues|mention|mentions|believe|believes)\b",
    r"\b(?:which|what)\s+(?:chapter|section|page|heading)\b",
    r"\btable\s+of\s+contents\b",
    r"\bwhat\s+is\s+the\s+title\s+of\b",
    r"\b(?:mentioned|discussed|described|stated)\s+(?:in|by)\s+the\s+(?:text|passage|article|document|author|report)\b",
]
_META_RE = re.compile("|".join(_META_PATTERNS), re.IGNORECASE)

# A kept item must actually read as a question: either it ends with a
# question mark, or it opens with an interrogative / question-style
# imperative. This rejects refusals and chatter such as
# "Sorry, I cannot help with that." that would otherwise pass the
# length checks.
_QUESTION_START_RE = re.compile(
    r"^(?:what|whats|what's|how|why|when|where|which|who|whom|whose|"
    r"is|are|was|were|am|do|does|did|can|could|should|would|will|shall|may|might|must|"
    r"has|have|had|in\s+what|to\s+what|under\s+what|for\s+what|by\s+how|"
    r"explain|describe|compare|contrast|list|identify|outline|summarize|summarise|define|discuss)\b",
    re.IGNORECASE,
)


def looks_like_question(text: str) -> bool:
    t = text.strip()
    if t.endswith(("?", "？")):
        return True
    return bool(_QUESTION_START_RE.match(t))


_NUMBERING_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*\d*\s*[:.)-]|\d+\s*[.)\]、:-]|[-*•+]\s+)\s*", re.IGNORECASE)
_PUNCT_TABLE = str.maketrans({c: " " for c in string.punctuation + "？。，、；：“”‘’（）"})


def normalize_question(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace — the dedupe key."""
    return " ".join(text.lower().translate(_PUNCT_TABLE).split())


def is_meta_question(text: str) -> bool:
    return bool(_META_RE.search(text))


def clean_question(raw: object) -> Optional[str]:
    """Return a cleaned question string, or ``None`` if it should be dropped."""
    if isinstance(raw, dict):
        raw = raw.get("question") or raw.get("text") or ""
    if not isinstance(raw, str):
        return None
    q = raw.strip().strip("\"'`").strip()
    q = _NUMBERING_RE.sub("", q).strip().strip("\"'`").strip()
    q = re.sub(r"\s+", " ", q)

    # Strip forbidden lead-ins ("According to the text, what ...")
    stripped = _LEADIN_RE.sub("", q)
    if stripped != q and stripped:
        q = stripped[0].upper() + stripped[1:]

    if len(q) < MIN_QUESTION_CHARS or len(q.split()) < MIN_QUESTION_WORDS:
        return None
    if len(q) > MAX_QUESTION_CHARS:
        return None
    if is_meta_question(q):
        return None
    if not looks_like_question(q):
        return None
    return q


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def is_near_duplicate(a_norm: str, b_norm: str) -> bool:
    if a_norm == b_norm:
        return True
    ta, tb = set(a_norm.split()), set(b_norm.split())
    if _jaccard(ta, tb) >= NEAR_DUP_JACCARD:
        return True
    # Cheap length guard before the O(n*m) ratio
    la, lb = len(a_norm), len(b_norm)
    if min(la, lb) / max(la, lb, 1) < 0.6:
        return False
    return SequenceMatcher(None, a_norm, b_norm).ratio() >= NEAR_DUP_RATIO


def dedupe_questions(
    questions: Iterable[str],
    existing: Iterable[str] = (),
) -> list[str]:
    """Remove exact and near-duplicate questions, preserving order.

    ``existing`` are questions already stored (e.g. from an earlier run on
    the same chunk); new questions duplicating them are dropped too.
    """
    kept: list[str] = []
    seen_norms: list[str] = [normalize_question(e) for e in existing if e]
    seen_exact = set(seen_norms)
    for q in questions:
        n = normalize_question(q)
        if not n or n in seen_exact:
            continue
        if any(is_near_duplicate(n, s) for s in seen_norms):
            continue
        kept.append(q)
        seen_norms.append(n)
        seen_exact.add(n)
    return kept


def random_remove_question_mark(
    questions: list[str],
    probability: float,
    rng: Optional[random.Random] = None,
) -> list[str]:
    """Easy Dataset augmentation: drop the trailing '?' with ``probability`` (0-1)."""
    if not probability or probability <= 0:
        return list(questions)
    rng = rng or random.Random()
    out = []
    for q in questions:
        if q.endswith(("?", "？")) and rng.random() < probability:
            q = q[:-1]
        out.append(q)
    return out


def _fallback_line_parse(text: str) -> list[str]:
    body = re.sub(r"```[a-zA-Z]*", "", text)
    out: list[str] = []
    for line in body.split("\n"):
        line = line.strip().rstrip(",")
        if not line or line in ("[", "]"):
            continue
        line = _NUMBERING_RE.sub("", line).strip().strip("\"'").strip()
        if "?" in line and not line.endswith("?"):
            line = line[: line.rfind("?") + 1]
        if line:
            out.append(line)
    return out


def parse_questions_output(raw_output: Optional[str]) -> list[str]:
    """Parse raw LLM output into raw question strings (not yet cleaned)."""
    if not raw_output:
        return []
    data = extract_json(raw_output, expect=list)
    if isinstance(data, list):
        items: list[str] = []
        for d in data:
            if isinstance(d, str):
                items.append(d)
            elif isinstance(d, dict):
                v = d.get("question") or d.get("text")
                if isinstance(v, str):
                    items.append(v)
        if items:
            return items
    return _fallback_line_parse(raw_output)


def postprocess_questions(
    raw_output: Optional[str],
    *,
    limit: Optional[int] = None,
    existing: Iterable[str] = (),
    question_mark_removal_probability: float = 0.0,
    rng: Optional[random.Random] = None,
) -> list[str]:
    """Full pipeline for one LLM response: parse -> clean -> dedupe -> cap -> augment."""
    cleaned = [c for c in (clean_question(q) for q in parse_questions_output(raw_output)) if c]
    unique = dedupe_questions(cleaned, existing=existing)
    if limit is not None and limit > 0:
        unique = unique[:limit]
    return random_remove_question_mark(unique, question_mark_removal_probability, rng)

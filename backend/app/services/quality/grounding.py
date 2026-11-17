"""Cheap, local grounding check: is the answer stated in its source chunk?

No model, no network, no tokens. It catches the failure an LLM judge kept
missing: an answer that introduces names, expansions, numbers or terms the
source never mentions (e.g. expanding "MS-ISAC" to a made-up name).
"""
from __future__ import annotations

import re

_STOP = set("""a an the and or of to in on for by with from as at is are was were be been being this that these those it its
which what who whom whose when where why how than then there their they them such into also may can must should would could
will not no nor only other any each all both more most some very about over under after before between during through within
without upon including include includes used use using based per via e.g i.e etc one two three four five six""".split())

_WORD = re.compile(r"[A-Za-z][A-Za-z0-9\-']+|\d+(?:\.\d+)?")
_PROPER = re.compile(r"\b(?:[A-Z][a-z]+(?:\s+(?:and|of|for|the|&)\s+|\s+)){1,}[A-Z][a-z]+\b")


def _norm(t: str) -> str:
    t = t.lower().replace("\u2011", "-").replace("\u2010", "-").replace("\u2013", "-")
    for suf in ("ies", "es", "s", "ing", "ed"):
        if len(t) > 5 and t.endswith(suf):
            return t[: -len(suf)]
    return t


def grounding_report(answer: str, source: str, question: str = "") -> dict:
    src = source or ""
    src_words = {_norm(w) for w in _WORD.findall(src)}
    q_words = {_norm(w) for w in _WORD.findall(question or "")}
    content = [w for w in _WORD.findall(answer or "") if w.lower() not in _STOP and len(w) > 3 or w.isdigit()]
    if not content:
        return {"support": 1.0, "unsupported_terms": [], "unsupported_phrases": []}
    missing = [w for w in content if _norm(w) not in src_words and _norm(w) not in q_words]
    support = 1 - len(missing) / len(content)
    src_flat = re.sub(r"\s+", " ", src.replace("\u2011", "-")).lower()
    phrases = []
    for m in _PROPER.finditer(answer or ""):
        ph = re.sub(r"\s+", " ", m.group(0))
        if ph.lower() not in src_flat and ph.lower() not in (question or "").lower():
            phrases.append(ph)
    nums = [n for n in re.findall(r"\b\d+(?:\.\d+)?\b", answer or "") if n not in src and n not in (question or "")]
    return {
        "support": round(support, 3),
        "unsupported_terms": sorted(set(missing))[:20],
        "unsupported_phrases": phrases[:10],
        "unsupported_numbers": nums[:10],
    }


def is_grounded(report: dict, min_support: float = 0.5) -> bool:
    return (
        report["support"] >= min_support
        and not report["unsupported_phrases"]
        and not report.get("unsupported_numbers")
    )

"""
Question-count planning.

Two modes:

``auto`` (new default)
    Like Easy Dataset's ``questionGenerationLength``: each chunk gets
    ``floor(len(chunk) / chars_per_question)`` questions (min 1, capped at
    ``max_questions_per_chunk``). Those questions are then *distributed*
    across Genre/Audience pairs instead of multiplying by every pair:

    - pairs generated for the chunk's own document are preferred
      (falling back to all selected pairs when the document has none);
    - each LLM call asks for at least ``min_per_call`` questions, so a
      short chunk uses one or two pairs rather than all of them;
    - pairs rotate across chunks (offset by chunk position) so every pair
      gets coverage over the whole document.

``per_combination`` (legacy)
    The original full cross product: every chunk x every GA pair x
    ``questions_per_combination`` questions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

DEFAULT_CHARS_PER_QUESTION = 240
DEFAULT_MAX_QUESTIONS_PER_CHUNK = 10
DEFAULT_MIN_PER_CALL = 2


@dataclass(frozen=True)
class ChunkInfo:
    id: str
    document_id: Optional[str]
    length: int  # characters of chunk content (without context prefix)


@dataclass(frozen=True)
class GAInfo:
    id: Optional[str]
    document_id: Optional[str]


@dataclass(frozen=True)
class QuestionJob:
    chunk_id: str
    ga_pair_id: Optional[str]
    count: int


def questions_for_length(
    length: int,
    chars_per_question: int = DEFAULT_CHARS_PER_QUESTION,
    max_per_chunk: int = DEFAULT_MAX_QUESTIONS_PER_CHUNK,
) -> int:
    chars_per_question = max(1, int(chars_per_question))
    n = int(length) // chars_per_question
    n = max(1, n)
    if max_per_chunk and max_per_chunk > 0:
        n = min(n, int(max_per_chunk))
    return n


def _split_even(total: int, parts: int) -> list[int]:
    base, rem = divmod(total, parts)
    return [base + (1 if i < rem else 0) for i in range(parts)]


def plan_question_jobs(
    chunks: Sequence[ChunkInfo],
    ga_pairs: Sequence[GAInfo],
    *,
    mode: str = "auto",
    questions_per_combination: int = 1,
    chars_per_question: int = DEFAULT_CHARS_PER_QUESTION,
    max_questions_per_chunk: int = DEFAULT_MAX_QUESTIONS_PER_CHUNK,
    min_per_call: int = DEFAULT_MIN_PER_CALL,
) -> list[QuestionJob]:
    """Return the list of LLM calls (one job = one call) to make."""
    pairs = list(ga_pairs) or [GAInfo(id=None, document_id=None)]

    if mode == "per_combination":
        q = max(1, int(questions_per_combination))
        return [QuestionJob(c.id, p.id, q) for c in chunks for p in pairs]

    min_per_call = max(1, int(min_per_call))
    jobs: list[QuestionJob] = []
    rotation: dict[Optional[str], int] = {}
    for chunk in chunks:
        total = questions_for_length(chunk.length, chars_per_question, max_questions_per_chunk)
        own = [p for p in pairs if p.document_id and p.document_id == chunk.document_id]
        candidates = own or pairs
        key = chunk.document_id if own else None
        n_pairs = max(1, min(len(candidates), total // min_per_call))
        offset = rotation.get(key, 0)
        chosen = [candidates[(offset + i) % len(candidates)] for i in range(n_pairs)]
        rotation[key] = (offset + n_pairs) % len(candidates)
        for pair, count in zip(chosen, _split_even(total, n_pairs)):
            if count > 0:
                jobs.append(QuestionJob(chunk.id, pair.id, count))
    return jobs


def resolve_mode(
    question_count_mode: Optional[str],
    questions_per_combination_explicit: bool,
) -> str:
    """Pick the planning mode for a request.

    An explicit ``question_count_mode`` wins. Otherwise, passing
    ``questions_per_combination`` explicitly keeps the legacy cross product
    (backward compatible); omitting it uses ``auto``.
    """
    if question_count_mode in ("auto", "per_combination"):
        return question_count_mode
    return "per_combination" if questions_per_combination_explicit else "auto"

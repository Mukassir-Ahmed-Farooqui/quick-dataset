"""
Answer Generator — generates answers for questions, creating dataset items.

Pipeline (Easy Dataset logic, see lib/services/datasets/index.js):
    resolve_llm_config() -> snapshot questions/chunks/GA pairs
    -> LLMRunner (concurrent tracked_complete) per question:
         answer  ->  [chain of thought: <think> or cot_synthesis call]
                 ->  [optional LLM judge: evaluation prompt]
    -> DatasetItem rows + questions marked answered (bulk, per flush)

- Prompts are grounded: chunk content with its section prefix, token-aware
  truncation, and the genre/audience guidance block when the question was
  generated for a GA pair. ``{output_format}`` carries the per-dataset-type
  output instruction (appended when a custom prompt lacks the placeholder).
- LLM calls run concurrently in worker coroutines that never touch the
  Session. Every DB write (items, answered flags, usage logs, progress)
  happens in the single consuming coroutine (``on_result`` / ``on_flush``).
- MCQ output is validated strictly: the correct answer must map to exactly
  one option; anything ambiguous or out of range is rejected, never
  silently replaced by the first option.

Supported dataset types:
- qa:             {"question", "answer"}
- mcq:            {"question", "options", "correct_answer"}
- classification: {"text", "label"}
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session, joinedload

from app.models import (
    AnswerType,
    Chunk,
    CotSource,
    DatasetItem,
    DatasetType,
    GAPair,
    GenerationRunType,
    PromptType,
    Question,
    TaskType,
)
from app.repositories.question_repository import QuestionRepository
from app.repositories.task_repository import TaskRepository
from app.services.generation.context import (
    build_chunk_context,
    ga_values,
    render_ga_answer_block,
    render_prompt,
)
from app.services.generation.generation_run_service import GenerationRunService
from app.services.generation.json_utils import extract_json, split_think
from app.services.generation.llm_runner import LLMRunner
from app.services.generation.resolver import default_model_for, resolve_llm_config_with_model
from app.services.prompts.prompt_service import PromptService

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TEMPERATURE = 0.3   # answers should be faithful, not creative
JUDGE_TEMPERATURE = 0.0
JUDGE_SCALE = 5.0           # the default evaluation prompt scores 0-5
PARSE_RETRIES = 1           # re-ask once when the output is unusable
MAX_CONTEXT_TOKENS = 6000   # token-aware cap on chunk text sent to the LLM
MAX_ERROR_LOG = 50
MAX_RETRIES = 2             # kept for backward compatibility (unused; LLMRunner retries)


# ── Repository (used by api/dataset_items.py and api/exports.py) ─────

class DatasetItemRepository:
    """Simple repository for dataset_items operations."""

    def __init__(self, db: Session):
        self.db = db

    def bulk_create(self, items: list[DatasetItem]) -> list[DatasetItem]:
        self.db.add_all(items)
        self.db.commit()
        for item in items:
            self.db.refresh(item)
        return items

    def bulk_delete(self, project_id: str, ids: list[str]) -> int:
        count = (
            self.db.query(DatasetItem)
            .filter(
                DatasetItem.id.in_(ids),
                DatasetItem.project_id == project_id,
                DatasetItem.deleted_at.is_(None),
            )
            .update({"deleted_at": datetime.utcnow()}, synchronize_session=False)
        )
        self.db.commit()
        return count

    def bulk_confirm(self, project_id: str, ids: list[str], confirmed: bool) -> int:
        count = (
            self.db.query(DatasetItem)
            .filter(
                DatasetItem.id.in_(ids),
                DatasetItem.project_id == project_id,
                DatasetItem.deleted_at.is_(None),
            )
            .update({"confirmed": confirmed}, synchronize_session=False)
        )
        self.db.commit()
        return count

    def _filtered(self, q, project_id, dataset_type, confirmed, min_score, generation_run_id):
        q = q.filter(DatasetItem.project_id == project_id, DatasetItem.deleted_at.is_(None))
        if dataset_type:
            q = q.filter(DatasetItem.dataset_type == dataset_type)
        if confirmed is not None:
            q = q.filter(DatasetItem.confirmed == confirmed)
        if min_score is not None:
            q = q.filter(DatasetItem.score >= min_score)
        if generation_run_id:
            q = q.filter(DatasetItem.generation_run_id == generation_run_id)
        return q

    def list_items(
        self,
        project_id: str,
        *,
        dataset_type: Optional[str] = None,
        confirmed: Optional[bool] = None,
        min_score: Optional[float] = None,
        generation_run_id: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[DatasetItem]:
        q = self.db.query(DatasetItem).options(
            joinedload(DatasetItem.source_document),
            joinedload(DatasetItem.source_chunk),
        )
        q = self._filtered(q, project_id, dataset_type, confirmed, min_score, generation_run_id)
        return q.order_by(DatasetItem.created_at.desc()).offset(skip).limit(limit).all()

    def count_items(
        self,
        project_id: str,
        *,
        dataset_type: Optional[str] = None,
        confirmed: Optional[bool] = None,
        min_score: Optional[float] = None,
        generation_run_id: Optional[str] = None,
    ) -> int:
        from sqlalchemy import func
        q = self.db.query(func.count(DatasetItem.id))
        q = self._filtered(q, project_id, dataset_type, confirmed, min_score, generation_run_id)
        return q.scalar() or 0

    def get_item(self, project_id: str, item_id: str) -> Optional[DatasetItem]:
        return (
            self.db.query(DatasetItem)
            .filter(
                DatasetItem.id == item_id,
                DatasetItem.project_id == project_id,
                DatasetItem.deleted_at.is_(None),
            )
            .first()
        )

    def update_item(self, project_id: str, item_id: str, **kwargs) -> Optional[DatasetItem]:
        q = self.get_item(project_id, item_id)
        if not q:
            return None
        for k, v in kwargs.items():
            setattr(q, k, v)
        self.db.commit()
        self.db.refresh(q)
        return q

    def get_exportable_items(
        self,
        project_id: str,
        *,
        confirmed: Optional[bool] = True,
        min_score: Optional[float] = None,
        generation_run_id: Optional[str] = None,
    ) -> list[DatasetItem]:
        q = self._filtered(self.db.query(DatasetItem), project_id, None, confirmed, min_score, generation_run_id)
        return q.order_by(DatasetItem.created_at.asc()).all()


# ── Output-format instructions ({output_format}) ─────────────────────

OUTPUT_FORMATS: dict[DatasetType, str] = {
    DatasetType.qa: (
        "6. Output only the final answer text in plain prose (lists are fine). "
        "No preface, no title, no JSON, no markdown headings."
    ),
    DatasetType.mcq: (
        "6. This is a multiple-choice item. Write exactly 4 answer options for the question: "
        "one correct option fully supported by the reference content and three plausible but "
        "clearly incorrect distractors of similar length and style. Only one option may be correct.\n"
        "7. Return ONLY a JSON object, no markdown fences or other text:\n"
        '{"options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct_answer": "B", '
        '"explanation": "One sentence on why B is correct, based on the reference content."}\n'
        '"correct_answer" is the letter of the correct option.'
    ),
    DatasetType.classification: (
        "6. This is a classification item: assign the text given as the Question a short category "
        "label (1-5 words) that is supported by the reference content.\n"
        '7. Return ONLY a JSON object, no markdown fences or other text: {"label": "..."}'
    ),
}


def output_format_for(dataset_type: DatasetType) -> str:
    return OUTPUT_FORMATS.get(dataset_type, "")


def build_answer_prompt(
    template: str,
    *,
    question: str,
    chunk_text: str,
    chunk_metadata: Optional[dict],
    ga_pair: Optional[dict],
    dataset_type: DatasetType,
    max_context_tokens: int = MAX_CONTEXT_TOKENS,
) -> str:
    """Render the answer prompt for one question."""
    content = build_chunk_context(chunk_text, chunk_metadata, max_tokens=max_context_tokens)
    genre, audience = ga_values(ga_pair)
    ga_block = render_ga_answer_block(genre, audience)
    fmt = output_format_for(dataset_type)
    prompt = render_prompt(template, {
        "content": content,
        "text": content,
        "question": question,
        "ga_prompt": ga_block,
        "gaPrompt": ga_block,
        "templatePrompt": "",
        "output_format": fmt,
        "outputFormatPrompt": fmt,
    })
    if fmt and "output_format" not in template and "outputFormatPrompt" not in template:
        # Custom prompt without the placeholder: the format instruction is
        # essential for mcq/classification parsing, so append it.
        prompt = prompt.rstrip() + "\n\n## Output Format:\n" + fmt + "\n"
    return prompt


# ── Markdown cleanup ─────────────────────────────────────────────────

_FENCE_BLOCK_RE = re.compile(r"(```[\s\S]*?```|~~~[\s\S]*?~~~)")
_INLINE_CODE_RE = re.compile(r"(`[^`\n]+`)")
_HEADER_RE = re.compile(r"^(#{1,6})\s+", flags=re.MULTILINE)
_BULLET_RE = re.compile(r"^[\-\*\+]\s+", flags=re.MULTILINE)
# Emphasis markers only when they wrap text and are not part of a word, so
# snake_case_names, 2*3*4 and file_name.py survive intact.
_BOLD_STAR_RE = re.compile(r"(?<![\w*])\*\*(?=\S)(.+?)(?<=\S)\*\*(?![\w*])")
# ``__x__`` is only bold when it is not a bare identifier (``__init__``).
_BOLD_UNDER_RE = re.compile(r"(?<![\w_])__(?=\S)(?!\w+__(?![\w_]))(.+?)(?<=\S)__(?![\w_])")
_ITALIC_STAR_RE = re.compile(r"(?<![\w*])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?![\w*])")
_ITALIC_UNDER_RE = re.compile(r"(?<![\w_])_(?=[^\s_])([^_\n]+?)(?<=[^\s_])_(?![\w_])")


def _clean_prose(text: str) -> str:
    # Protect inline code spans.
    parts = _INLINE_CODE_RE.split(text)
    for i in range(0, len(parts), 2):
        seg = parts[i]
        seg = _HEADER_RE.sub("", seg)
        seg = _BOLD_STAR_RE.sub(r"\1", seg)
        seg = _BOLD_UNDER_RE.sub(r"\1", seg)
        seg = _BULLET_RE.sub("", seg)
        seg = _ITALIC_STAR_RE.sub(r"\1", seg)
        seg = _ITALIC_UNDER_RE.sub(r"\1", seg)
        parts[i] = seg
    return "".join(parts)


def _clean_markdown(text: str) -> str:
    """Strip markdown headers, bullets and emphasis markers without touching
    code blocks, inline code or identifiers like ``snake_case``."""
    if not text:
        return ""
    pieces = _FENCE_BLOCK_RE.split(text)
    for i in range(0, len(pieces), 2):
        pieces[i] = _clean_prose(pieces[i])
    out = "".join(pieces)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


# ── Payload parsing / validation ─────────────────────────────────────

class PayloadError(ValueError):
    """The LLM output could not be turned into a valid payload."""


_OPTION_LABEL_RE = re.compile(r"^\s*\(?([A-Za-z])\s*[\.\):：]\s+")
_LETTER_ONLY_RE = re.compile(
    r"^\s*(?:(?:the\s+)?(?:correct\s+)?(?:option|answer|choice)\s*(?:is)?\s*[:：]?\s*)?"
    r"\(?([A-Za-z])\)?\s*[\.\):]?\s*$",
    flags=re.IGNORECASE,
)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s)).strip().strip(".").strip().casefold()


def _normalize_options(raw: Any) -> list[str]:
    if isinstance(raw, dict):
        items = [raw[k] for k in sorted(raw, key=lambda k: str(k))]
    elif isinstance(raw, list):
        items = raw
    else:
        raise PayloadError("MCQ output has no options list")
    options: list[str] = []
    for o in items:
        if isinstance(o, dict):
            o = o.get("text") or o.get("option") or o.get("content")
        if not isinstance(o, (str, int, float)) or isinstance(o, bool):
            raise PayloadError("MCQ option is not text")
        options.append(str(o).strip())
    # Strip "A. " / "B) " / "(C) " labels only when every option carries the
    # expected sequential label.
    labels = [_OPTION_LABEL_RE.match(o) for o in options]
    if options and all(
        m and m.group(1).upper() == chr(ord("A") + i) for i, m in enumerate(labels)
    ):
        options = [o[m.end():].strip() for o, m in zip(options, labels)]
    if len(options) < 2:
        raise PayloadError("MCQ output needs at least 2 options")
    if any(not o for o in options):
        raise PayloadError("MCQ output has an empty option")
    if len({_norm(o) for o in options}) != len(options):
        raise PayloadError("MCQ output has duplicate options")
    return options


def _answer_index(value: Any, options: list[str]) -> int:
    """Map one correct-answer field to an option index, or raise."""
    n = len(options)
    if isinstance(value, bool):
        raise PayloadError("MCQ correct answer is not a valid option")
    if isinstance(value, int):
        if 0 <= value < n:
            return value
        raise PayloadError(f"MCQ correct answer index {value} is out of range")
    if isinstance(value, list):
        if len(value) != 1:
            raise PayloadError("MCQ output must have exactly one correct answer")
        value = value[0]
    if not isinstance(value, str) or not value.strip():
        raise PayloadError("MCQ output has no correct answer")
    text = value.strip()
    target = _norm(text)
    exact = [i for i, o in enumerate(options) if _norm(o) == target]
    if len(exact) == 1:
        return exact[0]
    m = _LETTER_ONLY_RE.match(text)
    if m:
        idx = ord(m.group(1).upper()) - ord("A")
        if 0 <= idx < n:
            return idx
        raise PayloadError(f"MCQ correct answer letter {m.group(1).upper()} is out of range")
    m = _OPTION_LABEL_RE.match(text)
    if m:
        idx = ord(m.group(1).upper()) - ord("A")
        rest = _norm(text[m.end():])
        if 0 <= idx < n and _norm(options[idx]) == rest:
            return idx
        raise PayloadError("MCQ correct answer letter and text do not match the same option")
    raise PayloadError("MCQ correct answer does not match any option")


def parse_mcq(raw_output: str) -> tuple[list[str], int, dict]:
    """Parse and strictly validate MCQ output. Returns (options, index, extra)."""
    data = extract_json(raw_output, expect=dict)
    if not isinstance(data, dict):
        raise PayloadError("MCQ output is not a JSON object")
    options = _normalize_options(data.get("options", data.get("choices")))
    fields = [
        data[k] for k in (
            "correct_answer", "answer", "correct_option", "correct_letter",
            "answer_letter", "correct_index",
        )
        if k in data and data[k] not in (None, "")
    ]
    if not fields:
        raise PayloadError("MCQ output has no correct answer")
    indices = {_answer_index(v, options) for v in fields}
    if len(indices) != 1:
        raise PayloadError("MCQ output gives conflicting correct answers")
    extra = {}
    if isinstance(data.get("explanation"), str) and data["explanation"].strip():
        extra["explanation"] = data["explanation"].strip()
    return options, indices.pop(), extra


def _parse_label(text: str) -> str:
    data = extract_json(text, expect=dict) if "{" in text else None
    if isinstance(data, dict):
        label = data.get("label") or data.get("category") or data.get("class")
        if isinstance(label, str) and label.strip():
            return label.strip()[:200]
        raise PayloadError("Classification output has no label")
    if data is not None or text.strip().startswith("{"):
        raise PayloadError("Classification output is not a valid JSON object")
    cleaned = _clean_markdown(text)
    if not cleaned:
        raise PayloadError("Classification output is empty")
    first = cleaned.split("\n", 1)[0].strip()
    m = re.match(r"^\s*(?:label|category|class)\s*[:：]\s*(.+)$", first, flags=re.IGNORECASE)
    label = (m.group(1) if m else first).strip().strip("\"'").strip()
    if not label:
        raise PayloadError("Classification output is empty")
    return label[:200]


# Answers are training targets for a model that never sees the source, so
# "The text explains that ..." teaches it to cite an invisible document.
_REFERENTIAL_LEADIN_RE = re.compile(
    r"(?:(?<=^)|(?<=[.!?]\s)|(?<=\n))\s*"
    r"(?:according\s+to|based\s+on|as\s+(?:stated|described|noted|explained|mentioned)\s+in|per)\s+"
    r"(?:the|this)\s+(?:provided\s+|given\s+|reference\s+)?"
    r"(?:text|source|passage|document|reference(?:\s+content)?|excerpt|entry|content|guide|publication)\s*,\s*"
    r"|(?:(?<=^)|(?<=[.!?]\s)|(?<=\n))\s*"
    r"(?:the|this)\s+(?:text|source|passage|document|reference|excerpt|entry|content)\s+"
    r"(?:explains|states|notes|says|indicates|mentions|describes|shows)\s+(?:that\s+)?",
    re.IGNORECASE,
)


def strip_referential_leadins(text: str) -> str:
    out = _REFERENTIAL_LEADIN_RE.sub(" ", text)
    # Re-capitalise sentence starts that lost their lead-in.
    out = re.sub(r"(^|[.!?]\s+|\n)\s*([a-z])", lambda m: m.group(1) + m.group(2).upper(), out.strip())
    return re.sub(r"[ \t]{2,}", " ", out).strip()


def _parse_qa(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("{") or stripped.startswith("```"):
        data = extract_json(stripped, expect=dict)
        if isinstance(data, dict) and isinstance(data.get("answer"), str):
            stripped = data["answer"]
    answer = strip_referential_leadins(_clean_markdown(stripped))
    if not answer:
        raise PayloadError("Empty answer")
    return answer


def build_payload(dataset_type: DatasetType, raw_output: str, question_text: str) -> tuple[dict, dict]:
    """Build ``(payload, extra_metadata)`` for a dataset type. Raises PayloadError."""
    answer_text, _think = split_think(raw_output or "")
    if dataset_type == DatasetType.qa:
        return {"question": question_text, "answer": _parse_qa(answer_text)}, {}
    if dataset_type == DatasetType.mcq:
        options, idx, extra = parse_mcq(answer_text)
        extra["correct_option"] = chr(ord("A") + idx)
        return {"question": question_text, "options": options, "correct_answer": options[idx]}, extra
    if dataset_type == DatasetType.classification:
        return {"text": question_text, "label": _parse_label(answer_text)}, {}
    raise PayloadError(f"Dataset type '{getattr(dataset_type, 'value', dataset_type)}' is not supported by answer generation")


def _build_payload(dataset_type: DatasetType, raw_output: str, question_text: str) -> Optional[dict]:
    """Backward-compatible wrapper: payload or None when invalid."""
    try:
        return build_payload(dataset_type, raw_output, question_text)[0]
    except PayloadError:
        return None


def answer_text_of(dataset_type: DatasetType, payload: dict) -> str:
    """The answer as plain text, for CoT synthesis and the judge."""
    if dataset_type == DatasetType.mcq:
        opts = "\n".join(f"{chr(ord('A') + i)}. {o}" for i, o in enumerate(payload["options"]))
        idx = payload["options"].index(payload["correct_answer"])
        return f"Options:\n{opts}\nCorrect answer: {chr(ord('A') + idx)}. {payload['correct_answer']}"
    if dataset_type == DatasetType.classification:
        return payload.get("label", "")
    return payload.get("answer", "")


# ── CoT + judge parsing ──────────────────────────────────────────────

_COT_PREFACE_RE = re.compile(
    r"^\s*(?:#+\s*)?(?:optimi[sz]ed\s+)?(?:chain[\s-]of[\s-]thought|reasoning|cot)\s*[:：]?\s*\n?",
    flags=re.IGNORECASE,
)


def clean_cot(raw: str) -> str:
    answer, think = split_think(raw or "")
    text = answer or think
    text = _COT_PREFACE_RE.sub("", text, count=1)
    return text.strip()


_SCORE_KEYS = ("score", "overall_score", "final_score", "rating", "overall")
_EVAL_KEYS = ("evaluation", "reason", "explanation", "feedback", "comment")
_NUM = r"(-?[0-9]+(?:\.[0-9]+)?)"
_SCORE_FIELD_RE = re.compile(r"score\W{0,3}[:=]\s*\"?" + _NUM + r"(?:\s*/\s*" + _NUM + r")?", re.IGNORECASE)
_RATIO_RE = re.compile(_NUM + r"\s*(?:/|out of)\s*(5|10|100)\b", re.IGNORECASE)


def _normalize_score(value: float, denominator: Optional[float], scale: float) -> Optional[float]:
    if denominator:
        norm = value / denominator
    elif value <= scale:
        norm = value / scale
    elif value <= 10:
        norm = value / 10
    elif value <= 100:
        norm = value / 100
    else:
        return None
    return round(max(0.0, min(1.0, norm)), 4)


def parse_judge_output(raw: str, scale: float = JUDGE_SCALE) -> tuple[Optional[float], Optional[float], str]:
    """Parse an evaluation response.

    Returns ``(normalized_0_1, raw_score, evaluation_text)``; the scores are
    ``None`` when no score could be found.
    """
    body, _ = split_think(raw or "")
    data = extract_json(body, expect=dict)
    raw_score: Optional[float] = None
    denominator: Optional[float] = None
    evaluation = ""
    if isinstance(data, dict):
        for k in _EVAL_KEYS:
            if isinstance(data.get(k), str):
                evaluation = data[k].strip()
                break
        for k in _SCORE_KEYS:
            v = data.get(k)
            if isinstance(v, bool) or v is None:
                continue
            if isinstance(v, (int, float)):
                raw_score = float(v)
            elif isinstance(v, str):
                m = re.match(r"\s*" + _NUM + r"(?:\s*/\s*" + _NUM + r")?", v)
                if m:
                    raw_score = float(m.group(1))
                    denominator = float(m.group(2)) if m.group(2) else None
            if raw_score is not None:
                break
        for k in ("max_score", "scale", "out_of"):
            if denominator is None and isinstance(data.get(k), (int, float)) and not isinstance(data.get(k), bool) and data[k] > 0:
                denominator = float(data[k])
    if raw_score is None:
        m = _SCORE_FIELD_RE.search(body) or _RATIO_RE.search(body)
        if m:
            raw_score = float(m.group(1))
            denominator = float(m.group(2)) if m.lastindex and m.lastindex >= 2 and m.group(2) else None
    if not evaluation:
        evaluation = body.strip()[:1000] if not isinstance(data, dict) else ""
    if raw_score is None or raw_score < 0:
        return None, raw_score, evaluation
    return _normalize_score(raw_score, denominator, scale), raw_score, evaluation


# ── Entry point ──────────────────────────────────────────────────────

async def generate_answers(
    db: Session,
    project_id: str,
    user_id: str,
    question_ids: list[str],
    *,
    dataset_type: DatasetType = DatasetType.qa,
    llm_key_id: Optional[str] = None,
    model: Optional[str] = DEFAULT_MODEL,
    temperature: Optional[float] = None,
    max_tokens: int = 2048,
    existing_run_id: Optional[str] = None,
    existing_task_id: Optional[str] = None,
    include_cot: bool = False,
    evaluate: bool = False,
    min_quality_score: Optional[float] = None,
    concurrency: Optional[int] = None,
    max_context_tokens: int = MAX_CONTEXT_TOKENS,
    seed: Optional[int] = None,
    judge_llm_key_id: Optional[str] = None,
    judge_model: Optional[str] = None,
    judge_fallback_llm_key_id: Optional[str] = None,
    judge_fallback_model: Optional[str] = None,
) -> dict:
    """Generate answers for the specified questions (background task entry point).

    Args:
        model: Model name; ``None`` picks the provider's default model.
        temperature: Sampling temperature; ``None`` means 0.3. ``0.0`` is honoured.
        existing_run_id / existing_task_id: Use pre-created run/task rows.
        include_cot: Store a chain of thought (from ``<think>`` when the model
            emits one, otherwise one extra cot_synthesis call).
        evaluate: Score each item with the evaluation prompt (one extra call).
            The score is stored normalized to 0-1 in ``DatasetItem.score``.
        min_quality_score: With ``evaluate``, items scoring below this are kept
            but flagged ``item_metadata["below_threshold"] = True``.
        concurrency: Max concurrent LLM calls (default ``GENERATION_CONCURRENCY``).

    Returns:
        dict with task_id, generation_run_id, created and errors counts.
    """
    if temperature is None:
        temperature = DEFAULT_TEMPERATURE
    question_repo = QuestionRepository(db)
    task_repo = TaskRepository(db)
    run_svc = GenerationRunService(db)
    prompt_svc = PromptService(db)

    # 1. Load questions (request order) and snapshot everything the workers
    #    need into plain dicts — workers must never touch ORM objects.
    rows = question_repo.get_questions_by_ids(project_id, question_ids)
    if not rows:
        raise ValueError("No valid questions found")
    by_id = {str(q.id): q for q in rows}
    ordered = [by_id[str(qid)] for qid in dict.fromkeys(question_ids) if str(qid) in by_id]
    questions = [
        {
            "id": str(q.id),
            "question": q.question,
            "chunk_id": str(q.chunk_id) if q.chunk_id else None,
            "ga_pair_id": str(q.ga_pair_id) if q.ga_pair_id else None,
        }
        for q in ordered
    ]

    chunk_ids = list({q["chunk_id"] for q in questions if q["chunk_id"]})
    chunks: dict[str, dict] = {}
    if chunk_ids:
        for c in db.query(Chunk).filter(Chunk.project_id == project_id, Chunk.id.in_(chunk_ids)).all():
            chunks[str(c.id)] = {
                "id": str(c.id),
                "document_id": str(c.document_id) if c.document_id else None,
                "content": c.content or "",
                "metadata": c.chunk_metadata if isinstance(c.chunk_metadata, dict) else None,
            }

    # Tell the model which document a chunk comes from, so questions can name
    # it ("In NIST SP 800-61r3, ...") instead of saying "the guide".
    _doc_ids = {c["document_id"] for c in chunks.values() if c.get("document_id")}
    if _doc_ids:
        from app.models import Document as _Document
        from app.services.generation.context import source_title_from_filename
        _titles = {
            str(d.id): source_title_from_filename(d.filename)
            for d in db.query(_Document).filter(_Document.id.in_(list(_doc_ids))).all()
        }
        for _c in chunks.values():
            _t = _titles.get(_c.get("document_id") or "")
            if _t:
                _c["metadata"] = {**(_c.get("metadata") or {}), "source_title": _t}

    ga_ids = list({q["ga_pair_id"] for q in questions if q["ga_pair_id"]})
    ga_pairs: dict[str, dict] = {}
    if ga_ids:
        for p in db.query(GAPair).filter(GAPair.project_id == project_id, GAPair.id.in_(ga_ids)).all():
            ga_pairs[str(p.id)] = {
                "genre_title": p.genre_title,
                "genre_description": p.genre_description,
                "audience_title": p.audience_title,
                "audience_description": p.audience_description,
            }

    # 2. Prompts
    prompt_out = prompt_svc.get_active_prompt(project_id, PromptType.answer)
    answer_template = prompt_out.content
    prompt_version = prompt_out.version
    cot_template = prompt_svc.get_active_prompt(project_id, PromptType.cot_synthesis).content if include_cot else ""
    eval_template = prompt_svc.get_active_prompt(project_id, PromptType.evaluation).content if evaluate else ""

    # 3. LLM config
    config = resolve_llm_config_with_model(
        db, project_id, user_id,
        model=model or "",
        llm_key_id=llm_key_id,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    model = config.model or model or default_model_for(getattr(config, "provider", None))
    config.model = model

    logger.info(
        "Answer generation starting | project=%s questions=%d type=%s model=%s cot=%s evaluate=%s",
        project_id, len(questions), dataset_type.value, model, include_cot, evaluate,
    )

    # 4. Run + task lifecycle
    if existing_run_id:
        if not run_svc.get_run(existing_run_id):
            raise ValueError(f"Pre-created run {existing_run_id} not found")
        run_svc.start_run(existing_run_id)
        generation_run_id = existing_run_id
    else:
        run = run_svc.create_run(
            project_id=project_id,
            run_type=GenerationRunType.answer_generation,
            model_name=model,
            dataset_type=dataset_type,
            prompt_type=PromptType.answer,
            prompt_version=prompt_version,
            total_items=len(questions),
        )
        generation_run_id = str(run.id)

    if existing_task_id:
        if not task_repo.get_task(existing_task_id):
            raise ValueError(f"Pre-created task {existing_task_id} not found")
        task_repo.start_task(existing_task_id)
        task_id = existing_task_id
    else:
        task = task_repo.create_task(
            project_id=project_id,
            task_type=TaskType.answer_generation,
            total_count=len(questions),
            generation_run_id=generation_run_id,
        )
        task_repo.start_task(str(task.id))
        run_svc.start_run(generation_run_id)
        task_id = str(task.id)

    runner = LLMRunner(db, project_id, config, model, task_id=task_id, concurrency=concurrency, seed=seed)
    # A separate judge (another key and/or model) avoids a model grading its
    # own answers and spreads load across provider rate-limit buckets.
    judge_runner = runner
    if evaluate and (judge_llm_key_id or judge_model):
        judge_config = resolve_llm_config_with_model(
            db, project_id, user_id,
            model=judge_model or "",
            llm_key_id=judge_llm_key_id or llm_key_id,
            temperature=JUDGE_TEMPERATURE,
            max_tokens=max_tokens,
        )
        jm = judge_config.model or judge_model or default_model_for(getattr(judge_config, "provider", None))
        judge_config.model = jm
        judge_runner = LLMRunner(db, project_id, judge_config, jm, task_id=task_id, concurrency=concurrency, seed=seed)
        logger.info("Judge uses separate model=%s provider=%s", jm, getattr(judge_config, "provider", None))
    # Optional second judge, used only when the first one fails (e.g. a free
    # tier's daily quota), so items get scored instead of held for re-judging.
    fallback_judge_runner = None
    if evaluate and (judge_fallback_llm_key_id or judge_fallback_model):
        try:
            fb_config = resolve_llm_config_with_model(
                db, project_id, user_id,
                model=judge_fallback_model or "",
                llm_key_id=judge_fallback_llm_key_id or llm_key_id,
                temperature=JUDGE_TEMPERATURE, max_tokens=max_tokens,
            )
            fbm = fb_config.model or judge_fallback_model or default_model_for(getattr(fb_config, "provider", None))
            fb_config.model = fbm
            fallback_judge_runner = LLMRunner(db, project_id, fb_config, fbm, task_id=task_id, concurrency=concurrency, seed=seed)
        except Exception as e:  # a bad fallback must not block generation
            logger.warning("Fallback judge unavailable: %s", e)
    errors: list[dict] = []
    pending: list[DatasetItem] = []
    pending_qids: list[str] = []
    created = 0
    processed = 0
    cancelled = False
    answer_type = AnswerType.label if dataset_type == DatasetType.classification else AnswerType.text
    has_cot_column = hasattr(DatasetItem, "cot")

    async def worker(q: dict) -> dict:
        chunk = chunks.get(q["chunk_id"]) if q["chunk_id"] else None
        chunk_text = chunk["content"] if chunk else "No context available."
        chunk_meta = chunk["metadata"] if chunk else None
        prompt = build_answer_prompt(
            answer_template,
            question=q["question"],
            chunk_text=chunk_text,
            chunk_metadata=chunk_meta,
            ga_pair=ga_pairs.get(q["ga_pair_id"]) if q["ga_pair_id"] else None,
            dataset_type=dataset_type,
            max_context_tokens=max_context_tokens,
        )

        payload: Optional[dict] = None
        extra: dict = {}
        raw = ""
        last_err: Optional[PayloadError] = None
        for _ in range(PARSE_RETRIES + 1):
            raw = await runner.complete(prompt, temperature=temperature, max_tokens=max_tokens)
            try:
                payload, extra = build_payload(dataset_type, raw, q["question"])
                break
            except PayloadError as e:
                last_err = e
        if payload is None:
            raise last_err or PayloadError("Could not parse valid output from LLM")

        meta: dict[str, Any] = {"model": model, "generation_temperature": temperature, **extra}
        result: dict[str, Any] = {"payload": payload, "metadata": meta, "chunk": chunk,
                                  "cot": None, "cot_source": CotSource.none, "score": None,
                                  "ai_evaluation": None}
        context = build_chunk_context(chunk_text, chunk_meta, max_tokens=max_context_tokens)
        answer_text = answer_text_of(dataset_type, payload)

        if include_cot:
            _, think = split_think(raw)
            if think:
                result["cot"], result["cot_source"] = think, CotSource.generated
                meta["cot_origin"] = "think"
            else:
                try:
                    cot_raw = await runner.complete(
                        render_prompt(cot_template, {"content": context, "text": context,
                                                     "question": q["question"], "answer": answer_text}),
                        temperature=temperature, max_tokens=max_tokens,
                    )
                    cot = clean_cot(cot_raw)
                    if cot:
                        result["cot"], result["cot_source"] = cot, CotSource.generated
                        meta["cot_origin"] = "synthesized"
                    else:
                        result["cot_source"] = CotSource.failed
                        meta["cot_error"] = "empty chain of thought"
                except Exception as e:  # CoT is a bonus; keep the answer
                    result["cot_source"] = CotSource.failed
                    meta["cot_error"] = str(e)[:500]
            if result["cot"]:
                payload["cot"] = result["cot"]

        # Free local grounding check runs on every item, judge or not.
        from app.services.quality.grounding import grounding_report, is_grounded
        _src = (result.get("chunk") or {}).get("content", "") if isinstance(result.get("chunk"), dict) else ""
        g_report = grounding_report(answer_text, _src or context, q["question"])
        meta["grounding"] = g_report
        grounded = is_grounded(g_report)
        if not grounded:
            # Ungrounded: cap the score and skip the paid/limited judge call.
            result["score"] = 0.3
            result["ai_evaluation"] = "Failed local grounding check: " + ", ".join(
                g_report["unsupported_phrases"] + g_report.get("unsupported_numbers", [])
            )[:400] or f"support {g_report['support']}"
            if min_quality_score is not None:
                meta["below_threshold"] = True
        if evaluate and grounded:
            try:
                judge_prompt = render_prompt(eval_template, {"content": context, "text": context,
                                                             "question": q["question"], "answer": answer_text})
                try:
                    judge_raw = await judge_runner.complete(
                        judge_prompt, temperature=JUDGE_TEMPERATURE, max_tokens=min(max_tokens, 800),
                    )
                except Exception as primary_err:
                    if fallback_judge_runner is None:
                        raise
                    meta["judge_fallback_reason"] = str(primary_err)[:200]
                    judge_raw = await fallback_judge_runner.complete(
                        judge_prompt, temperature=JUDGE_TEMPERATURE, max_tokens=min(max_tokens, 800),
                    )
                    meta["judge"] = "fallback"
                score, raw_score, evaluation = parse_judge_output(judge_raw)
                judge_visible = re.sub(r"<think>[\s\S]*?</think>", "", judge_raw or "").strip()
                meta["evaluation"] = {"raw_output": (judge_visible or judge_raw)[:4000], "raw_score": raw_score, "scale": JUDGE_SCALE}
                if score is None:
                    meta["evaluation_error"] = "no score in judge output"
                else:
                    result["score"] = score
                    if min_quality_score is not None:
                        meta["below_threshold"] = score < min_quality_score
                result["ai_evaluation"] = evaluation or None
            except Exception as e:
                meta["evaluation_error"] = str(e)[:500]
                # Judge unavailable (quota/outage): never let an unscored item
                # pass silently. Hold it below threshold so it can be re-judged.
                if min_quality_score is not None:
                    meta["below_threshold"] = True
                    meta["needs_rejudge"] = True
        return result

    def on_result(q: dict, result: Optional[dict], error: Optional[BaseException]) -> None:
        nonlocal processed
        processed += 1
        if error is not None:
            kind = "Invalid LLM output" if isinstance(error, PayloadError) else "LLM call failed"
            errors.append({"item_id": q["id"], "message": f"{kind}: {error}"})
            return
        chunk = result["chunk"]
        item = DatasetItem(
            project_id=project_id,
            question_id=q["id"],
            generation_run_id=generation_run_id,
            source_document_id=chunk["document_id"] if chunk else None,
            source_chunk_id=chunk["id"] if chunk else None,
            source_ga_pair_id=q["ga_pair_id"],
            dataset_type=dataset_type,
            payload=result["payload"],
            item_metadata=result["metadata"],
            answer_type=answer_type,
            score=result["score"],
            ai_evaluation=result["ai_evaluation"],
        )
        if has_cot_column:
            item.cot = result["cot"]
            item.cot_source = result["cot_source"]
        pending.append(item)
        pending_qids.append(q["id"])

    def on_flush(n_done: int) -> bool:
        nonlocal created
        if pending:
            db.add_all(pending)
            db.query(Question).filter(
                Question.id.in_(list(pending_qids)),
                Question.project_id == project_id,
            ).update({"answered": True, "reviewed_at": datetime.utcnow()}, synchronize_session=False)
            created += len(pending)
            pending.clear()
            pending_qids.clear()
        db.commit()
        if n_done:
            task_repo.update_progress(task_id, completed_increment=n_done)
        t = task_repo.get_task(task_id)
        return bool(t is not None and getattr(t, "cancel_requested", False))

    try:
        if dataset_type not in OUTPUT_FORMATS:
            raise ValueError(f"Dataset type '{dataset_type.value}' is not supported by answer generation")

        await runner.run_all(questions, worker, on_result, on_flush=on_flush)
        if pending:
            on_flush(0)
        t = task_repo.get_task(task_id)
        cancelled = bool(t is not None and getattr(t, "cancel_requested", False))

        run_svc.complete_run(generation_run_id, processed_items=created, total_items=created)
        if not cancelled:
            task_repo.complete_task(
                task_id,
                completed_count=processed,
                error_count=len(errors),
                total_count=len(questions),
            )
        _append_error_log(db, task_repo, task_id, errors)

        logger.info(
            "Answer generation complete | project=%s questions=%d items=%d errors=%d calls=%d peak_concurrency=%d%s",
            project_id, len(questions), created, len(errors), runner.calls, runner.peak_in_flight,
            " (cancelled)" if cancelled else "",
        )
    except Exception as e:
        logger.error("Answer generation failed | project=%s error=%s", project_id, str(e))
        try:
            db.rollback()
        except Exception:
            pass
        run_svc.fail_run(generation_run_id, error_message=str(e), processed_items=created)
        task_repo.fail_task(task_id, str(e))
        raise

    return {
        "task_id": task_id,
        "generation_run_id": generation_run_id,
        "created": created,
        "errors": len(errors),
    }


def _append_error_log(db: Session, task_repo: TaskRepository, task_id: str, errors: list[dict]) -> None:
    if not errors:
        return
    task = task_repo.get_task(task_id)
    if task is None:
        return
    log = list(task.error_log or [])
    log.extend(errors[:MAX_ERROR_LOG])
    if len(errors) > MAX_ERROR_LOG:
        log.append({"item_id": None, "message": f"... and {len(errors) - MAX_ERROR_LOG} more errors"})
    task.error_log = log
    db.commit()

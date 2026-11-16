"""Tests for app.services.generation.answer_generator.

Runs the real generator against an in-memory SQLite database (Postgres-only
JSONB rendered as JSON, indexes skipped) with a fake LLM patched in at
``tracked_call.tracked_complete`` — the function LLMRunner calls.
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import CreateTable


@compiles(JSONB, "sqlite")
def _jsonb_sqlite(type_, compiler, **kw):  # pragma: no cover - DDL hook
    return "JSON"


from app.models import (  # noqa: E402
    Base, Chunk, CotSource, DatasetItem, DatasetType, Document, GAPair,
    GenerationRun, LLMUsageLog, Project, Question, Task, TaskStatus, User,
)
from app.schemas_extended import LLMResponse  # noqa: E402
from app.services.generation import answer_generator as ag  # noqa: E402
from app.services.generation import llm_runner  # noqa: E402
from app.services.generation.resolver import ResolvedLLMConfig  # noqa: E402
from app.services.llm import tracked_call  # noqa: E402

ANSWER_MARK = "Fine-tuning Dataset Answer Expert"
COT_MARK = "Chain-of-Thought Reconstruction"
EVAL_MARK = "Dataset Quality Evaluation"


# ── fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            conn.execute(CreateTable(table))
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def project(db):
    user = User(username="u", email="u@example.com")
    db.add(user)
    db.flush()
    proj = Project(owner_id=user.id, name="p")
    db.add(proj)
    db.flush()
    doc = Document(project_id=proj.id, filename="manual.md", file_type="md",
                   storage_url="k", file_size=1, md5="0" * 32)
    db.add(doc)
    db.flush()
    chunk = Chunk(project_id=proj.id, document_id=doc.id, chunk_index=0, token_count=10,
                  content="The reactor_core_temp limit is 350 C. Coolant pumps run in pairs.",
                  chunk_metadata={"heading_path": ["Manual", "Safety"]})
    db.add(chunk)
    db.flush()
    ga = GAPair(project_id=proj.id, document_id=doc.id, genre_title="Tutorial",
                genre_description="step-by-step", audience_title="Beginners",
                audience_description="new operators")
    db.add(ga)
    db.commit()
    return {"user": user, "project": proj, "doc": doc, "chunk": chunk, "ga": ga}


def add_questions(db, project, texts, ga=False):
    qs = [
        Question(project_id=project["project"].id, chunk_id=project["chunk"].id,
                 ga_pair_id=project["ga"].id if ga else None, question=t)
        for t in texts
    ]
    db.add_all(qs)
    db.commit()
    return [str(q.id) for q in qs]


class FakeLLM:
    """Routes by prompt kind; ``responder(kind, prompt)`` returns text or raises."""

    def __init__(self, responder, delay: float = 0.0):
        self.responder = responder
        self.delay = delay
        self.calls: list[dict] = []
        self.in_flight = 0
        self.peak = 0

    async def __call__(self, db, project_id, config, messages, model, *, temperature=0.7,
                       max_tokens=4096, task_id=None, usage_sink=None, timeout=None):
        prompt = messages[-1]["content"]
        kind = "eval" if EVAL_MARK in prompt else "cot" if COT_MARK in prompt else "answer"
        self.calls.append({"kind": kind, "prompt": prompt, "temperature": temperature})
        self.in_flight += 1
        self.peak = max(self.peak, self.in_flight)
        try:
            if self.delay:
                await asyncio.sleep(self.delay)
            entry = dict(project_id=project_id, user_llm_key_id=config.llm_key_id, task_id=task_id,
                         provider=config.provider, model=model, input_tokens=1, output_tokens=1,
                         estimated_cost_usd=0.0, latency_ms=1, status="success", error_message=None)
            try:
                text = self.responder(kind, prompt)
            except Exception as e:
                entry.update(status="error", error_message=str(e))
                if usage_sink is not None:
                    usage_sink.append(entry)
                raise
            if usage_sink is not None:
                usage_sink.append(entry)
            return LLMResponse(content=text, prompt_tokens=1, completion_tokens=1, total_tokens=2)
        finally:
            self.in_flight -= 1


@pytest.fixture
def patch_llm(monkeypatch):
    def _install(responder, delay=0.0):
        fake = FakeLLM(responder, delay)
        monkeypatch.setattr(tracked_call, "tracked_complete", fake)
        monkeypatch.setattr(
            ag, "resolve_llm_config_with_model",
            lambda db, pid, uid, model, **kw: ResolvedLLMConfig(
                provider="openai", model=model, api_key="k", llm_key_id=None,
                temperature=kw.get("temperature", 0.7), max_tokens=kw.get("max_tokens", 4096)),
        )
        monkeypatch.setattr(llm_runner, "DEFAULT_BASE_DELAY", 0.001)
        monkeypatch.setattr(llm_runner, "DEFAULT_MAX_DELAY", 0.01)
        return fake
    return _install


async def run(db, project, qids, **kw):
    return await ag.generate_answers(db, str(project["project"].id), str(project["user"].id), qids, **kw)


def items(db):
    return db.query(DatasetItem).all()


# ── QA happy path ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_qa_happy_path(db, project, patch_llm):
    fake = patch_llm(lambda kind, p: "**The limit** is 350 C for reactor_core_temp.")
    qids = add_questions(db, project, ["What is the reactor_core_temp limit?", "How do pumps run?"], ga=True)
    out = await run(db, project, qids)

    rows = items(db)
    assert len(rows) == 2 and out["created"] == 2 and out["errors"] == 0
    assert {r.payload["answer"] for r in rows} == {"The limit is 350 C for reactor_core_temp."}
    r = rows[0]
    assert r.source_chunk_id == str(project["chunk"].id)
    assert r.source_document_id == str(project["doc"].id)
    assert r.source_ga_pair_id == str(project["ga"].id)
    assert r.score is None and r.cot is None
    # grounded prompt: section prefix, chunk text, GA block, default temperature
    prompt = fake.calls[0]["prompt"]
    assert "Section: Manual > Safety" in prompt
    assert "reactor_core_temp limit is 350 C" in prompt
    assert "Tutorial: step-by-step" in prompt and "Beginners: new operators" in prompt
    assert "{output_format}" not in prompt and "Output only the final answer" in prompt
    assert all(c["temperature"] == 0.3 for c in fake.calls)
    # questions marked answered; task + run completed; usage logs flushed
    assert all(q.answered for q in db.query(Question).all())
    task = db.query(Task).one()
    assert task.status == TaskStatus.done and task.completed_count == 2 and task.error_count == 0
    run_row = db.query(GenerationRun).one()
    assert run_row.status == TaskStatus.done and run_row.processed_items == 2
    assert db.query(LLMUsageLog).count() == 2


@pytest.mark.asyncio
async def test_temperature_zero_is_honoured(db, project, patch_llm):
    fake = patch_llm(lambda kind, p: "Answer.")
    await run(db, project, add_questions(db, project, ["Q?"]), temperature=0.0)
    assert fake.calls[0]["temperature"] == 0.0


@pytest.mark.asyncio
async def test_long_chunk_is_token_truncated(db, project, patch_llm):
    fake = patch_llm(lambda kind, p: "Answer.")
    project["chunk"].content = "word " * 20000
    db.commit()
    await run(db, project, add_questions(db, project, ["Q?"]), max_context_tokens=500)
    prompt = fake.calls[0]["prompt"]
    assert prompt.count("word") < 1000


# ── MCQ ──────────────────────────────────────────────────────────────

MCQ_OK = '{"options": ["A. 250 C", "B. 350 C", "C. 450 C", "D. 550 C"], "correct_answer": "B", "explanation": "stated"}'


@pytest.mark.asyncio
async def test_mcq_correct_letter_maps_to_option(db, project, patch_llm):
    fake = patch_llm(lambda kind, p: "```json\n" + MCQ_OK + "\n```")
    await run(db, project, add_questions(db, project, ["What is the limit?"]), dataset_type=DatasetType.mcq)
    (row,) = items(db)
    assert row.payload["options"] == ["250 C", "350 C", "450 C", "550 C"]
    assert row.payload["correct_answer"] == "350 C"
    assert row.item_metadata["correct_option"] == "B"
    assert '"correct_answer": "B"' in fake.calls[0]["prompt"]  # MCQ output format injected


@pytest.mark.parametrize("raw,expected", [
    ('{"options": ["x", "y", "z"], "correct_answer": "z"}', 2),
    ('{"options": ["x", "y", "z"], "correct_answer": "Y"}', 1),        # case-insensitive text
    ('{"options": ["x", "y", "z"], "answer": "(C)"}', 2),
    ('{"options": ["x", "y", "z"], "correct_answer": "B. y"}', 1),
    ('{"options": {"A": "x", "B": "y"}, "correct_answer": "A"}', 0),
    ('{"options": ["x", "y"], "correct_answer": "y", "correct_option": "B"}', 1),
])
def test_parse_mcq_accepts(raw, expected):
    _, idx, _ = ag.parse_mcq(raw)
    assert idx == expected


@pytest.mark.parametrize("raw", [
    '{"options": ["x", "y", "z"], "correct_answer": "w"}',              # not an option
    '{"options": ["x", "y", "z"], "correct_answer": "E"}',              # letter out of range
    '{"options": ["x", "y", "z"], "correct_answer": "B. z"}',           # letter/text disagree
    '{"options": ["x", "y"], "correct_answer": "y", "correct_option": "A"}',  # conflicting fields
    '{"options": ["x", "x"], "correct_answer": "x"}',                   # duplicates
    '{"options": ["x"], "correct_answer": "x"}',                        # too few
    '{"options": ["x", "y"]}',                                          # no answer
    '{"options": ["x", "y"], "correct_answer": ["x", "y"]}',            # multi-answer
    'Option B is correct',                                              # not JSON
])
def test_parse_mcq_rejects(raw):
    with pytest.raises(ag.PayloadError):
        ag.parse_mcq(raw)


@pytest.mark.asyncio
async def test_mcq_invalid_answer_is_rejected_not_defaulted(db, project, patch_llm):
    bad = '{"options": ["250 C", "350 C", "450 C"], "correct_answer": "900 C"}'
    fake = patch_llm(lambda kind, p: bad)
    qids = add_questions(db, project, ["What is the limit?"])
    out = await run(db, project, qids, dataset_type=DatasetType.mcq)
    assert items(db) == [] and out["errors"] == 1
    assert len(fake.calls) == ag.PARSE_RETRIES + 1          # re-asked once, then gave up
    task = db.query(Task).one()
    assert task.status == TaskStatus.done and task.error_count == 1
    assert "does not match any option" in task.error_log[0]["message"]
    assert db.query(Question).one().answered is False


@pytest.mark.asyncio
async def test_mcq_retry_recovers(db, project, patch_llm):
    replies = iter(['{"options": ["a"], "correct_answer": "a"}', MCQ_OK])
    patch_llm(lambda kind, p: next(replies))
    await run(db, project, add_questions(db, project, ["Q?"]), dataset_type=DatasetType.mcq)
    assert items(db)[0].payload["correct_answer"] == "350 C"


def test_classification_payload():
    assert ag.build_payload(DatasetType.classification, '{"label": "Safety"}', "t")[0] == {"text": "t", "label": "Safety"}
    assert ag.build_payload(DatasetType.classification, "Label: Maintenance", "t")[0]["label"] == "Maintenance"
    with pytest.raises(ag.PayloadError):
        ag.build_payload(DatasetType.classification, "{not json", "t")
    assert ag._build_payload(DatasetType.qa, "   ", "q") is None


# ── chain of thought ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cot_from_think_block(db, project, patch_llm):
    fake = patch_llm(lambda kind, p: "<think>The text says 350 C.</think>The limit is 350 C.")
    await run(db, project, add_questions(db, project, ["Limit?"]), include_cot=True)
    (row,) = items(db)
    assert row.payload["answer"] == "The limit is 350 C."
    assert row.payload["cot"] == row.cot == "The text says 350 C."
    assert row.cot_source == CotSource.generated
    assert row.item_metadata["cot_origin"] == "think"
    assert [c["kind"] for c in fake.calls] == ["answer"]    # no extra synthesis call


@pytest.mark.asyncio
async def test_cot_synthesized_when_no_think(db, project, patch_llm):
    def responder(kind, p):
        return "Chain of thought:\nFirst find the limit, then state it." if kind == "cot" else "The limit is 350 C."
    fake = patch_llm(responder)
    await run(db, project, add_questions(db, project, ["Limit?"]), include_cot=True)
    (row,) = items(db)
    assert row.cot == "First find the limit, then state it."
    assert row.item_metadata["cot_origin"] == "synthesized"
    cot_prompt = [c for c in fake.calls if c["kind"] == "cot"][0]["prompt"]
    assert "The limit is 350 C." in cot_prompt and "Limit?" in cot_prompt


@pytest.mark.asyncio
async def test_think_stripped_without_cot(db, project, patch_llm):
    patch_llm(lambda kind, p: "<think>hidden</think>Answer.")
    await run(db, project, add_questions(db, project, ["Q?"]))
    (row,) = items(db)
    assert row.payload == {"question": "Q?", "answer": "Answer."} and row.cot is None


# ── judge ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,norm,raw_score", [
    ('{"score": 4.5, "evaluation": "good"}', 0.9, 4.5),
    ('```json\n{"score": "3/5", "evaluation": "ok"}\n```', 0.6, 3.0),
    ('{"score": 0.8, "reason": "x", "max_score": 1}', 0.8, 0.8),
    ('Overall score: 8/10. Solid.', 0.8, 8.0),
    ('{"score": 85}', 0.85, 85.0),
    ('<think>hmm</think>{"score": 5, "evaluation": "great"}', 1.0, 5.0),
])
def test_parse_judge_output(raw, norm, raw_score):
    score, raw_val, _ = ag.parse_judge_output(raw)
    assert score == pytest.approx(norm) and raw_val == pytest.approx(raw_score)


def test_parse_judge_output_no_score():
    assert ag.parse_judge_output("I cannot evaluate this.")[0] is None


@pytest.mark.asyncio
async def test_judge_scores_and_flags_below_threshold(db, project, patch_llm):
    def responder(kind, p):
        if kind == "eval":
            return '{"score": 2, "evaluation": "Thin answer."}' if "How do pumps run?" in p else '{"score": 4.5, "evaluation": "Good."}'
        return "Answer text."
    fake = patch_llm(responder)
    qids = add_questions(db, project, ["What is the limit?", "How do pumps run?"])
    await run(db, project, qids, evaluate=True, min_quality_score=0.7)
    rows = {r.payload["question"]: r for r in items(db)}
    assert len(rows) == 2                                   # nothing deleted
    good, weak = rows["What is the limit?"], rows["How do pumps run?"]
    assert good.score == pytest.approx(0.9) and good.item_metadata["below_threshold"] is False
    assert weak.score == pytest.approx(0.4) and weak.item_metadata["below_threshold"] is True
    assert weak.ai_evaluation == "Thin answer."
    assert '"score": 2' in weak.item_metadata["evaluation"]["raw_output"]
    assert all(c["temperature"] == 0.0 for c in fake.calls if c["kind"] == "eval")


@pytest.mark.asyncio
async def test_judge_failure_keeps_item(db, project, patch_llm):
    def responder(kind, p):
        if kind == "eval":
            raise RuntimeError("judge down")
        return "Answer."
    patch_llm(responder)
    await run(db, project, add_questions(db, project, ["Q?"]), evaluate=True)
    (row,) = items(db)
    assert row.score is None and "judge down" in row.item_metadata["evaluation_error"]


# ── concurrency ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_calls_overlap_and_all_results_saved(db, project, patch_llm):
    fake = patch_llm(lambda kind, p: "Answer.", delay=0.05)
    qids = add_questions(db, project, [f"Question {i}?" for i in range(12)])
    loop = asyncio.get_running_loop()
    t0 = loop.time()
    out = await run(db, project, qids, concurrency=6)
    elapsed = loop.time() - t0
    assert fake.peak > 1 and fake.peak <= 6
    assert elapsed < 12 * 0.05                              # faster than sequential
    assert out["created"] == 12 and len(items(db)) == 12
    assert {r.question_id for r in items(db)} == set(qids)
    assert db.query(Task).one().completed_count == 12
    assert db.query(Question).filter(Question.answered.is_(True)).count() == 12


# ── error handling ───────────────────────────────────────────────────

class _ClientError(Exception):
    status_code = 400


@pytest.mark.asyncio
async def test_llm_errors_are_isolated(db, project, patch_llm):
    attempts = {"flaky": 0}

    def responder(kind, p):
        if "broken" in p:
            raise _ClientError("bad request")              # not retryable
        if "flaky" in p:
            attempts["flaky"] += 1
            if attempts["flaky"] == 1:
                raise RuntimeError("timeout")              # retried, then succeeds
        return "Answer."
    patch_llm(responder)
    qids = add_questions(db, project, ["ok question?", "broken question?", "flaky question?"])
    out = await run(db, project, qids)
    assert out["created"] == 2 and out["errors"] == 1
    task = db.query(Task).one()
    assert task.status == TaskStatus.done and task.error_count == 1 and task.completed_count == 3
    assert "LLM call failed: bad request" in task.error_log[0]["message"]
    answered = {q.question: q.answered for q in db.query(Question).all()}
    assert answered == {"ok question?": True, "broken question?": False, "flaky question?": True}


@pytest.mark.asyncio
async def test_unsupported_type_fails_run_and_task(db, project, patch_llm):
    patch_llm(lambda kind, p: "x")
    with pytest.raises(ValueError):
        await run(db, project, add_questions(db, project, ["Q?"]), dataset_type=DatasetType.conversation)
    assert db.query(Task).one().status == TaskStatus.failed
    assert db.query(GenerationRun).one().status == TaskStatus.failed


@pytest.mark.asyncio
async def test_no_questions_raises(db, project, patch_llm):
    patch_llm(lambda kind, p: "x")
    with pytest.raises(ValueError, match="No valid questions"):
        await run(db, project, ["missing-id"])


# ── markdown cleanup ─────────────────────────────────────────────────

def test_clean_markdown_preserves_snake_case_and_code():
    text = (
        "## Heading\n"
        "Set **max_retry_count** and _note_ the my_var_name value.\n"
        "- use `some_func_name()` here\n"
        "Compute 2*3*4 and __init__ stays.\n"
        "```python\nx = __dunder__ * _private_\n```"
    )
    out = ag._clean_markdown(text)
    assert out.startswith("Heading\n")
    assert "Set max_retry_count and note the my_var_name value." in out
    assert "use `some_func_name()` here" in out
    assert "2*3*4" in out and "__init__" in out
    assert "x = __dunder__ * _private_" in out

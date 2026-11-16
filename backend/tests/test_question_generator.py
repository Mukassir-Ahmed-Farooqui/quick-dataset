import json
import re
import time
from types import SimpleNamespace

import pytest

import _gen_fakes as F
from app.models import Question
from app.services.generation import question_generator as qg

TEMPLATE = "Generate exactly {number} question(s).\n{ga_prompt}\n<<{content}>>"

TOPICS = [
    "What is the primary purpose of {x}?",
    "How does {x} handle error recovery during startup?",
    "Why would an engineer choose {x} over alternatives?",
    "Which configuration options control {x} behaviour?",
    "When should {x} be restarted after an upgrade?",
    "What are the security implications of enabling {x}?",
    "How can performance of {x} be measured reliably?",
    "Which dependencies must be installed before {x}?",
    "What limitations does {x} have with large inputs?",
    "How is logging configured for {x} in production?",
]


def topic_of(prompt):
    return re.search(r"TOPIC=(\w+)", prompt).group(1)


def good_response(prompt, idx):
    n = int(re.search(r"Generate exactly (\d+)", prompt).group(1))
    x = topic_of(prompt)
    return "```json\n" + json.dumps([t.format(x=x) for t in TOPICS[:n]]) + "\n```"


def make_chunk(cid, doc, length):
    body = f"TOPIC={cid} " + ("lorem ipsum dolor sit amet " * (length // 27 + 1))
    return SimpleNamespace(id=cid, document_id=doc, content=body[:length], chunk_metadata={"heading_path": ["Doc", cid]})


def make_pair(pid, doc):
    return SimpleNamespace(
        id=pid, document_id=doc,
        genre_title=f"Genre {pid}", genre_description=f"Style for {pid}.",
        audience_title=f"Audience {pid}", audience_description=f"Readers of {pid}.",
    )


async def run(db, monkeypatch, llm, **kw):
    flushed = F.install_common(monkeypatch, qg, TEMPLATE, llm)
    params = dict(
        db=db, project_id="p1", user_id="u1",
        chunk_ids=[c.id for c in db.chunks], task_id="t1", generation_run_id="r1",
    )
    params.update(kw)
    await qg.generate_questions(**params)
    return flushed


@pytest.mark.asyncio
async def test_auto_mode_concurrent_and_correct(monkeypatch):
    chunks = [make_chunk(f"c{i}", "d1", 960) for i in range(8)]  # 4 questions each
    db = F.FakeDB(chunks=chunks)
    llm = F.FakeLLM(good_response, delay=0.05)

    start = time.monotonic()
    flushed = await run(db, monkeypatch, llm, concurrency=4, temperature=0.0)
    elapsed = time.monotonic() - start

    qs = db.of_type(Question)
    assert len(qs) == 32
    for q in qs:  # every question was generated from its own chunk
        assert f" c{q.chunk_id[1:]} " in f" {q.question.split()[-1].rstrip('?')} " or q.chunk_id in q.question
    assert {q.chunk_id for q in qs} == {c.id for c in chunks}
    assert all(q.ga_pair_id is None and q.generation_run_id == "r1" for q in qs)
    assert llm.calls == 8
    assert llm.peak == 4                     # bounded by concurrency
    assert elapsed < 8 * 0.05                # faster than sequential
    assert llm.temperatures == [0.0] * 8     # 0.0 respected
    assert len(flushed) == 8                 # one usage row per call
    task = F.FakeTaskRepo.instances[0]
    assert task.completed == {"completed_count": 8, "error_count": 0, "total_count": 8}
    assert F.FakeRunSvc.instances[0].completed == {"processed_items": 32, "total_items": 32}


@pytest.mark.asyncio
async def test_ga_pairs_distributed_with_guidance(monkeypatch):
    chunks = [make_chunk("c0", "d1", 1200)]  # 5 questions -> 2 calls (3 + 2)
    pairs = [make_pair("g1", "d1"), make_pair("g2", "d1"), make_pair("g3", "d1")]
    db = F.FakeDB(chunks=chunks, pairs=pairs)
    llm = F.FakeLLM(good_response)

    await run(db, monkeypatch, llm, ga_pair_ids=["g1", "g2", "g3"])

    assert llm.calls == 2
    assert any("Genre g1: Style for g1." in p and "Audience g1: Readers of g1." in p for p in llm.prompts)
    assert all("Section: Doc > c0" in p for p in llm.prompts)
    qs = db.of_type(Question)
    assert len(qs) == 3  # questions repeat across the two calls -> deduped per chunk
    assert {q.ga_pair_id for q in qs} <= {"g1", "g2"}


@pytest.mark.asyncio
async def test_per_combination_mode(monkeypatch):
    chunks = [make_chunk("c0", "d1", 100), make_chunk("c1", "d1", 100)]
    pairs = [make_pair("g1", "d1"), make_pair("g2", "d1")]
    db = F.FakeDB(chunks=chunks, pairs=pairs)
    llm = F.FakeLLM(good_response)

    await run(db, monkeypatch, llm, ga_pair_ids=["g1", "g2"],
              question_count_mode="per_combination", questions_per_combination=2)
    assert llm.calls == 4
    assert all(re.search(r"Generate exactly 2 ", p) for p in llm.prompts)


@pytest.mark.asyncio
async def test_parse_retry_and_errors(monkeypatch):
    chunks = [make_chunk("c0", "d1", 300), make_chunk("bad", "d1", 300), make_chunk("auth", "d1", 300)]
    db = F.FakeDB(chunks=chunks)
    seen = {}

    def respond(prompt, idx):
        t = topic_of(prompt)
        if t == "auth":
            raise F.AuthError("401 unauthorized")
        seen[t] = seen.get(t, 0) + 1
        if t == "c0" and seen[t] == 1:
            return "Sorry, I cannot help with that."
        if t == "bad":
            return "[]"
        return good_response(prompt, idx)

    llm = F.FakeLLM(respond, delay=0)
    await run(db, monkeypatch, llm)

    assert seen["c0"] == 2              # re-asked once after an unusable reply
    assert seen["bad"] == 2             # retried, still empty -> error
    qs = db.of_type(Question)
    assert [q.chunk_id for q in qs] == ["c0"]
    task = F.FakeTaskRepo.instances[0]
    assert task.completed["error_count"] == 2
    messages = " ".join(e["message"] for e in task.task.error_log)
    assert "LLM call failed" in messages and "Could not parse" in messages


@pytest.mark.asyncio
async def test_skips_existing_duplicates(monkeypatch):
    chunks = [make_chunk("c0", "d1", 480)]  # 2 questions
    db = F.FakeDB(chunks=chunks, existing_questions=[("c0", "What is the primary purpose of c0?")])
    llm = F.FakeLLM(good_response, delay=0)
    await run(db, monkeypatch, llm)
    assert [q.question for q in db.of_type(Question)] == ["How does c0 handle error recovery during startup?"]


@pytest.mark.asyncio
async def test_missing_chunks_raise(monkeypatch):
    db = F.FakeDB(chunks=[])
    F.install_common(monkeypatch, qg, TEMPLATE, F.FakeLLM(good_response))
    with pytest.raises(ValueError):
        await qg.generate_questions(db, "p1", "u1", ["nope"], "t1", "r1")

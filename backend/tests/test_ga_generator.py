import json
import re
import time
from types import SimpleNamespace

import pytest

import _gen_fakes as F
from app.models import GAPair
from app.services.generation import ga_generator as gg

TEMPLATE = "Return {pairs_per_document} pairs.\n## Source Document:\n{content}"


def pair(g, a, gd="A genre description.", ad="An audience description."):
    return {"genre": {"title": g, "description": gd}, "audience": {"title": a, "description": ad}}


def doc_marker(prompt):
    return re.search(r"DOC=(\w+)", prompt).group(1)


def good_response(prompt, idx):
    d = doc_marker(prompt)
    items = [
        pair(f"Root Cause {d}", f"Junior Engineers {d}"),
        pair(f"Step By Step Guide {d}", f"Busy Administrators {d}"),
        pair(f"Root Cause {d}", f"Junior Engineers {d}!"),          # near-duplicate
        {"genre": {"title": "No audience"}, "audience": {"title": "x"}},  # invalid (no descriptions)
        pair(f"Comparative Evaluation {d}", f"Skeptical Managers {d}"),
        pair(f"Myth Busting {d}", f"Curious Students {d}"),
    ]
    return "Here are the pairs:\n```json\n" + json.dumps(items) + "\n```\nLet me know [if] you need more."


class FakeDocRepo:
    def __init__(self, db):
        pass

    def get_document(self, project_id, doc_id):
        if doc_id.startswith("missing"):
            return None
        return SimpleNamespace(id=doc_id, filename=f"{doc_id}.md")


def long_text(doc_id):
    body = "\n\n".join(f"## Section {i}\n\n" + ("Plenty of content here. " * 30) for i in range(40))
    return f"DOC={doc_id}\n\n{body}\n\nEND_OF_{doc_id}"


async def run(monkeypatch, llm, doc_ids, content_fn=long_text, db=None, **kw):
    db = db or F.FakeDB()
    flushed = F.install_common(monkeypatch, gg, TEMPLATE, llm)
    monkeypatch.setattr(gg, "DocumentRepository", FakeDocRepo)
    monkeypatch.setattr(gg, "_load_document_content", lambda project_id, filename: content_fn(filename[:-3]))
    await gg.generate_ga_pairs(db, "p1", "u1", doc_ids, "t1", "r1", **kw)
    return db, flushed


@pytest.mark.asyncio
async def test_concurrent_validated_deduped(monkeypatch):
    llm = F.FakeLLM(good_response, delay=0.05)
    docs = [f"d{i}" for i in range(6)]
    start = time.monotonic()
    db, flushed = await run(monkeypatch, llm, docs, pairs_per_document=3, concurrency=3)
    elapsed = time.monotonic() - start

    rows = db.of_type(GAPair)
    assert len(rows) == 18
    for d in docs:
        mine = [r for r in rows if r.document_id == d]
        assert [r.genre_title for r in mine] == [f"Root Cause {d}", f"Step By Step Guide {d}", f"Comparative Evaluation {d}"]
        assert all(r.genre_description and r.audience_description for r in mine)
    assert llm.calls == 6
    assert llm.peak == 3
    assert elapsed < 6 * 0.05
    assert len(flushed) == 6
    # digest of the WHOLE document, not content[:8000]
    assert all("representative digest" in p for p in llm.prompts)
    assert all(re.search(r"END_OF_d\d", p) for p in llm.prompts)
    assert all(p.startswith("Return 3 pairs.") for p in llm.prompts)
    task = F.FakeTaskRepo.instances[0]
    assert task.completed == {"completed_count": 6, "error_count": 0, "total_count": 6}
    assert F.FakeRunSvc.instances[0].completed == {"processed_items": 18, "total_items": 18}


@pytest.mark.asyncio
async def test_errors_missing_docs_and_bad_output(monkeypatch):
    calls = {}

    def respond(prompt, idx):
        d = doc_marker(prompt)
        calls[d] = calls.get(d, 0) + 1
        if d == "garbage":
            return "I could not do it."
        if d == "retry" and calls[d] == 1:
            return '[{"genre": {"title": "x"}}]'  # parses but nothing valid -> re-ask
        return good_response(prompt, idx)

    llm = F.FakeLLM(respond, delay=0)
    db, _ = await run(
        monkeypatch, llm, ["ok", "missing1", "garbage", "retry", "empty"],
        content_fn=lambda d: "" if d == "empty" else f"DOC={d}\n\nshort doc text",
        pairs_per_document=2,
    )
    assert calls == {"ok": 1, "garbage": 2, "retry": 2}
    rows = db.of_type(GAPair)
    assert sorted({r.document_id for r in rows}) == ["ok", "retry"]
    assert len(rows) == 4
    task = F.FakeTaskRepo.instances[0]
    assert task.completed == {"completed_count": 2, "error_count": 3, "total_count": 5}
    msgs = [e["message"] for e in task.task.error_log]
    assert any("Document not found" in m for m in msgs)
    assert any("No content" in m for m in msgs)
    assert any("no valid genre/audience pairs" in m for m in msgs)
    # skipped docs still count toward progress
    assert task.progress == 5


@pytest.mark.asyncio
async def test_dedupes_against_existing_pairs(monkeypatch):
    existing = SimpleNamespace(
        document_id="d1", genre_title="Root Cause d1", genre_description="g",
        audience_title="Junior Engineers d1", audience_description="a",
    )
    db = F.FakeDB(pairs=[existing])
    llm = F.FakeLLM(good_response, delay=0)
    db, _ = await run(monkeypatch, llm, ["d1"], db=db, pairs_per_document=2)
    titles = [r.genre_title for r in db.of_type(GAPair)]
    assert titles == ["Step By Step Guide d1", "Comparative Evaluation d1"]


@pytest.mark.asyncio
async def test_falls_back_to_chunks_when_file_missing(monkeypatch):
    db = F.FakeDB(chunks=[SimpleNamespace(content="DOC=d7"), SimpleNamespace(content="chunk two text")])
    llm = F.FakeLLM(good_response, delay=0)
    db, _ = await run(monkeypatch, llm, ["d7"], content_fn=lambda d: None, db=db)
    assert "chunk two text" in llm.prompts[0]
    assert len(db.of_type(GAPair)) == 3


def test_parse_and_validate_shapes():
    raw = '<think>hmm</think>[{"genre_title": "Flat", "genre_description": "d", ' \
          '"audience_title": "Shape", "audience_description": "e"}, ' \
          '{"genre": {"title": "' + "T" * 300 + '", "description": "d"}, "audience": {"title": "A", "description": "e"}}, ' \
          '{"genre": "string only", "audience": {"title": "A", "description": "e"}}]'
    out = gg._parse_ga_output(raw)
    assert len(out) == 2
    assert out[0]["genre_title"] == "Flat"
    assert len(out[1]["genre_title"]) == 128
    assert gg._parse_ga_output("nothing") is None
    single = gg._parse_ga_output('{"genre": {"title": "G", "description": "d"}, "audience": {"title": "A", "description": "e"}}')
    assert single and single[0]["audience_title"] == "A"


def test_dedupe_requires_both_sides_similar():
    a = {"genre_title": "Root Cause Analysis", "audience_title": "Junior Engineers"}
    b = {"genre_title": "Root Cause Analysis", "audience_title": "Retired Hobbyists"}
    c = {"genre_title": "Root cause analysis!", "audience_title": "junior engineers"}
    assert gg.dedupe_ga_pairs([a, b, c]) == [a, b]

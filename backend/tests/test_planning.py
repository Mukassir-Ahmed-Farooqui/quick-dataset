import os

os.environ.setdefault("ENCRYPTION_SECRET_KEY", "x2bJ0b4yJm0jzKxL0hV6m3c3pS0n9uQ2YkqB0V8t3aE=")

from app.services.generation.estimator import estimate_question_generation_planned
from app.services.generation.planning import (
    ChunkInfo,
    GAInfo,
    plan_question_jobs,
    questions_for_length,
    resolve_mode,
)


def test_questions_for_length():
    assert questions_for_length(0) == 1
    assert questions_for_length(239) == 1
    assert questions_for_length(480) == 2
    assert questions_for_length(100_000) == 10  # capped
    assert questions_for_length(1000, chars_per_question=100, max_per_chunk=50) == 10


def test_auto_without_pairs_one_job_per_chunk():
    chunks = [ChunkInfo("c1", "d1", 1200), ChunkInfo("c2", "d1", 300)]
    jobs = plan_question_jobs(chunks, [])
    assert [(j.chunk_id, j.ga_pair_id, j.count) for j in jobs] == [("c1", None, 5), ("c2", None, 1)]


def test_auto_distributes_instead_of_multiplying():
    chunks = [ChunkInfo("c1", "d1", 1200)]  # 5 questions
    pairs = [GAInfo(f"g{i}", "d1") for i in range(5)]
    jobs = plan_question_jobs(chunks, pairs)
    assert sum(j.count for j in jobs) == 5
    assert len(jobs) == 2  # min 2 questions per call -> 2 pairs used
    assert all(j.count >= 2 for j in jobs)


def test_auto_prefers_own_document_pairs_and_rotates():
    chunks = [ChunkInfo(f"c{i}", "d1", 480) for i in range(3)]  # 2 questions each -> 1 pair each
    pairs = [GAInfo("other", "d2"), GAInfo("a", "d1"), GAInfo("b", "d1")]
    jobs = plan_question_jobs(chunks, pairs)
    assert [j.ga_pair_id for j in jobs] == ["a", "b", "a"]


def test_auto_falls_back_to_all_pairs():
    jobs = plan_question_jobs([ChunkInfo("c1", "d9", 480)], [GAInfo("x", "d1")])
    assert jobs[0].ga_pair_id == "x"


def test_per_combination_cross_product():
    chunks = [ChunkInfo("c1", "d1", 50), ChunkInfo("c2", "d1", 5000)]
    pairs = [GAInfo("a", "d1"), GAInfo("b", "d1"), GAInfo("c", "d1")]
    jobs = plan_question_jobs(chunks, pairs, mode="per_combination", questions_per_combination=3)
    assert len(jobs) == 6
    assert sum(j.count for j in jobs) == 18


def test_resolve_mode():
    assert resolve_mode("auto", True) == "auto"
    assert resolve_mode("per_combination", False) == "per_combination"
    assert resolve_mode(None, True) == "per_combination"
    assert resolve_mode(None, False) == "auto"


def test_estimate_matches_planner():
    chunks = [ChunkInfo("c1", "d1", 2400), ChunkInfo("c2", "d1", 300)]
    pairs = [GAInfo("a", "d1"), GAInfo("b", "d1")]
    est = estimate_question_generation_planned(chunks, pairs, provider="openai", model="gpt-4o-mini")
    jobs = plan_question_jobs(chunks, pairs)
    assert est.estimated_item_count == sum(j.count for j in jobs) == 11
    assert est.estimated_input_tokens > 0
    legacy = estimate_question_generation_planned(
        chunks, pairs, mode="per_combination", questions_per_combination=2,
    )
    assert legacy.estimated_item_count == 8


def test_api_mode_resolution_uses_fields_set():
    from app.api.questions import question_mode_for
    from app.schemas import QuestionGenerateRequest

    assert question_mode_for(QuestionGenerateRequest(chunk_ids=["c"])) == "auto"
    assert question_mode_for(QuestionGenerateRequest(chunk_ids=["c"], questions_per_combination=1)) == "per_combination"
    assert question_mode_for(QuestionGenerateRequest(
        chunk_ids=["c"], questions_per_combination=3, question_count_mode="auto",
    )) == "auto"
    assert question_mode_for(QuestionGenerateRequest(
        chunk_ids=["c"], question_count_mode="per_combination",
    )) == "per_combination"

import random

from app.services.generation.question_postprocess import (
    clean_question,
    dedupe_questions,
    is_meta_question,
    parse_questions_output,
    postprocess_questions,
    random_remove_question_mark,
)


def test_clean_strips_numbering_quotes_and_leadin():
    assert clean_question('1. "According to the text, what is a mutex lock?"') == "What is a mutex lock?"
    assert clean_question("- How does TCP retransmission work?") == "How does TCP retransmission work?"


def test_meta_questions_dropped():
    assert clean_question("Who is the author of this article?") is None
    assert clean_question("What does this passage say about caching?") is None
    assert clean_question("Which chapter covers indexing strategies?") is None
    assert is_meta_question("What is the title of the report?")
    assert not is_meta_question("How does a B-tree index speed up lookups?")


def test_too_short_dropped():
    assert clean_question("Why?") is None
    assert clean_question("What is X") is None  # fewer than 12 chars


def test_dedupe_exact_and_near():
    qs = [
        "What is the purpose of a load balancer?",
        "What is the purpose of a load balancer?",
        "what is the purpose of the load balancer",
        "How are TLS certificates rotated automatically?",
    ]
    out = dedupe_questions(qs)
    assert out == [
        "What is the purpose of a load balancer?",
        "How are TLS certificates rotated automatically?",
    ]


def test_dedupe_against_existing():
    out = dedupe_questions(
        ["How are TLS certificates rotated automatically?", "Why use connection pooling in databases?"],
        existing=["How are TLS certificates rotated automatically"],
    )
    assert out == ["Why use connection pooling in databases?"]


def test_parse_json_and_fallback_lines():
    assert parse_questions_output('["How does A work today?", {"question": "Why is B slow sometimes?"}]') == [
        "How does A work today?", "Why is B slow sometimes?",
    ]
    lines = parse_questions_output("1. How does A work today?\n2) Why is B slow sometimes? (extra)")
    assert lines == ["How does A work today?", "Why is B slow sometimes?"]


def test_postprocess_pipeline_limit_and_filters():
    raw = '```json\n["According to the passage, how is data replicated across zones?", ' \
          '"Who is the author of the document?", "How is data replicated across zones?", ' \
          '"What triggers an automatic failover event?", "Why are write quorums required?"]\n```'
    out = postprocess_questions(raw, limit=2)
    assert out == ["How is data replicated across zones?", "What triggers an automatic failover event?"]


def test_question_mark_removal_probability():
    qs = ["How does A work today?"] * 20
    assert random_remove_question_mark(qs, 0.0) == qs
    all_removed = random_remove_question_mark(qs, 1.0, rng=random.Random(1))
    assert all(not q.endswith("?") for q in all_removed)

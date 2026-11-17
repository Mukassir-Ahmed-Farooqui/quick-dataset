from app.services.generation.context import build_chunk_context, source_title_from_filename
from app.services.generation.llm_runner import _parse_duration
from app.services.generation.question_postprocess import clean_question, parse_questions_output


def test_groq_durations():
    assert _parse_duration("12") == 12.0
    assert abs(_parse_duration("577ms") - 0.577) < 1e-9
    assert _parse_duration("1m2.5s") == 62.5
    assert _parse_duration("1h9m7.2s") == 4147.2
    assert _parse_duration("nonsense") is None


def test_reasoning_leaks_rejected():
    assert clean_question("Maybe we should output an empty JSON array?") is None
    assert clean_question("Thus we have an impossible task. What should I do?") is None


def test_layout_and_bibliographic_trivia_rejected():
    for q in [
        "What information is presented on Page 14?",
        "Which figure illustrates the CSF Core structure?",
        "What type of errata change refined the requirements in section 4.4?",
        "What URL provides free access to NIST SP 800-63B?",
        "In what way does the guide distinguish adverse events from other events?",
    ]:
        assert clean_question(q) is None, q


def test_good_questions_kept():
    for q in [
        "Why should critical data backups be kept offline and encrypted?",
        "How does NIST SP 800-61r3 distinguish an adverse event from other events?",
        "Which agency offers a free vulnerability scanning service?",
    ]:
        assert clean_question(q) == q


def test_empty_array_means_no_questions():
    assert parse_questions_output("Nothing useful here.\n```json\n[]\n```") == []


def test_context_drops_page_markers_and_names_source():
    ctx = build_chunk_context("body", {"heading_path": ["Page 7"], "source_title": "nist csf 2.0"})
    assert "Page 7" not in ctx
    assert "Source document: nist csf 2.0" in ctx
    assert source_title_from_filename("sp800-61r3_incident_response.pdf") == "sp800-61r3 incident response"


def test_merge_small_chunks_drops_markers_and_folds_tiny():
    from app.services.chunking import merge_small_chunks
    out = merge_small_chunks(["## Page 7", "x" * 300, "tiny", "y" * 300], 200)
    assert out == ["x" * 300 + "\n\ntiny", "y" * 300]


def test_pdf_clean_pages_strips_headers_and_toc():
    from app.services.parsing.pdf_parser import clean_pages
    pages = [["NIST SP 800-61r3", f"Body about topic {chr(64 + i)}", "1.2 Purpose ........ 4", str(i)] for i in range(1, 9)]
    cleaned = clean_pages(pages)
    assert all(p == [f"Body about topic {chr(64 + i)}"] for i, p in enumerate(cleaned, 1))


def test_answers_do_not_cite_invisible_source():
    from app.services.generation.answer_generator import strip_referential_leadins as f
    assert f("IDENTIFY is first. The text explains that assets are categorized.") == "IDENTIFY is first. Assets are categorized."
    assert f("According to the source, backups must be offline.") == "Backups must be offline."
    assert f("The text box widget explains nothing.") == "The text box widget explains nothing."


def test_daily_quota_429_not_retried():
    import httpx
    from app.services.generation.llm_runner import is_retryable
    req = httpx.Request("POST", "https://api.groq.com/x")
    body = '{"error":{"message":"Rate limit reached ... on tokens per day (TPD): Limit 200000"}}'
    resp = httpx.Response(429, text=body, request=req)
    exc = httpx.HTTPStatusError("429", request=req, response=resp)
    assert not is_retryable(exc)
    resp2 = httpx.Response(429, text='{"error":{"message":"tokens per minute (TPM)"}}', request=req)
    assert is_retryable(httpx.HTTPStatusError("429", request=req, response=resp2))


def test_self_revision_prefix_stripped():
    from app.services.generation.question_postprocess import clean_question
    q = clean_question('Better: "What type of risk response relies on existing security controls?')
    assert q == "What type of risk response relies on existing security controls?"

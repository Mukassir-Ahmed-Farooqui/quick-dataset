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

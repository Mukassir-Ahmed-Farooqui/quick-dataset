import os

os.environ.setdefault("ENCRYPTION_SECRET_KEY", "x2bJ0b4yJm0jzKxL0hV6m3c3pS0n9uQ2YkqB0V8t3aE=")

from app.services.generation.context import (
    build_chunk_context,
    build_document_digest,
    count_tokens,
    ga_values,
    render_ga_question_block,
    render_prompt,
    truncate_to_tokens,
)
from app.services.generation.ga_generator import build_ga_prompt
from app.services.generation.question_generator import build_question_prompt


def test_render_leaves_json_braces_and_unknown_keys():
    tpl = 'Text: {content}\nN={number} {{number}}\nExample: {"genre": {"title": "x"}} {unknown}'
    out = render_prompt(tpl, {"content": "hello", "number": 3})
    assert out == 'Text: hello\nN=3 3\nExample: {"genre": {"title": "x"}} {unknown}'


def test_render_does_not_reexpand_values():
    out = render_prompt("{content} / {question}", {"content": "has {question} inside", "question": "Q"})
    assert out == "has {question} inside / Q"


def test_render_empty_values_returns_template():
    assert render_prompt("{a}", {}) == "{a}"


def test_chunk_context_prefix():
    out = build_chunk_context("body text", {"heading_path": ["Guide", "Install"], "summary": "How to install"})
    assert out.startswith("Section: Guide > Install\nSummary: How to install\n\nbody text")
    assert build_chunk_context("body", None) == "body"


def test_truncate_to_tokens():
    text = "word " * 5000
    cut = truncate_to_tokens(text, 100)
    assert count_tokens(cut) <= 100
    assert truncate_to_tokens("short", 100) == "short"


def test_ga_values_and_block():
    pair = {"genre_title": "Deep Dive", "genre_description": "Probing why.",
            "audience_title": "Students", "audience_description": "New learners."}
    g, a = ga_values(pair)
    assert g == "Deep Dive: Probing why." and a == "Students: New learners."
    block = render_ga_question_block(g, a)
    assert "Deep Dive: Probing why." in block and "Students: New learners." in block
    assert render_ga_question_block("", "") == ""


def test_question_prompt_with_and_without_ga():
    tpl = "Make {number} from {text_length} chars{ga_prompt_note}.\n{ga_prompt}\n{content}"
    pair = {"genre_title": "FAQ", "genre_description": "Short practical.",
            "audience_title": "Admins", "audience_description": "Busy operators."}
    out = build_question_prompt(tpl, chunk_text="abc def", chunk_metadata={"heading_path": ["H"]}, count=4, ga_pair=pair)
    assert "Make 4 from 7 chars, and incorporate" in out
    assert "FAQ: Short practical." in out and "Section: H" in out
    plain = build_question_prompt(tpl, chunk_text="abc def", chunk_metadata=None, count=2, ga_pair=None)
    assert plain == "Make 2 from 7 chars.\n\nabc def"


def test_document_digest_covers_whole_long_document():
    paras = [f"## Part {i}\n\n" + (f"Paragraph {i} text. " * 40) for i in range(60)]
    text = "# Title\n\n" + "\n\n".join(paras) + "\n\nTHE_END_MARKER sentence."
    assert len(text) > 40000
    digest = build_document_digest(text, max_chars=12000)
    assert len(digest) <= 12000 + 500
    assert "Document Outline" in digest
    assert "Part 59" in digest  # outline covers the end
    assert "Paragraph 0 text" in digest and "Paragraph 59 text" in digest
    short = "small doc"
    assert build_document_digest(short) == short


def test_ga_prompt_uses_digest():
    long_text = "Start. " + ("filler words here. " * 3000) + "FINAL_PART"
    out = build_ga_prompt("N={pairs_per_document}\n{content}", long_text, 5)
    assert out.startswith("N=5\n")
    assert "representative digest" in out
    assert "FINAL_PART" in out

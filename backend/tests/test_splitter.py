from app.services.chunking import chunk_document, preview_chunks
from app.services.chunking.markdown_splitter import (
    heading_paths_for_chunks,
    split_by_headings,
    split_markdown,
)

DOC = """# Guide

Intro paragraph that explains the guide in a few words.

## Install

Run the installer and follow the prompts carefully.

```bash
# not a heading inside a fence
pip install thing
```

### Linux

Use the package manager on Linux systems to install the thing.

## Usage

Call the API with your key and read the response.
"""


def test_split_by_headings_tracks_hierarchy_and_ignores_fences():
    sections = split_by_headings(DOC)
    paths = [s["heading_path"] for s in sections]
    assert ["Guide"] in paths
    assert ["Guide", "Install"] in paths
    assert ["Guide", "Install", "Linux"] in paths
    # sibling after a deeper section must not keep the stale "Install"/"Linux"
    assert ["Guide", "Usage"] in paths
    install = next(s for s in sections if s["heading_path"] == ["Guide", "Install"])
    assert "# not a heading inside a fence" in install["content"]
    assert not any("not a heading" in (s["heading"] or "") for s in sections)


def test_split_markdown_respects_max_size():
    long_body = "\n\n".join(f"Sentence number {i} is here to pad the section." for i in range(200))
    text = "# Big\n\n" + long_body
    chunks = split_markdown(text, chunk_size=500, chunk_overlap=50, min_chunk_size=100)
    assert len(chunks) > 5
    assert all(len(c["content"]) <= 500 for c in chunks)
    assert all(c["heading_path"] == ["Big"] for c in chunks)
    assert chunks[0].get("part") == 1


def test_split_markdown_merges_tiny_sections():
    text = "# A\n\nshort one.\n\n# B\n\nshort two.\n\n# C\n\nshort three."
    chunks = split_markdown(text, chunk_size=1000, chunk_overlap=0, min_chunk_size=200)
    assert len(chunks) == 1
    assert "short one." in chunks[0]["content"] and "short three." in chunks[0]["content"]
    assert "# B" in chunks[0]["content"]  # merged headings kept inline
    assert chunks[0]["headings"] == ["A", "B", "C"]


def test_chunk_document_markdown_strategy_has_tokens_and_paths():
    chunks = chunk_document(DOC, strategy="markdown", chunk_size=2000, chunk_overlap=0, min_chunk_size=10)
    assert chunks
    for c in chunks:
        assert c["token_count"] > 0
        assert "heading_path" in c


def test_chunk_document_recursive_strategy_gets_heading_paths():
    chunks = chunk_document(DOC, strategy="recursive", chunk_size=120, chunk_overlap=0)
    assert len(chunks) > 1
    assert all("heading_path" in c for c in chunks)
    usage = [c for c in chunks if "Call the API" in c["content"]]
    assert usage and usage[0]["heading_path"] == ["Guide", "Usage"]


def test_chunk_document_token_strategy():
    chunks = chunk_document(DOC * 5, strategy="token", chunk_size=60, chunk_overlap=0)
    assert len(chunks) > 1
    assert all(0 < c["token_count"] <= 60 for c in chunks)


def test_heading_paths_for_chunks_inherits_when_not_found():
    paths = heading_paths_for_chunks(DOC, ["Run the installer", "zzz not in text"])
    assert paths[0] == ["Guide", "Install"]
    assert paths[1] == ["Guide", "Install"]


def test_preview_chunks():
    out = preview_chunks(DOC, strategy="markdown", chunk_size=2000, chunk_overlap=0, preview_count=1, min_chunk_size=10)
    assert len(out["sample_chunks"]) == 1
    assert out["estimated_total_chunks"] >= 1


def test_empty_input():
    assert split_by_headings("") == []
    assert split_markdown("   ") == []

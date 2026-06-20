"""Unified chunking dispatcher — picks the right strategy."""
import tiktoken
from typing import List

from app.services.chunking.markdown_splitter import split_markdown
from app.services.chunking.langchain_splitters import split_recursive, split_by_tokens

ENCODER = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(ENCODER.encode(text))


def chunk_document(
    text: str,
    strategy: str = "recursive",
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
) -> List[dict]:
    """Chunk a document and return list of {content, token_count, heading_path} dicts."""
    if strategy == "markdown":
        raw = split_markdown(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        return [
            {
                "content": chunk["content"],
                "token_count": count_tokens(chunk["content"]),
                "heading_path": chunk.get("heading_path", []),
            }
            for chunk in raw
        ]

    if strategy == "token":
        return split_by_tokens(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    raw_chunks = split_recursive(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return [
        {"content": c, "token_count": count_tokens(c), "heading_path": []}
        for c in raw_chunks
    ]


def preview_chunks(
    text: str,
    strategy: str = "recursive",
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
    preview_count: int = 3,
) -> dict:
    """Preview first N chunks without persisting."""
    chunks = chunk_document(text, strategy=strategy, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return {
        "sample_chunks": [c["content"][:500] for c in chunks[:preview_count]],
        "estimated_total_chunks": len(chunks),
    }

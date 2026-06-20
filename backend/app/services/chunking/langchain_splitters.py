"""LangChain-powered splitting strategies — recursive and token-based."""
from typing import List
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    TokenTextSplitter,
)


def split_recursive(text: str, chunk_size: int = 1000, chunk_overlap: int = 100) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


def split_by_tokens(text: str, chunk_size: int = 1000, chunk_overlap: int = 100) -> List[dict]:
    """Token-based splitting using tiktoken. Returns list of {content, token_count} dicts."""
    splitter = TokenTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    raw_chunks = splitter.split_text(text)
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    return [
        {"content": chunk, "token_count": len(enc.encode(chunk))}
        for chunk in raw_chunks
    ]

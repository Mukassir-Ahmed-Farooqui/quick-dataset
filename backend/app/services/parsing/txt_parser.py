"""TXT → Markdown parser — wraps plain text as code fences or keeps as-is."""


async def parse_txt(file_bytes: bytes, filename: str) -> str:
    return file_bytes.decode("utf-8", errors="replace")

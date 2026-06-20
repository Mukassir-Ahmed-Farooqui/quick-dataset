"""MD passthrough parser — returns content as-is since it's already markdown."""


async def parse_md(file_bytes: bytes, filename: str) -> str:
    return file_bytes.decode("utf-8", errors="replace")

"""PDF → Markdown parser using pypdf."""
import io
from pypdf import PdfReader


async def parse_pdf(file_bytes: bytes, filename: str) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    parts = []
    for i, page in enumerate(reader.pages, 1):
        text = page.extract_text()
        if text and text.strip():
            parts.append(f"## Page {i}\n\n{text.strip()}")
    if not parts:
        parts.append("*(No extractable text found in PDF)*")
    return "\n\n".join(parts)

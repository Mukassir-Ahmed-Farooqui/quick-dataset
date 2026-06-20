"""DOCX → Markdown parser using python-docx."""
import io
from docx import Document


async def parse_docx(file_bytes: bytes, filename: str) -> str:
    doc = Document(io.BytesIO(file_bytes))
    parts = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        if para.style.name.startswith("Heading"):
            level = int(para.style.name.split()[-1]) if para.style.name.split()[-1].isdigit() else 1
            parts.append(f"{'#' * level} {text}")
        else:
            parts.append(text)
    return "\n\n".join(parts)

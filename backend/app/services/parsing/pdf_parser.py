"""PDF → Markdown parser using pdfplumber (replaces pypdf for much better text extraction).

pdfplumber extracts text character-by-character with precise positioning,
which handles multi-column layouts, tables, and complex PDFs far better
than pypdf's naive extract_text().
"""
import io
import pdfplumber


async def parse_pdf(file_bytes: bytes, filename: str) -> str:
    parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if text and text.strip():
                parts.append(f"## Page {i}\n\n{text.strip()}")
    if not parts:
        parts.append("*(No extractable text found in PDF)*")
    return "\n\n".join(parts)

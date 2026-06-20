"""Parse uploaded file bytes into clean markdown text — unified entry point."""
from app.services.parsing import pdf_parser, docx_parser, md_parser, txt_parser

PARSERS = {
    "pdf": pdf_parser.parse_pdf,
    "docx": docx_parser.parse_docx,
    "md": md_parser.parse_md,
    "txt": txt_parser.parse_txt,
}


async def parse_document(file_bytes: bytes, file_type: str, filename: str) -> str:
    parser = PARSERS.get(file_type)
    if parser is None:
        raise ValueError(f"Unsupported file type: {file_type}")
    return await parser(file_bytes, filename)

"""Quick script to check document status and chunk counts in the database."""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import Document, Chunk

db = SessionLocal()

project_id = "58431c57-c3ef-438c-940c-cdf65d6a400d"

print("=== ALL DOCUMENTS IN PROJECT ===")
docs = db.query(Document).filter(Document.project_id == project_id).all()
for d in docs:
    chunk_count = db.query(Chunk).filter(
        Chunk.document_id == d.id,
        Chunk.project_id == project_id,
        Chunk.deleted_at.is_(None)
    ).count()
    deleted_chunk_count = db.query(Chunk).filter(
        Chunk.document_id == d.id,
        Chunk.project_id == project_id,
        Chunk.deleted_at.isnot(None)
    ).count()
    print(f"  [{d.processing_status:8s}] {d.filename}")
    print(f"    id={d.id}")
    print(f"    deleted_at={d.deleted_at}")
    print(f"    chunks: {chunk_count} active, {deleted_chunk_count} soft-deleted")
    print()

print("=== DOCUMENTS VISIBLE (not soft-deleted, parsed) ===")
visible = db.query(Document).filter(
    Document.project_id == project_id,
    Document.deleted_at.is_(None),
    Document.processing_status == 'parsed'
).all()
for d in visible:
    print(f"  {d.filename} (id={d.id})")

print(f"\nTotal visible parsed docs: {len(visible)}")

db.close()

"""Phase 1: Database Truth Audit"""
import sys; sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.models import Document, Chunk, Task, Project
from sqlalchemy import func

db = SessionLocal()

doc_count = db.query(func.count(Document.id)).filter(Document.deleted_at.is_(None)).scalar() or 0
print(f'DOCUMENTS (active): {doc_count}')

rows = db.query(
    Document.id, Document.filename,
    func.count(Chunk.id).label('chunk_count')
).outerjoin(
    Chunk,
    (Chunk.document_id == Document.id) & (Chunk.deleted_at.is_(None))
).filter(
    Document.deleted_at.is_(None)
).group_by(Document.id, Document.filename).order_by(func.count(Chunk.id).desc()).all()

print('CHUNKS PER DOCUMENT:')
for r in rows:
    print(f'  {r.filename}: {r.chunk_count}')

total_chunks = db.query(func.count(Chunk.id)).filter(Chunk.deleted_at.is_(None)).scalar() or 0
print(f'TOTAL ACTIVE CHUNKS (DB): {total_chunks}')

soft_deleted = db.query(func.count(Chunk.id)).filter(Chunk.deleted_at.isnot(None)).scalar() or 0
print(f'SOFT-DELETED CHUNKS: {soft_deleted}')

tasks = db.query(Task).order_by(Task.created_at.desc()).limit(20).all()
print('RECENT TASKS:')
for t in tasks:
    print(f'  {t.task_type}: status={t.status.value} total={t.total_count} completed={t.completed_count} errors={t.error_count}')

db.close()

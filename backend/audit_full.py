"""Phases 1+2: DB + API audit."""
import sys; sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.models import Project, Document, Chunk, Task, User
from sqlalchemy import func

db = SessionLocal()

# Find the project with the most chunks
projects = db.query(Project).filter(Project.deleted_at.is_(None)).all()
print(f'PROJECTS: {len(projects)}')
for p in projects:
    c = db.query(func.count(Chunk.id)).filter(
        Chunk.project_id == p.id, Chunk.deleted_at.is_(None)
    ).scalar() or 0
    d = db.query(func.count(Document.id)).filter(
        Document.project_id == p.id, Document.deleted_at.is_(None)
    ).scalar() or 0
    owner = db.query(User).filter(User.id == p.owner_id).first()
    print(f'  {p.name} (by {owner.username if owner else "?"}): {d} docs, {c} chunks')

# Check for count/data mismatch
for p in projects:
    pid = p.id
    # Documents
    doc_count_q = db.query(func.count(Document.id)).filter(
        Document.project_id == pid, Document.deleted_at.is_(None)
    ).scalar() or 0
    docs = db.query(Document).filter(
        Document.project_id == pid, Document.deleted_at.is_(None)
    ).all()
    
    for d in docs:
        chunk_count_q = db.query(func.count(Chunk.id)).filter(
            Chunk.document_id == d.id, Chunk.deleted_at.is_(None)
        ).scalar() or 0
        print(f'  Doc {d.filename}: count={chunk_count_q} (has chunks)')

db.close()

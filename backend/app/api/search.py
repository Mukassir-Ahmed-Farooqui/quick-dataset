"""Global Search API — searches across documents, chunks, GA pairs, and questions."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from app.api.deps import get_db, get_current_user
from app.models import User
from app.schemas_extended import SearchResult, SearchResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/search", tags=["search"])


@router.get("", response_model=SearchResponse)
def global_search(
    project_id: str,
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search across documents, chunks, GA pairs, and questions.

    Uses the existing GIN indexes on chunks.content and questions.question
    for full-text search, plus ILIKE for text search on documents and
    GA pairs.

    Results are grouped by entity type and limited per type.
    """
    results: list[SearchResult] = []
    per_type_limit = limit // 4 + 1

    # 1. Search documents (by filename using ILIKE)
    doc_rows = (
        db.execute(
            text(
                "SELECT id, filename FROM documents "
                "WHERE project_id = :pid AND deleted_at IS NULL "
                "AND filename ILIKE :q "
                f"LIMIT {per_type_limit}"
            ),
            {"pid": project_id, "q": f"%{q}%"},
        ).fetchall()
    )
    for row in doc_rows:
        results.append(SearchResult(
            entity_type="document",
            entity_id=str(row[0]),
            title=row[1],
            snippet=f"Filename: {row[1]}",
        ))

    # 2. Search chunks (full-text via GIN index)
    try:
        chunk_rows = (
            db.execute(
                text(
                    "SELECT id, content FROM chunks "
                    "WHERE project_id = :pid AND deleted_at IS NULL "
                    "AND to_tsvector('english', content) @@ plainto_tsquery('english', :q) "
                    f"LIMIT {per_type_limit}"
                ),
                {"pid": project_id, "q": q},
            ).fetchall()
        )
        for row in chunk_rows:
            content = row[1]
            snippet = _make_snippet(content, q, 200)
            results.append(SearchResult(
                entity_type="chunk",
                entity_id=str(row[0]),
                title=f"Chunk ({len(content)} chars)",
                snippet=snippet,
            ))
    except Exception as e:
        logger.warning("Chunk full-text search failed (may be SQLite): %s", str(e))
        # Fallback: ILIKE
        chunk_rows = (
            db.execute(
                text(
                    "SELECT id, content FROM chunks "
                    "WHERE project_id = :pid AND deleted_at IS NULL "
                    "AND content ILIKE :q "
                    f"LIMIT {per_type_limit}"
                ),
                {"pid": project_id, "q": f"%{q}%"},
            ).fetchall()
        )
        for row in chunk_rows:
            content = row[1]
            snippet = _make_snippet(content, q, 200)
            results.append(SearchResult(
                entity_type="chunk",
                entity_id=str(row[0]),
                title=f"Chunk ({len(content)} chars)",
                snippet=snippet,
            ))

    # 3. Search GA pairs (by genre/audience title using ILIKE)
    ga_rows = (
        db.execute(
            text(
                "SELECT id, genre_title, audience_title FROM ga_pairs "
                "WHERE project_id = :pid "
                "AND (genre_title ILIKE :q OR audience_title ILIKE :q "
                "     OR genre_description ILIKE :q OR audience_description ILIKE :q) "
                f"LIMIT {per_type_limit}"
            ),
            {"pid": project_id, "q": f"%{q}%"},
        ).fetchall()
    )
    for row in ga_rows:
        results.append(SearchResult(
            entity_type="ga_pair",
            entity_id=str(row[0]),
            title=f"{row[1]} / {row[2]}",
            snippet=f"Genre: {row[1]}, Audience: {row[2]}",
        ))

    # 4. Search questions (full-text via GIN index)
    try:
        q_rows = (
            db.execute(
                text(
                    "SELECT id, question FROM questions "
                    "WHERE project_id = :pid AND deleted_at IS NULL "
                    "AND to_tsvector('english', question) @@ plainto_tsquery('english', :q) "
                    f"LIMIT {per_type_limit}"
                ),
                {"pid": project_id, "q": q},
            ).fetchall()
        )
        for row in q_rows:
            snippet = _make_snippet(row[1], q, 200)
            results.append(SearchResult(
                entity_type="question",
                entity_id=str(row[0]),
                title="Question",
                snippet=snippet,
            ))
    except Exception as e:
        logger.warning("Question full-text search failed (may be SQLite): %s", str(e))
        q_rows = (
            db.execute(
                text(
                    "SELECT id, question FROM questions "
                    "WHERE project_id = :pid AND deleted_at IS NULL "
                    "AND question ILIKE :q "
                    f"LIMIT {per_type_limit}"
                ),
                {"pid": project_id, "q": f"%{q}%"},
            ).fetchall()
        )
        for row in q_rows:
            snippet = _make_snippet(row[1], q, 200)
            results.append(SearchResult(
                entity_type="question",
                entity_id=str(row[0]),
                title="Question",
                snippet=snippet,
            ))

    return SearchResponse(results=results, total=len(results))


def _make_snippet(text: str, query: str, max_len: int = 200) -> str:
    """Create a snippet around the first occurrence of the query term."""
    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)
    if idx < 0:
        return text[:max_len] + ("..." if len(text) > max_len else "")

    start = max(0, idx - 80)
    end = min(len(text), idx + len(query) + 80)

    snippet = ""
    if start > 0:
        snippet += "..."
    snippet += text[start:end]
    if end < len(text):
        snippet += "..."

    if len(snippet) > max_len:
        # Center on the match
        mid = len(query) // 2
        half_len = max_len // 2
        start = max(0, idx - half_len + mid)
        snippet = text[start:start + max_len]
        if start > 0:
            snippet = "..." + snippet
        if start + max_len < len(text):
            snippet += "..."

    return snippet

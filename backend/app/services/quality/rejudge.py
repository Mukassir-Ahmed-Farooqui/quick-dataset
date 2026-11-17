"""Re-score existing dataset items with a judge, without regenerating answers.

Used for items held out because the judge was unavailable (a free tier's
daily quota), or to re-check a dataset with a different judge model.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models import Chunk, DatasetItem, PromptType
from app.services.generation.answer_generator import (
    JUDGE_TEMPERATURE, parse_judge_output,
)
from app.services.generation.context import render_prompt
from app.services.generation.llm_runner import LLMRunner
from app.services.generation.resolver import default_model_for, resolve_llm_config_with_model
from app.services.prompts.prompt_service import PromptService
from app.services.quality.grounding import grounding_report, is_grounded, needs_unseen_context

logger = logging.getLogger(__name__)
JUDGE_MAX_TOKENS = 600


def _runner(db, project_id, user_id, key_id, model, concurrency=2):
    cfg = resolve_llm_config_with_model(db, project_id, user_id, model=model or "",
                                        llm_key_id=key_id, temperature=JUDGE_TEMPERATURE, max_tokens=JUDGE_MAX_TOKENS)
    m = cfg.model or model or default_model_for(getattr(cfg, "provider", None))
    cfg.model = m
    # Low concurrency: free tiers cap tokens per minute (Groq: 8K), and a burst
    # of parallel judge calls just 429s together and retries in lockstep.
    return LLMRunner(db, project_id, cfg, m, concurrency=concurrency)


async def rejudge_items(
    db: Session, project_id: str, user_id: str, item_ids: list[str], *,
    judge_llm_key_id: Optional[str] = None, judge_model: Optional[str] = None,
    fallback_llm_key_id: Optional[str] = None, fallback_model: Optional[str] = None,
    min_quality_score: float = 0.8,
) -> dict:
    items = (db.query(DatasetItem)
             .filter(DatasetItem.project_id == project_id, DatasetItem.id.in_(item_ids),
                     DatasetItem.deleted_at.is_(None)).all())
    chunk_ids = {i.source_chunk_id for i in items if i.source_chunk_id}
    chunks = {c.id: c.content for c in db.query(Chunk).filter(Chunk.id.in_(chunk_ids)).all()} if chunk_ids else {}
    template = PromptService(db).get_active_prompt(project_id, PromptType.evaluation).content
    primary = _runner(db, project_id, user_id, judge_llm_key_id, judge_model)
    fallback = (_runner(db, project_id, user_id, fallback_llm_key_id, fallback_model)
                if (fallback_llm_key_id or fallback_model) else None)

    async def one(item: DatasetItem) -> dict:
        payload = item.payload or {}
        question, answer = payload.get("question", ""), payload.get("answer", "")
        source = chunks.get(item.source_chunk_id, "")
        g = grounding_report(answer, source, question)
        if needs_unseen_context(question):
            return {"id": item.id, "score": 0.5, "eval": "Question depends on unseen context", "grounding": g, "judge": "local"}
        if not is_grounded(g):
            return {"id": item.id, "score": 0.3, "eval": "Failed local grounding check", "grounding": g, "judge": "local"}
        prompt = render_prompt(template, {"content": source, "text": source, "question": question, "answer": answer})
        used = "primary"
        try:
            raw = await primary.complete(prompt, temperature=JUDGE_TEMPERATURE, max_tokens=JUDGE_MAX_TOKENS)
        except Exception as e:
            if fallback is None:
                return {"id": item.id, "error": str(e)[:300], "grounding": g}
            try:
                raw = await fallback.complete(prompt, temperature=JUDGE_TEMPERATURE, max_tokens=JUDGE_MAX_TOKENS)
                used = "fallback"
            except Exception as e2:
                return {"id": item.id, "error": str(e2)[:300], "grounding": g}
        score, raw_score, evaluation = parse_judge_output(raw)
        if score is None:
            return {"id": item.id, "error": "no score in judge output", "grounding": g}
        return {"id": item.id, "score": score, "raw": raw_score, "eval": evaluation, "grounding": g, "judge": used}

    results = await asyncio.gather(*(one(i) for i in items))
    by_id = {i.id: i for i in items}
    scored = errors = 0
    for r in results:
        item = by_id[r["id"]]
        meta = dict(item.item_metadata or {})
        meta["grounding"] = r["grounding"]
        if "error" in r:
            errors += 1
            meta["evaluation_error"] = r["error"]
            meta["below_threshold"] = True
            meta["needs_rejudge"] = True
        else:
            scored += 1
            item.score = r["score"]
            item.ai_evaluation = (r.get("eval") or None)
            meta.pop("evaluation_error", None)
            meta.pop("needs_rejudge", None)
            meta["below_threshold"] = r["score"] < min_quality_score
            meta["judge"] = r["judge"]
            if r.get("raw") is not None:
                meta["evaluation"] = {"raw_score": r["raw"], "scale": 5.0, "rejudged": True}
        item.item_metadata = meta
        flag_modified(item, "item_metadata")
    db.commit()
    accepted = sum(1 for i in items if not (i.item_metadata or {}).get("below_threshold"))
    return {"requested": len(item_ids), "found": len(items), "scored": scored,
            "errors": errors, "accepted": accepted}

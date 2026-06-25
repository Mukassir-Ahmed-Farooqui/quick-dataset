"""
Answer Generator — generates answers for questions, creating dataset items.

Follows the exact same architecture as ga_generator.py and question_generator.py:
    resolve_llm_config() → tracked_complete() → GenerationRunService
    → PromptService → TaskRepository → DatasetItemRepository

Supports dataset types:
- qa: question + answer
- mcq: question + options + correct_answer
- classification: text + label
"""

import json
import logging
from typing import Optional
from sqlalchemy.orm import Session, joinedload

from app.models import (
    DatasetItem, GenerationRunType, PromptType, DatasetType,
    AnswerType,
)
from app.repositories.task_repository import TaskRepository
from app.repositories.question_repository import QuestionRepository
from app.services.generation.resolver import resolve_llm_config_with_model
from app.services.generation.generation_run_service import GenerationRunService
from app.services.llm.tracked_call import tracked_complete
from app.services.prompts.prompt_service import PromptService

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-4o-mini"
MAX_RETRIES = 2


class DatasetItemRepository:
    """Simple repository for dataset_items operations."""

    def __init__(self, db: Session):
        self.db = db

    def bulk_create(self, items: list[DatasetItem]) -> list[DatasetItem]:
        self.db.add_all(items)
        self.db.commit()
        for item in items:
            self.db.refresh(item)
        return items

    def bulk_delete(self, project_id: str, ids: list[str]) -> int:
        from datetime import datetime
        from app.models import DatasetItem
        count = (
            self.db.query(DatasetItem)
            .filter(
                DatasetItem.id.in_(ids),
                DatasetItem.project_id == project_id,
                DatasetItem.deleted_at.is_(None),
            )
            .update({"deleted_at": datetime.utcnow()}, synchronize_session=False)
        )
        self.db.commit()
        return count

    def bulk_confirm(self, project_id: str, ids: list[str], confirmed: bool) -> int:
        from app.models import DatasetItem
        count = (
            self.db.query(DatasetItem)
            .filter(
                DatasetItem.id.in_(ids),
                DatasetItem.project_id == project_id,
                DatasetItem.deleted_at.is_(None),
            )
            .update({"confirmed": confirmed}, synchronize_session=False)
        )
        self.db.commit()
        return count

    def list_items(
        self,
        project_id: str,
        *,
        dataset_type: Optional[str] = None,
        confirmed: Optional[bool] = None,
        min_score: Optional[float] = None,
        generation_run_id: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[DatasetItem]:
        from app.models import DatasetItem
        q = self.db.query(DatasetItem).options(
            joinedload(DatasetItem.source_document),
            joinedload(DatasetItem.source_chunk)
        ).filter(
            DatasetItem.project_id == project_id,
            DatasetItem.deleted_at.is_(None),
        )
        if dataset_type:
            q = q.filter(DatasetItem.dataset_type == dataset_type)
        if confirmed is not None:
            q = q.filter(DatasetItem.confirmed == confirmed)
        if min_score is not None:
            q = q.filter(DatasetItem.score >= min_score)
        if generation_run_id:
            q = q.filter(DatasetItem.generation_run_id == generation_run_id)
        return q.order_by(DatasetItem.created_at.desc()).offset(skip).limit(limit).all()

    def count_items(
        self,
        project_id: str,
        *,
        dataset_type: Optional[str] = None,
        confirmed: Optional[bool] = None,
        min_score: Optional[float] = None,
        generation_run_id: Optional[str] = None,
    ) -> int:
        from sqlalchemy import func
        from app.models import DatasetItem
        q = self.db.query(func.count(DatasetItem.id)).filter(
            DatasetItem.project_id == project_id,
            DatasetItem.deleted_at.is_(None),
        )
        if dataset_type:
            q = q.filter(DatasetItem.dataset_type == dataset_type)
        if confirmed is not None:
            q = q.filter(DatasetItem.confirmed == confirmed)
        if min_score is not None:
            q = q.filter(DatasetItem.score >= min_score)
        if generation_run_id:
            q = q.filter(DatasetItem.generation_run_id == generation_run_id)
        return q.scalar() or 0

    def get_item(self, project_id: str, item_id: str) -> Optional[DatasetItem]:
        from app.models import DatasetItem
        return (
            self.db.query(DatasetItem)
            .filter(
                DatasetItem.id == item_id,
                DatasetItem.project_id == project_id,
                DatasetItem.deleted_at.is_(None),
            )
            .first()
        )

    def update_item(
        self,
        project_id: str,
        item_id: str,
        **kwargs,
    ) -> Optional[DatasetItem]:
        q = self.get_item(project_id, item_id)
        if not q:
            return None
        for k, v in kwargs.items():
            setattr(q, k, v)
        self.db.commit()
        self.db.refresh(q)
        return q

    def get_exportable_items(
        self,
        project_id: str,
        *,
        confirmed: Optional[bool] = True,
        min_score: Optional[float] = None,
        generation_run_id: Optional[str] = None,
    ) -> list[DatasetItem]:
        q = self.db.query(DatasetItem).filter(
            DatasetItem.project_id == project_id,
            DatasetItem.deleted_at.is_(None),
        )
        if confirmed is not None:
            q = q.filter(DatasetItem.confirmed == confirmed)
        if min_score is not None:
            q = q.filter(DatasetItem.score >= min_score)
        if generation_run_id:
            q = q.filter(DatasetItem.generation_run_id == generation_run_id)
        return q.order_by(DatasetItem.created_at.asc()).all()


async def generate_answers(
    db: Session,
    project_id: str,
    user_id: str,
    question_ids: list[str],
    *,
    dataset_type: DatasetType = DatasetType.qa,
    llm_key_id: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    existing_run_id: Optional[str] = None,
    existing_task_id: Optional[str] = None,
) -> dict:
    """Generate answers for the specified questions.

    This is the background task entry point. Manages full lifecycle:
    1. Loads questions + their chunks
    2. Creates GenerationRun + Task (unless existing_run_id/task_id provided)
    3. Loads prompt
    4. Resolves LLM config
    5. For each question, calls LLM to generate answer
    6. Validates output (MCQ: correct_answer ∈ options)
    7. Creates DatasetItem rows
    8. Completes/fails run and task

    Args:
        existing_run_id: If provided, use this pre-created run instead of creating a new one.
        existing_task_id: If provided, use this pre-created task instead of creating a new one.

    Returns:
        dict with task_id and generation_run_id.
    """
    question_repo = QuestionRepository(db)
    item_repo = DatasetItemRepository(db)
    task_repo = TaskRepository(db)
    run_svc = GenerationRunService(db)
    prompt_svc = PromptService(db)

    # 1. Load questions
    questions = question_repo.get_questions_by_ids(project_id, question_ids)
    if not questions:
        raise ValueError("No valid questions found")

    logger.info(
        "Answer generation starting | project=%s questions=%d type=%s",
        project_id, len(questions), dataset_type.value,
    )

    # 2. Load prompt
    prompt_out = prompt_svc.get_active_prompt(project_id, PromptType.answer)
    prompt_template = prompt_out.content
    prompt_version = prompt_out.version

    # 3. Resolve LLM config
    config = resolve_llm_config_with_model(
        db, project_id, user_id,
        model=model,
        llm_key_id=llm_key_id,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    # 4. Create or use existing generation run
    if existing_run_id:
        run = run_svc.get_run(existing_run_id)
        if not run:
            raise ValueError(f"Pre-created run {existing_run_id} not found")
        run_svc.start_run(existing_run_id)
        generation_run_id = existing_run_id
    else:
        run = run_svc.create_run(
            project_id=project_id,
            run_type=GenerationRunType.answer_generation,
            model_name=model,
            dataset_type=dataset_type,
            prompt_type=PromptType.answer,
            prompt_version=prompt_version,
            total_items=len(questions),
        )
        generation_run_id = str(run.id)

    # 5. Create or use existing task
    if existing_task_id:
        task = task_repo.get_task(existing_task_id)
        if not task:
            raise ValueError(f"Pre-created task {existing_task_id} not found")
        task_repo.start_task(existing_task_id)
        task_id = existing_task_id
    else:
        task = task_repo.create_task(
            project_id=project_id,
            task_type="answer-generation",
            total_count=len(questions),
            generation_run_id=generation_run_id,
        )
        task_repo.start_task(str(task.id))
        run_svc.start_run(generation_run_id)
        task_id = str(task.id)

    # 6. Generate answers
    all_items: list[DatasetItem] = []
    errors: list[dict] = []
    answered_question_ids: list[str] = []
    processed = 0

    import time
    from datetime import datetime

    try:
        for q_item in questions:
            q_start = time.time()
            logger.info("Question %s START at %s", q_item.id, datetime.utcnow().isoformat())
            # Load chunk content for context
            from app.repositories.chunk_repository import ChunkRepository
            chunk_repo = ChunkRepository(db)
            chunk = chunk_repo.get_chunk(project_id, q_item.chunk_id)
            content = chunk.content[:6000] if chunk else "No context available."

            # Build prompt
            prompt = prompt_template.replace("{content}", content)
            prompt = prompt.replace("{question}", q_item.question)

            raw_output = None
            last_error = None

            try:
                for attempt in range(MAX_RETRIES + 1):
                    try:
                        llm_start = time.time()
                        logger.info("LLM request START (attempt %d) at %s", attempt + 1, datetime.utcnow().isoformat())
                        response = await tracked_complete(
                            db=db,
                            project_id=project_id,
                            config=config,
                            messages=[{"role": "user", "content": prompt}],
                            model=model,
                            temperature=temperature,
                            max_tokens=max_tokens,
                            task_id=task_id,
                        )
                        logger.info("LLM request END at %s | latency: %.2fs", datetime.utcnow().isoformat(), time.time() - llm_start)
                        raw_output = response.content
                        break
                    except Exception as e:
                        last_error = str(e)
                        logger.warning(
                            "Answer LLM call failed (attempt %d/%d) | question=%s error=%s",
                            attempt + 1, MAX_RETRIES + 1, q_item.id, last_error,
                        )

                if raw_output is None:
                    errors.append({
                        "item_id": q_item.id,
                        "message": f"LLM call failed after {MAX_RETRIES + 1} attempts: {last_error}",
                    })
                    continue

                # Build payload based on dataset_type
                try:
                    logger.info("JSON parse START at %s", datetime.utcnow().isoformat())
                    payload = _build_payload(dataset_type, raw_output, q_item.question)
                    logger.info("JSON parse END at %s", datetime.utcnow().isoformat())
                    if payload is None:
                        errors.append({
                            "item_id": q_item.id,
                            "message": "Could not parse valid output from LLM",
                        })
                        continue

                    # Determine source document/chunk/GA pair
                    source_doc_id = chunk.document_id if chunk else None
                    source_chunk_id = chunk.id if chunk else None
                    source_ga_pair_id = q_item.ga_pair_id

                    item = DatasetItem(
                        project_id=project_id,
                        question_id=q_item.id,
                        generation_run_id=generation_run_id,
                        source_document_id=source_doc_id,
                        source_chunk_id=source_chunk_id,
                        source_ga_pair_id=source_ga_pair_id,
                        dataset_type=dataset_type,
                        payload=payload,
                        answer_type=AnswerType.text,
                    )
                    all_items.append(item)
                    logger.info("Dataset item created at %s", datetime.utcnow().isoformat())

                    # Track question ID for bulk update later
                    answered_question_ids.append(q_item.id)

                except Exception as e:
                    errors.append({
                        "item_id": q_item.id,
                        "message": f"Failed to create dataset item: {str(e)}",
                    })

            finally:
                processed += 1
                logger.info("Progress update START at %s", datetime.utcnow().isoformat())
                task_repo.update_progress(task_id, completed_increment=1)
                logger.info("Progress update END at %s", datetime.utcnow().isoformat())
                logger.info("Question %s DONE at %s | total time: %.2fs", q_item.id, datetime.utcnow().isoformat(), time.time() - q_start)


        # Bulk insert all items and mark questions answered atomically
        if all_items:
            db.add_all(all_items)
            
            from app.models import Question
            from datetime import datetime
            if answered_question_ids:
                db.query(Question).filter(
                    Question.id.in_(answered_question_ids),
                    Question.project_id == project_id
                ).update({
                    "answered": True,
                    "reviewed_at": datetime.utcnow()
                }, synchronize_session=False)
                
            logger.info("DB commit START at %s", datetime.utcnow().isoformat())
            db.commit()
            logger.info("DB commit END at %s", datetime.utcnow().isoformat())
            
            for item in all_items:
                db.refresh(item)

        # Complete run
        run_svc.complete_run(
            generation_run_id,
            processed_items=len(all_items),
            total_items=len(all_items),
        )

        # Complete task
        task_repo.complete_task(
            task_id,
            completed_count=processed,
            error_count=len(errors),
            total_count=len(questions),
        )

        logger.info(
            "Answer generation complete | project=%s questions=%d items=%d errors=%d",
            project_id, len(questions), len(all_items), len(errors),
        )

    except Exception as e:
        logger.error("Answer generation failed | project=%s error=%s", project_id, str(e))
        run_svc.fail_run(generation_run_id, error_message=str(e), processed_items=len(all_items))
        task_repo.fail_task(task_id, str(e))
        raise

    return {
        "task_id": task_id,
        "generation_run_id": generation_run_id,
    }

import re

def _clean_markdown(text: str) -> str:
    # Remove markdown headers
    text = re.sub(r'^(#{1,6})\s*', '', text, flags=re.MULTILINE)
    # Remove bold/italic markers
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'__(.*?)__', r'\1', text)
    text = re.sub(r'_(.*?)_', r'\1', text)
    # Remove markdown lists markers (bullet points)
    text = re.sub(r'^[\-\*\+]\s+', '', text, flags=re.MULTILINE)
    # Remove excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _build_payload(
    dataset_type: DatasetType,
    raw_output: str,
    question_text: str,
) -> Optional[dict]:
    """Build the appropriate payload dict based on dataset_type.

    Validates:
    - MCQ: correct_answer must be in options
    """
    if dataset_type == DatasetType.qa:
        return {
            "question": question_text,
            "answer": _clean_markdown(raw_output),
        }

    elif dataset_type == DatasetType.mcq:
        # Expect JSON with options + correct_answer
        cleaned = raw_output.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:])
            if "```" in cleaned:
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract JSON from text
            import re
            match = re.search(r"\{[\s\S]*\}", cleaned)
            if match:
                try:
                    data = json.loads(match.group())
                except json.JSONDecodeError:
                    return None
            else:
                return None

        options = data.get("options", [])
        correct_answer = data.get("correct_answer", data.get("answer", ""))

        if not isinstance(options, list) or len(options) < 2:
            return None

        # Validate correct_answer ∈ options
        if correct_answer not in options:
            # Try case-insensitive match
            matching = [o for o in options if o.lower() == correct_answer.lower()]
            if matching:
                correct_answer = matching[0]
            else:
                # Default to first option
                correct_answer = options[0]

        return {
            "question": question_text,
            "options": options,
            "correct_answer": correct_answer,
        }

    elif dataset_type == DatasetType.classification:
        # Expect "label: ..." or JSON with label
        cleaned = _clean_markdown(raw_output)
        # Try JSON first
        if cleaned.startswith("{"):
            try:
                data = json.loads(cleaned)
                return {
                    "text": question_text,
                    "label": data.get("label", cleaned[:100]),
                }
            except json.JSONDecodeError:
                pass

        # Try "Label: ..." format
        if ":" in cleaned:
            label = cleaned.split(":", 1)[1].strip()
            return {"text": question_text, "label": label[:200]}

        return {
            "text": question_text,
            "label": cleaned[:200],
        }

    return None

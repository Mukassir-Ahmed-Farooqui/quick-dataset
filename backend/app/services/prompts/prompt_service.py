"""
Prompt Versioning Service — append-only prompt management.

Rules (from rules.md Section 2):
- Prompts are append-only. upsert_prompt() always inserts a new
  custom_prompts row and demotes the previous one (is_active = false),
  never updates content in place.
- generation_runs.prompt_version points to a specific version that
  never changes — this is what makes the pointer permanent.

System defaults:
- When no custom prompt exists for a (project, prompt_type), the service
  returns a system default prompt (is_system_default=True, version=0).
- System defaults are defined per prompt_type and provide the base
  templates that ship with the application.
"""

import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import CustomPrompt, PromptType
from app.schemas_extended import PromptOut, PromptUpsertRequest

logger = logging.getLogger(__name__)

# ── System default prompts ──────────────────────────────────────────
# These ship with the application and serve as the base templates when
# no project-level override exists. They are not stored in the database.

SYSTEM_PROMPTS: dict[PromptType, str] = {
    PromptType.ga: (
        "You are a Genre/Audience pair generation expert. Your task is to "
        "analyze the provided document content and generate diverse, "
        "non-redundant Genre/Audience pairs that would be suitable for "
        "creating high-quality questions.\n\n"
        "A Genre is a category or style of content (e.g., 'Technical Documentation', "
        "'User Guide', 'Academic Paper', 'Troubleshooting Guide').\n"
        "An Audience is the target reader demographic (e.g., 'Software Engineers', "
        "'Medical Students', 'General Public', 'IT Administrators').\n\n"
        "IMPORTANT RULES:\n"
        "1. Generate exactly {pairs_per_document} different Genre/Audience pairs.\n"
        "2. Each pair must be distinct — avoid similar genres or audiences.\n"
        "3. Cover different aspects of the content across pairs.\n"
        "4. Be specific and descriptive in titles and descriptions.\n"
        "5. Return ONLY valid JSON — no explanations, no markdown, no code blocks.\n\n"
        "RESPONSE FORMAT (strict JSON array):\n"
        "[\n"
        "  {\n"
        "    \"genre\": {\"title\": \"...\", \"description\": \"...\"},\n"
        "    \"audience\": {\"title\": \"...\", \"description\": \"...\"}\n"
        "  }\n"
        "]\n\n"
        "Document content:\n{content}\n\n"
        "Generate exactly {pairs_per_document} Genre/Audience pairs in the exact JSON format specified above."
    ),
    PromptType.question: (
        "You are a question generation expert. Given the following chunk of "
        "content and a Genre/Audience specification, generate exactly "
        "{questions_per_combination} question(s) that test understanding of the "
        "content.\n\n"
        "Genre: {genre}\n"
        "Audience: {audience}\n\n"
        "Content:\n{content}\n\n"
        "IMPORTANT: Return ONLY a JSON array of strings. "
        "Example: [\"What is the main concept?\", \"How does this work?\"]\n"
        "No explanations, no numbering, no markdown. Valid JSON only."
    ),
    PromptType.answer: (
        "You are an answer generation expert. Given the following question and "
        "context, generate a thorough, accurate answer.\n\n"
        "Context:\n{content}\n\n"
        "Question:\n{question}\n\n"
        "Provide a clear, well-structured answer based solely on the context provided."
    ),
    PromptType.evaluation: (
        "You are an evaluation judge. Given the following question, context, and "
        "answer, evaluate the answer on a scale of 0.0 to 1.0 based on:\n"
        "- Correctness: Is the answer factually accurate?\n"
        "- Completeness: Does the answer fully address the question?\n"
        "- Clarity: Is the answer well-structured and easy to understand?\n\n"
        "Context:\n{content}\n\n"
        "Question:\n{question}\n\n"
        "Answer:\n{answer}\n\n"
        "Return a JSON object with 'score' (float 0.0-1.0) and 'evaluation' (string)."
    ),
    PromptType.conversation: (
        "You are a conversation generation expert. Create a conversation with "
        "{turn_count} turns between {role_a} and {role_b} based on the following "
        "context and question.\n\n"
        "Scenario: {scenario}\n\n"
        "Context:\n{content}\n\n"
        "Question:\n{question}\n\n"
        "Generate a natural, realistic conversation that explores the topic."
    ),
    PromptType.cot_synthesis: (
        "You are a chain-of-thought synthesis expert. Given the following "
        "question, answer, and context, generate a step-by-step reasoning "
        "trajectory that explains how one arrives at the given answer.\n\n"
        "Context:\n{content}\n\n"
        "Question:\n{question}\n\n"
        "Answer:\n{answer}\n\n"
        "Provide a clear, logical chain of thought that connects the question "
        "to the answer."
    ),
    PromptType.cot_optimization: (
        "You are a chain-of-thought optimization expert. Given the following "
        "question, answer, and current chain of thought, produce an optimized "
        "version that is more concise, clear, and logically structured.\n\n"
        "Context:\n{content}\n\n"
        "Question:\n{question}\n\n"
        "Answer:\n{answer}\n\n"
        "Current CoT:\n{cot}\n\n"
        "Provide an optimized chain of thought."
    ),
}


class PromptService:
    """Manages prompt versioning lifecycle."""

    def __init__(self, db: Session):
        self.db = db

    def get_active_prompt(
        self,
        project_id: str,
        prompt_type: PromptType,
    ) -> PromptOut:
        """Get the active prompt for a (project, prompt_type).

        Returns a PromptOut. If no project-level override exists, returns
        the system default with version=0 and is_system_default=True.

        Args:
            project_id: Project scope.
            prompt_type: Which prompt type to retrieve.

        Returns:
            PromptOut with content, version, and is_system_default flag.
        """
        # 1. Look for active project-level override
        active = (
            self.db.query(CustomPrompt)
            .filter(
                CustomPrompt.project_id == project_id,
                CustomPrompt.prompt_type == prompt_type,
                CustomPrompt.is_active == True,
            )
            .first()
        )

        if active:
            return PromptOut(
                prompt_type=active.prompt_type.value,
                content=active.content,
                version=active.version,
                is_system_default=False,
                created_at=active.created_at,
            )

        # 2. Return system default
        system_content = SYSTEM_PROMPTS.get(prompt_type, "")
        return PromptOut(
            prompt_type=prompt_type.value,
            content=system_content,
            version=0,
            is_system_default=True,
            created_at=None,
        )

    def upsert_prompt(
        self,
        project_id: str,
        prompt_type: PromptType,
        request: PromptUpsertRequest,
    ) -> PromptOut:
        """Create a new version of a prompt.

        Always inserts a new row with version + 1 and demotes the
        previous active version. Never updates content in place.

        Args:
            project_id: Project scope.
            prompt_type: Which prompt type to update.
            request: New content.

        Returns:
            PromptOut for the newly created version.
        """
        # 1. Get current max version
        max_version = (
            self.db.query(func.max(CustomPrompt.version))
            .filter(
                CustomPrompt.project_id == project_id,
                CustomPrompt.prompt_type == prompt_type,
            )
            .scalar()
        ) or 0

        # 2. Demote previous active version
        self.db.query(CustomPrompt).filter(
            CustomPrompt.project_id == project_id,
            CustomPrompt.prompt_type == prompt_type,
            CustomPrompt.is_active == True,
        ).update({"is_active": False})

        # 3. Create new version
        new_version = max_version + 1
        prompt = CustomPrompt(
            project_id=project_id,
            prompt_type=prompt_type,
            content=request.content,
            version=new_version,
            is_active=True,
        )
        self.db.add(prompt)
        self.db.commit()
        self.db.refresh(prompt)

        logger.info(
            "Prompt upserted | project=%s type=%s version=%d",
            project_id, prompt_type.value, new_version,
        )

        return PromptOut(
            prompt_type=prompt.prompt_type.value,
            content=prompt.content,
            version=prompt.version,
            is_system_default=False,
            created_at=prompt.created_at,
        )

    def get_prompt_version(
        self,
        project_id: str,
        prompt_type: PromptType,
        version: int,
    ) -> Optional[PromptOut]:
        """Get a specific version of a prompt.

        Args:
            project_id: Project scope.
            prompt_type: Which prompt type.
            version: Which version to retrieve (0 = system default).

        Returns:
            PromptOut or None if version not found.
        """
        if version == 0:
            system_content = SYSTEM_PROMPTS.get(prompt_type, "")
            return PromptOut(
                prompt_type=prompt_type.value,
                content=system_content,
                version=0,
                is_system_default=True,
                created_at=None,
            )

        prompt = (
            self.db.query(CustomPrompt)
            .filter(
                CustomPrompt.project_id == project_id,
                CustomPrompt.prompt_type == prompt_type,
                CustomPrompt.version == version,
            )
            .first()
        )

        if not prompt:
            return None

        return PromptOut(
            prompt_type=prompt.prompt_type.value,
            content=prompt.content,
            version=prompt.version,
            is_system_default=False,
            created_at=prompt.created_at,
        )

    def list_prompt_versions(
        self,
        project_id: str,
        prompt_type: PromptType,
    ) -> list[PromptOut]:
        """List all versions of a prompt type for a project.

        The system default (version 0) is always included as the first
        entry if it exists, followed by project overrides in descending
        version order.

        Args:
            project_id: Project scope.
            prompt_type: Which prompt type.

        Returns:
            List of PromptOut, newest version first.
        """
        results: list[PromptOut] = []

        # System default (version 0)
        system_content = SYSTEM_PROMPTS.get(prompt_type, "")
        results.append(PromptOut(
            prompt_type=prompt_type.value,
            content=system_content,
            version=0,
            is_system_default=True,
            created_at=None,
        ))

        # Project overrides
        overrides = (
            self.db.query(CustomPrompt)
            .filter(
                CustomPrompt.project_id == project_id,
                CustomPrompt.prompt_type == prompt_type,
            )
            .order_by(CustomPrompt.version.desc())
            .all()
        )

        results.extend(
            PromptOut(
                prompt_type=p.prompt_type.value,
                content=p.content,
                version=p.version,
                is_system_default=False,
                created_at=p.created_at,
            )
            for p in overrides
        )

        return results

    def get_system_default(self, prompt_type: PromptType) -> str:
        """Get the raw system default prompt text for a prompt type.

        Used for rendering in the playground without needing a project
        context.
        """
        return SYSTEM_PROMPTS.get(prompt_type, "")

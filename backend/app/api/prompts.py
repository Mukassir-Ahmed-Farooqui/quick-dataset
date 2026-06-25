"""Prompts API — version management, render preview, and test with LLM."""
import time
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found, bad_request
from app.models import User, PromptType as PromptTypeEnum
from app.services.prompts.prompt_service import PromptService
from app.services.generation.resolver import resolve_llm_config_with_model
from app.services.llm.provider_factory import ProviderFactory
from app.schemas_extended import (
    PromptOut,
    PromptRenderRequest,
    PromptRenderResponse,
    PromptTestRequest,
    PromptTestResponse,
    PromptUpsertRequest,
    PromptValidationError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/prompts", tags=["prompts"])


# ── List prompt types / versions ────────────────────────────────────

@router.get("/{prompt_type}", response_model=PromptOut)
def get_active_prompt(
    project_id: str,
    prompt_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the active prompt for a given prompt type."""
    try:
        ptype = PromptTypeEnum(prompt_type)
    except ValueError:
        raise bad_request(f"Invalid prompt_type: {prompt_type}")

    svc = PromptService(db)
    return svc.get_active_prompt(project_id, ptype)


@router.get("/{prompt_type}/versions", response_model=list[PromptOut])
def list_prompt_versions(
    project_id: str,
    prompt_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all versions of a prompt type, including system default (v0)."""
    try:
        ptype = PromptTypeEnum(prompt_type)
    except ValueError:
        raise bad_request(f"Invalid prompt_type: {prompt_type}")

    svc = PromptService(db)
    return svc.list_prompt_versions(project_id, ptype)


@router.get("/{prompt_type}/versions/{version}", response_model=PromptOut)
def get_prompt_version(
    project_id: str,
    prompt_type: str,
    version: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific version of a prompt."""
    try:
        ptype = PromptTypeEnum(prompt_type)
    except ValueError:
        raise bad_request(f"Invalid prompt_type: {prompt_type}")

    svc = PromptService(db)
    result = svc.get_prompt_version(project_id, ptype, version)
    if not result:
        raise not_found("Prompt version")
    return result


# ── Upsert (create new version) ─────────────────────────────────────

@router.put("/{prompt_type}", response_model=PromptOut)
def upsert_prompt(
    project_id: str,
    prompt_type: str,
    data: PromptUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new version of a prompt. Appends; never updates in place."""
    try:
        ptype = PromptTypeEnum(prompt_type)
    except ValueError:
        raise bad_request(f"Invalid prompt_type: {prompt_type}")

    svc = PromptService(db)
    return svc.upsert_prompt(project_id, ptype, data)


# ── Render preview (free — no LLM call) ─────────────────────────────

@router.post("/{prompt_type}/render", response_model=PromptRenderResponse)
def render_prompt_preview(
    project_id: str,
    prompt_type: str,
    data: PromptRenderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Render a prompt template with sample variables — free, no LLM call.

    Returns the rendered text plus any unresolved {{variables}}.
    """
    rendered = data.content
    unresolved: list[str] = []

    import re
    # Find all {{variable}} patterns
    variables_in_template = re.findall(r"\{\{(\w+)\}\}", rendered)

    for var in variables_in_template:
        if var in data.variables:
            rendered = rendered.replace("{{" + var + "}}", data.variables[var])
        else:
            unresolved.append(var)

    return PromptRenderResponse(
        rendered_prompt=rendered,
        unresolved_variables=unresolved,
    )


# ── Test with LLM (costs tokens) ────────────────────────────────────

@router.post("/{prompt_type}/test", response_model=PromptTestResponse)
async def test_prompt_with_llm(
    project_id: str,
    prompt_type: str,
    data: PromptTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test a rendered prompt against an actual LLM — costs tokens.

    This is a real LLM call. Use /render for free previews.
    """
    # Render the prompt first
    import re
    rendered = data.content
    unresolved: list[str] = []
    variables_in_template = re.findall(r"\{\{(\w+)\}\}", rendered)
    for var in variables_in_template:
        if var in data.variables:
            rendered = rendered.replace("{{" + var + "}}", data.variables[var])
        else:
            unresolved.append(var)

    if unresolved:
        # Still allow the test but warn
        logger.warning("Test has unresolved variables: %s", unresolved)

    # Resolve LLM config
    try:
        config = resolve_llm_config_with_model(
            db, project_id, str(current_user.id),
            model="gpt-4o-mini",
            llm_key_id=data.llm_key_id,
            temperature=0.7,
            max_tokens=2048,
        )
    except Exception as e:
        raise bad_request(f"Failed to resolve LLM config: {str(e)}")

    # Make the actual LLM call (not using tracked_complete since this is
    # a test, not a generation — but we still track usage)
    from app.services.llm.tracked_call import tracked_complete

    start_time = time.time()
    try:
        response = await tracked_complete(
            db=db,
            project_id=project_id,
            config=config,
            messages=[{"role": "user", "content": rendered}],
            model="gpt-4o-mini",
            temperature=0.7,
            max_tokens=2048,
            task_id=None,
        )

        latency_ms = int((time.time() - start_time) * 1000)

        return PromptTestResponse(
            rendered_prompt=rendered,
            llm_output=response.content,
            input_tokens=response.prompt_tokens,
            output_tokens=response.completion_tokens,
            latency_ms=latency_ms,
        )
    except Exception as e:
        raise bad_request(f"LLM test failed: {str(e)}")

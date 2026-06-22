"""
Tracked LLM call wrapper — every LLM call in the application MUST pass
through tracked_complete(), never a bare provider client call.

This guarantees exactly one llm_usage_logs row per call, success or
failure, with no exceptions. A generator that calls a provider client
directly, bypassing this wrapper, breaks cost tracking silently.

Usage:
    response = await tracked_complete(
        db=db,
        project_id=project_id,
        config=resolved_config,      # from resolve_llm_config()
        task_id=task_id,             # optional — links usage to task
        messages=[{"role": "user", "content": "..."}],
        model="gpt-4o",
        temperature=0.7,
        max_tokens=4096,
    )
"""

import time
import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.core.pricing import estimate_cost_usd
from app.models import LLMUsageLog, LLMProvider
from app.schemas_extended import LLMResponse
from app.services.generation.resolver import ResolvedLLMConfig
from app.services.llm.provider_factory import ProviderFactory

logger = logging.getLogger(__name__)


async def tracked_complete(
    db: Session,
    project_id: str,
    config: ResolvedLLMConfig,
    messages: list[dict],
    model: str,
    *,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    task_id: Optional[str] = None,
) -> LLMResponse:
    """Make an LLM call with full tracking: latency, tokens, cost, logging.

    Guarantees exactly one LLMUsageLog row per call regardless of outcome.
    On failure, logs the error and re-raises the original exception.

    Args:
        db: Active database session.
        project_id: Project scope for the usage log.
        config: Resolved LLM config (from resolve_llm_config()).
        messages: Chat messages in OpenAI format.
        model: Model name string (e.g. "gpt-4o", "claude-3-opus").
        temperature: Sampling temperature.
        max_tokens: Maximum tokens to generate.
        task_id: Optional task id to link usage to a background task.

    Returns:
        LLMResponse with generated content and token counts.

    Raises:
        Original exception from the provider client. The usage log is
        written before re-raising so even failed calls are recorded.
    """
    start_time = time.time()
    provider_name = config.provider
    llm_key_id = config.llm_key_id
    input_tokens = 0
    output_tokens = 0
    error_message: Optional[str] = None
    status = "success"

    try:
        # Create provider client
        provider = ProviderFactory.create(provider_name, config.api_key)

        # Make the actual LLM call
        response = await provider.complete(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        latency_ms = int((time.time() - start_time) * 1000)
        input_tokens = response.prompt_tokens
        output_tokens = response.completion_tokens

        # Compute estimated cost
        estimated_cost = estimate_cost_usd(
            provider=provider_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        # Write success usage log
        _write_usage_log(
            db=db,
            project_id=project_id,
            user_llm_key_id=llm_key_id,
            task_id=task_id,
            provider=provider_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost,
            latency_ms=latency_ms,
            status="success",
            error_message=None,
        )

        logger.info(
            "LLM call OK | provider=%s model=%s tokens_in=%d tokens_out=%d cost=%.6f latency=%dms",
            provider_name, model, input_tokens, output_tokens, estimated_cost or 0, latency_ms,
        )

        return response

    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        status = "error"

        # Write failure usage log (input_tokens may be partial or 0)
        _write_usage_log(
            db=db,
            project_id=project_id,
            user_llm_key_id=llm_key_id,
            task_id=task_id,
            provider=provider_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=0,
            estimated_cost_usd=0.0,
            latency_ms=latency_ms,
            status="error",
            error_message=error_message,
        )

        logger.error(
            "LLM call FAILED | provider=%s model=%s latency=%dms error=%s",
            provider_name, model, latency_ms, error_message,
        )

        raise


def _write_usage_log(
    db: Session,
    project_id: str,
    user_llm_key_id: str,
    task_id: Optional[str],
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    estimated_cost_usd: Optional[float],
    latency_ms: int,
    status: str,
    error_message: Optional[str],
) -> None:
    """Write a single LLMUsageLog row. This is extracted so success and
    failure paths share the exact same write logic with no drift."""
    log_entry = LLMUsageLog(
        project_id=project_id,
        user_llm_key_id=user_llm_key_id,
        task_id=task_id,
        provider=provider,  # stored as string, validated upstream
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=estimated_cost_usd,
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
    )
    db.add(log_entry)
    db.commit()

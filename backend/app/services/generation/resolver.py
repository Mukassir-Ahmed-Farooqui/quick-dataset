"""
LLM configuration resolver — single chokepoint for resolving effective
LLM configuration before any generation call.

Priority chain (highest to lowest):
1. Request-level llm_key_id override (from GenerationConfigBase)
2. Project's default_llm_key_id
3. First available key for the project's owner

Every generation service MUST call resolve_llm_config() before making
any LLM call. No service may read project.default_llm_key_id or a raw
llm_key_id directly — that bypasses validation, decryption, and the
resolution chain documented here.

Usage:
    config = resolve_llm_config(db, project_id, user_id, llm_key_id=override)
    provider = ProviderFactory.create(config.provider, config.api_key)
    response = await provider.complete(messages, config.model, ...)
"""

from dataclasses import dataclass
from typing import Optional
from sqlalchemy.orm import Session

from app.core.exceptions import bad_request
from app.core.crypto import decrypt
from app.models import Project, UserLLMKey, LLMProvider
from app.repositories.llm_key_repository import LLMKeyRepository


@dataclass
class ResolvedLLMConfig:
    """Resolved, validated, decrypted LLM configuration ready for use.

    Every generation service receives this object — never access
    project.default_llm_key_id or raw key rows directly.
    """
    provider: str           # e.g. "openai", "groq"
    model: str              # e.g. "gpt-4o", "llama-3-70b"
    api_key: str            # decrypted, ready to pass to provider client
    llm_key_id: str         # the resolved key's id (for usage logging)
    temperature: float      # effective temperature
    max_tokens: int         # effective max_tokens


def resolve_llm_config(
    db: Session,
    project_id: str,
    user_id: str,
    *,
    llm_key_id: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> ResolvedLLMConfig:
    """Resolve effective LLM configuration.

    Args:
        db: Active database session.
        project_id: Project scope (validated for ownership before calling).
        user_id: Current user id (for key ownership validation).
        llm_key_id: Optional request-level override. If None, falls back
            to project.default_llm_key_id, then the user's first default key.
        temperature: Override temperature (default 0.7).
        max_tokens: Override max_tokens (default 4096).

    Returns:
        ResolvedLLMConfig with decrypted api_key and resolved model.

    Raises:
        AppException (400): If no key can be resolved or key is invalid.
    """
    repo = LLMKeyRepository(db)
    db_key: Optional[UserLLMKey] = None

    # Priority 1: Request-level override
    if llm_key_id:
        db_key = repo.get_key_by_id(user_id, llm_key_id)

    # Priority 2: Project default key
    if not db_key:
        project = (
            db.query(Project)
            .filter(
                Project.id == project_id,
                Project.owner_id == user_id,
                Project.deleted_at.is_(None),
            )
            .first()
        )
        if project and project.default_llm_key_id:
            db_key = repo.get_key_by_id(user_id, str(project.default_llm_key_id))

    # Priority 3: First available default key for user
    if not db_key:
        db_key = (
            db.query(UserLLMKey)
            .filter(
                UserLLMKey.user_id == user_id,
                UserLLMKey.is_default == True,
            )
            .first()
        )

    if not db_key:
        raise bad_request(
            "No LLM key found. Add an API key in Providers settings.",
            "NO_LLM_KEY",
        )

    # Decrypt the API key
    try:
        raw_api_key = decrypt(db_key.encrypted_api_key)
    except Exception as e:
        raise bad_request(
            f"Failed to decrypt API key for {db_key.name}",
            "KEY_DECRYPTION_FAILED",
        )

    return ResolvedLLMConfig(
        provider=db_key.provider.value,
        model="",  # model is set by the specific generator, not the resolver
        api_key=raw_api_key,
        llm_key_id=str(db_key.id),
        temperature=temperature,
        max_tokens=max_tokens,
    )


def resolve_llm_config_with_model(
    db: Session,
    project_id: str,
    user_id: str,
    model: str,
    *,
    llm_key_id: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> ResolvedLLMConfig:
    """Convenience wrapper: resolve config AND set model in one call.

    Most generators know their model at call time — this avoids the
    two-step pattern of resolve + assign model separately.
    """
    config = resolve_llm_config(
        db, project_id, user_id,
        llm_key_id=llm_key_id,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    config.model = model
    return config

import hashlib
import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found
from app.models import User
from app.repositories.llm_key_repository import LLMKeyRepository
from app.schemas import (
    LLMKeyCreate, LLMKeyUpdate, LLMKeyOut, LLMKeyTestResult, LLMKeyModelsOut,
    PaginatedResponse, pagination_meta,
)
from app.services.llm.provider_factory import ProviderFactory
from app.services.llm import model_catalog
from app.services.generation.resolver import default_model_for
from app.core.crypto import decrypt

logger = logging.getLogger(__name__)
_fetched_at: dict[str, datetime] = {}

router = APIRouter(prefix="/providers", tags=["providers"])

@router.post("", response_model=LLMKeyOut, status_code=status.HTTP_201_CREATED)
def create_provider(data: LLMKeyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = LLMKeyRepository(db)
    return repo.create_key(str(current_user.id), data)

@router.patch("/{key_id}", response_model=LLMKeyOut)
def update_provider(
    key_id: str,
    data: LLMKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit an API key's name, api_key (rotation), or is_default flag."""
    repo = LLMKeyRepository(db)
    result = repo.update_key(str(current_user.id), key_id, data)
    if not result:
        raise not_found("API Key")
    if data.api_key is not None:
        model_catalog.cache_clear(key_id)  # rotated key may see other models
    return result

@router.get("")
def list_providers(
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = LLMKeyRepository(db)
    total = repo.count_keys(str(current_user.id))
    rows = repo.list_keys(str(current_user.id), skip=(page - 1) * page_size, limit=page_size)

    items = []
    for key in rows:
        # Decrypt and mask — the ORM model has encrypted_api_key, not masked_key
        try:
            raw_key = decrypt(key.encrypted_api_key)
            masked_key = repo._mask_key(raw_key)
        except Exception:
            masked_key = "***"

        items.append(LLMKeyOut(
            id=str(key.id),
            provider=key.provider.value if hasattr(key.provider, 'value') else str(key.provider),
            name=key.name,
            masked_key=masked_key,
            is_default=key.is_default,
            is_valid=key.is_valid,
            last_validated_at=key.last_validated_at,
            created_at=key.created_at,
            selected_model=key.selected_model,
        ))

    return PaginatedResponse(items=items, pagination=pagination_meta(page, page_size, total))

@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider(key_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = LLMKeyRepository(db)
    success = repo.delete_key(str(current_user.id), key_id)
    if not success:
        raise not_found("Provider")
    model_catalog.cache_clear(key_id)
    return None


@router.get("/{key_id}/models", response_model=LLMKeyModelsOut)
async def list_provider_models(
    key_id: str,
    refresh: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Live list of chat models this key can use, cached for about an hour.

    Speech, guard/moderation, embedding and image models are filtered out.
    Pass ``refresh=true`` to bypass the cache.
    """
    repo = LLMKeyRepository(db)
    db_key = repo.get_key_by_id(str(current_user.id), key_id)
    if not db_key:
        raise not_found("Provider")

    provider_name = db_key.provider.value
    try:
        raw_key = decrypt(db_key.encrypted_api_key)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to decrypt API key")
    # Fingerprint so a rotated key never reads the old key's cache entry.
    fingerprint = hashlib.sha256(raw_key.encode()).hexdigest()[:16]

    models = None if refresh else model_catalog.cache_get(key_id, fingerprint)
    cached = models is not None
    if models is None:
        try:
            models = await ProviderFactory.create(provider_name, raw_key).list_models()
        except httpx.HTTPStatusError as e:
            code = e.response.status_code
            detail = {401: "Invalid API key (401 Unauthorized)", 403: "Permission denied (403)",
                      429: "Rate limit exceeded (429)"}.get(code, f"Provider returned HTTP {code}")
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not list models: {detail}")
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not list models: {e}")
        model_catalog.cache_put(key_id, fingerprint, models)
        _fetched_at[key_id] = datetime.utcnow()

    return LLMKeyModelsOut(
        provider=provider_name,
        selected_model=db_key.selected_model,
        default_model=default_model_for(provider_name),
        models=[m.model_dump() for m in models],
        cached=cached,
        fetched_at=_fetched_at.get(key_id),
    )

@router.post("/{key_id}/test", response_model=LLMKeyTestResult)
async def test_provider(
    key_id: str,
    model: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = LLMKeyRepository(db)
    db_key = repo.get_key_by_id(str(current_user.id), key_id)
    
    if not db_key:
        raise not_found("Provider")
        
    try:
        raw_key = decrypt(db_key.encrypted_api_key)
        provider_client = ProviderFactory.create(db_key.provider, raw_key)
        fallback = default_model_for(db_key.provider.value)
        # Explicit ?model= wins, then the key's picked model, then the default.
        test_model = (model or "").strip() or db_key.selected_model or fallback
        test_result = await provider_client.test_connection(model=test_model)

        warning = None
        if not test_result.success and test_model != fallback and _looks_unavailable(test_result.error):
            logger.warning("Test model %r unavailable for key %s; retrying with %r", test_model, key_id, fallback)
            retry = await provider_client.test_connection(model=fallback)
            if retry.success:
                warning = (
                    f"Model '{test_model}' is unavailable (it may have been retired). "
                    f"The key works with '{fallback}'. Pick a new model for this key."
                )
                test_result = retry

        repo.update_validation_status(str(current_user.id), key_id, test_result.success)

        return LLMKeyTestResult(
            success=test_result.success,
            provider=test_result.provider,
            model=test_result.model,
            latency_ms=test_result.latency_ms,
            error=test_result.error,
            warning=warning,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        repo.update_validation_status(str(current_user.id), key_id, False)
        return LLMKeyTestResult(
            success=False,
            provider=db_key.provider.value,
            model=model or "unknown",
            latency_ms=None,
            error=str(e)
        )


def _looks_unavailable(error: str | None) -> bool:
    """Test errors that mean 'bad model', not 'bad key'."""
    e = (error or "").lower()
    if any(code in e for code in ("401", "402", "403", "429")):
        return False
    return any(m in e for m in (
        "404", "400", "decommissioned", "model_not_found", "does not exist",
        "not found", "invalid model", "no longer supported",
    ))

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.exceptions import not_found
from app.models import User
from app.repositories.llm_key_repository import LLMKeyRepository
from app.schemas import LLMKeyCreate, LLMKeyUpdate, LLMKeyOut, LLMKeyTestResult, PaginatedResponse, pagination_meta
from app.services.llm.provider_factory import ProviderFactory
from app.core.crypto import decrypt

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
        ))

    return PaginatedResponse(items=items, pagination=pagination_meta(page, page_size, total))

@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider(key_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = LLMKeyRepository(db)
    success = repo.delete_key(str(current_user.id), key_id)
    if not success:
        raise not_found("Provider")
    return None

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
        test_result = await provider_client.test_connection(model=model)
        
        repo.update_validation_status(str(current_user.id), key_id, test_result.success)
        
        return LLMKeyTestResult(
            success=test_result.success,
            provider=test_result.provider,
            model=test_result.model,
            latency_ms=test_result.latency_ms,
            error=test_result.error
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

from sqlalchemy.orm import Session
from datetime import datetime
from app.models import UserLLMKey, LLMProvider
from app.schemas import LLMKeyCreate, LLMKeyOut, LLMKeyTestResult
from app.core.crypto import encrypt

class LLMKeyRepository:
    def __init__(self, db: Session):
        self.db = db

    def _mask_key(self, api_key: str) -> str:
        if not api_key:
            return ""
        if len(api_key) <= 9:
            return "***"
        return f"{api_key[:5]}...{api_key[-4:]}"

    def get_keys_for_user(self, user_id: str) -> list[LLMKeyOut]:
        db_keys = self.db.query(UserLLMKey).filter(UserLLMKey.user_id == user_id).all()
        result = []
        for key in db_keys:
            # Reconstruct masked key from encrypted_api_key? 
            # No! Masked key should not be decypted just to be masked. 
            # Wait, the prompt says mask the raw key. Since we only have encrypted_api_key in DB,
            # we should decrypt it here to mask it? 
            # Let's decrypt it to mask it, or store the masked key alongside the encrypted key?
            # Storing the masked_key in the DB would be much faster. But schema.md doesn't have it.
            # So we decrypt it to mask it.
            from app.core.crypto import decrypt
            try:
                raw_key = decrypt(key.encrypted_api_key)
                masked_key = self._mask_key(raw_key)
            except Exception:
                masked_key = "***"

            result.append(
                LLMKeyOut(
                    id=str(key.id),
                    provider=key.provider.value,
                    name=key.name,
                    is_default=key.is_default,
                    created_at=key.created_at,
                    masked_key=masked_key,
                    is_valid=key.is_valid,
                    last_validated_at=key.last_validated_at
                )
            )
        return result

    def get_key_by_id(self, user_id: str, key_id: str) -> UserLLMKey | None:
        return self.db.query(UserLLMKey).filter(
            UserLLMKey.id == key_id,
            UserLLMKey.user_id == user_id
        ).first()

    def create_key(self, user_id: str, data: LLMKeyCreate) -> LLMKeyOut:
        # If is_default is true, set all other keys to false
        if data.is_default:
            self.db.query(UserLLMKey).filter(UserLLMKey.user_id == user_id).update({"is_default": False})

        encrypted_key = encrypt(data.api_key)
        
        db_key = UserLLMKey(
            user_id=user_id,
            provider=LLMProvider(data.provider),
            name=data.name,
            encrypted_api_key=encrypted_key,
            is_default=data.is_default,
            is_valid=None,
            last_validated_at=None
        )
        self.db.add(db_key)
        self.db.commit()
        self.db.refresh(db_key)
        
        return LLMKeyOut(
            id=str(db_key.id),
            provider=db_key.provider.value,
            name=db_key.name,
            is_default=db_key.is_default,
            created_at=db_key.created_at,
            masked_key=self._mask_key(data.api_key),
            is_valid=db_key.is_valid,
            last_validated_at=db_key.last_validated_at
        )

    def update_validation_status(self, user_id: str, key_id: str, is_valid: bool) -> None:
        db_key = self.get_key_by_id(user_id, key_id)
        if db_key:
            db_key.is_valid = is_valid
            db_key.last_validated_at = datetime.utcnow()
            self.db.commit()

    def delete_key(self, user_id: str, key_id: str) -> bool:
        db_key = self.get_key_by_id(user_id, key_id)
        if not db_key:
            return False
        self.db.delete(db_key)
        self.db.commit()
        return True

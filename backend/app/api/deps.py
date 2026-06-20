from typing import Generator
from fastapi import Depends
from fastapi.security import HTTPBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.exceptions import unauthorized
from app.models import User
from app.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    credentials=Depends(bearer_scheme),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise unauthorized()
    except JWTError:
        raise unauthorized()

    repo = UserRepository(db)
    user = repo.get_user_by_id(user_id)
    if user is None:
        raise unauthorized()
    return user

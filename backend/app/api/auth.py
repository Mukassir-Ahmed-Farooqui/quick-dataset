from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.core.exceptions import already_exists, invalid_credentials, unauthorized
from app.models import User
from app.repositories.user_repository import UserRepository
from app.schemas import RegisterRequest, LoginRequest, RefreshTokenRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    repo = UserRepository(db)
    if repo.get_user_by_email(data.email):
        raise already_exists("Email", data.email)
    if repo.get_user_by_username(data.username):
        raise already_exists("Username", data.username)
    user = repo.create_user(data)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    repo = UserRepository(db)
    user = repo.get_user_by_email(data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise invalid_credentials()
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    from jose import JWTError
    try:
        payload = decode_refresh_token(data.refresh_token)
    except JWTError:
        raise unauthorized()
    repo = UserRepository(db)
    user = repo.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }

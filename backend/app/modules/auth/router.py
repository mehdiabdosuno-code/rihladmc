"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, decode_refresh_token, create_access_token, create_refresh_token
from app.modules.auth.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserResponse,
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
_limiter = Limiter(key_func=get_remote_address)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
@_limiter.limit("3/minute")
async def register(
    request: Request,
    body: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    service = AuthService(db)
    return service.register(body)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User login",
)
@_limiter.limit("5/minute")
async def login(
    request: Request,
    body: UserLoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate user and receive JWT token.

    - **email**: User email
    - **password**: User password

    Returns access token with 24-hour expiration.
    """
    service = AuthService(db)
    user, token, refresh = service.login(body)
    return TokenResponse(access_token=token, refresh_token=refresh, expires_in=3600)


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange refresh token for new access + refresh tokens",
)
async def refresh(body: RefreshRequest) -> TokenResponse:
    payload = decode_refresh_token(body.refresh_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    claims = {"sub": payload["sub"]}
    return TokenResponse(
        access_token=create_access_token(claims),
        refresh_token=create_refresh_token(claims),
        expires_in=3600,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user info",
)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Get information about the currently authenticated user.

    Requires valid JWT token in Authorization header.
    """
    service = AuthService(db)
    user_response = service.get_user_by_id(current_user["sub"])
    if not user_response:
        from app.shared.exceptions import NotFoundError
        raise NotFoundError("User not found")
    return user_response

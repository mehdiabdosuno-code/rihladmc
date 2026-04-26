"""Pydantic schemas for authentication endpoints."""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from app.modules.auth.models import RoleEnum
from app.shared.schemas import BaseResponse


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token (7 days)")
    token_type: str = Field(default="bearer", description="Token type (always 'bearer')")
    expires_in: int = Field(..., description="Token expiration in seconds")


class UserRegisterRequest(BaseModel):
    """User registration request."""

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password (min 8 chars)")
    full_name: str = Field(..., min_length=1, description="Full name")
    role: RoleEnum = Field(default=RoleEnum.SALES_AGENT, description="User role")


class UserLoginRequest(BaseModel):
    """User login request."""

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="Password")


class PermissionResponse(BaseModel):
    """Permission response."""

    id: str = Field(..., description="Permission ID")
    name: str = Field(..., description="Permission name")
    module: str = Field(..., description="Module this permission belongs to")
    description: Optional[str] = Field(None, description="Permission description")


class RoleResponse(BaseModel):
    """Role response."""

    id: str = Field(..., description="Role ID")
    name: RoleEnum = Field(..., description="Role name")
    description: Optional[str] = Field(None, description="Role description")
    permissions: list[PermissionResponse] = Field(default_factory=list, description="Permissions in this role")

    class Config:
        from_attributes = True


class UserResponse(BaseResponse):
    """User response."""

    email: str = Field(..., description="User email")
    full_name: Optional[str] = Field(None, description="User full name")
    is_active: bool = Field(..., description="Whether user is active")
    role: RoleResponse = Field(..., description="User role with permissions")
    permissions: list[str] = Field(default_factory=list, description="List of permission names")

    class Config:
        from_attributes = True

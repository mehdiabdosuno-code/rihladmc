"""Pydantic schemas for Companies module."""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, Field


class CompanyBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=16)
    name: str = Field(..., min_length=1, max_length=255)
    legal_name: Optional[str] = None
    tax_id: Optional[str] = Field(None, max_length=64)
    address: Optional[dict[str, Any]] = None
    currency: str = Field("MAD", min_length=3, max_length=3)
    fiscal_year_start: int = Field(1, ge=1, le=12)
    settings: Optional[dict[str, Any]] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    address: Optional[dict[str, Any]] = None
    currency: Optional[str] = None
    fiscal_year_start: Optional[int] = None
    settings: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class CompanyOut(CompanyBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserCompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    company_id: str
    role: str
    is_default: bool


class CompanyWithRoleOut(CompanyOut):
    """Company enriched with the current user's role within it."""
    user_role: str
    is_default: bool


class SwitchCompanyRequest(BaseModel):
    company_id: str


class SwitchCompanyResponse(BaseModel):
    access_token: str
    refresh_token: str
    company: CompanyWithRoleOut

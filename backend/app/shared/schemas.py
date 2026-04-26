"""Shared base Pydantic schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BaseResponse(BaseModel):
    """Base response with common fields."""
    id: str = Field(..., description="Entity UUID")
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    active: bool = True

    class Config:
        from_attributes = True

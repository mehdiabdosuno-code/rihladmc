"""AI schemas — Pydantic v2 schemas for AI operations."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AIRequestCreate(BaseModel):
    provider: str = Field(..., max_length=50)
    model: str = Field(..., max_length=100)
    request_type: str = Field(..., max_length=50)
    project_id: UUID | None = None

class AIRequestRead(BaseModel):
    id: UUID
    user_id: UUID | None
    project_id: UUID | None
    provider: str
    model: str
    request_type: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal | None
    duration_ms: int | None
    status: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

class AIGenerateRequest(BaseModel):
    """Request to generate content via AI (Claude or Ollama)."""
    prompt: str
    provider: str = "anthropic"  # 'anthropic' or 'ollama'
    model: str = "claude-3-5-sonnet-20240620"
    max_tokens: int = 4096
    temperature: float = 0.7
    project_id: UUID | None = None

class AIGenerateResponse(BaseModel):
    """Response from AI content generation."""
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    duration_ms: int

class AITranscribeRequest(BaseModel):
    """Request to transcribe audio via Whisper."""
    language: str = "fr"
    project_id: UUID | None = None

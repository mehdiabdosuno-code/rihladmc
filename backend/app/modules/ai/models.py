"""AI models — SQLAlchemy 2.0 models for AI usage tracking."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class AIRequest(Base):
    """Tracks AI API requests for auditing and cost management."""

    __tablename__ = "ai_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    project_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    provider = Column(String(50), nullable=False)  # anthropic, openai
    model = Column(String(100), nullable=False)  # claude-opus-4-20250514, whisper-1
    request_type = Column(String(50), nullable=False)  # generation, transcription, analysis
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_usd = Column(Numeric(10, 6), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    status = Column(String(20), default="success")  # success, error, timeout
    error_message = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

"""Expense models — Tracking field expenditures and OCR data."""

from sqlalchemy import Column, String, Float, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from datetime import datetime
from app.shared.models import Base, BaseMixin

class FieldExpense(Base, BaseMixin):
    """Expenses reported by guides or drivers during a mission."""
    __tablename__ = "field_expenses"

    project_id: Mapped[str] = mapped_column(String(50), index=True)
    user_id: Mapped[str] = mapped_column(String(50), index=True)
    
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="MAD")
    category: Mapped[str] = mapped_column(String(100)) # Restaurant, Toll, Parking, Misc
    
    receipt_url: Mapped[Optional[str]] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # OCR Results
    ocr_data: Mapped[Optional[dict]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(50), default="pending") # pending, approved, rejected
    
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    approved_by: Mapped[Optional[str]] = mapped_column(String(50))

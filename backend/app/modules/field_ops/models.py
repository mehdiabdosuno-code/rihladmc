"""Field Operations models — Guide and Driver assignments and incidents."""

from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin

class TaskStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    DELAYED = "delayed"
    CANCELLED = "cancelled"

class TaskType(str, Enum):
    TRANSFER = "transfer"
    TOUR = "tour"
    MEAL = "meal"
    CHECKIN = "checkin"
    OTHER = "other"

class FieldTask(Base, BaseMixin):
    """Specific assignment for field staff (Guide/Driver)."""
    __tablename__ = "field_tasks"

    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), index=True)
    staff_id: Mapped[str] = mapped_column(String(36), index=True) # Linked to User.id (Guide/Driver)
    
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    task_type: Mapped[TaskType] = mapped_column(String(50), default=TaskType.OTHER)
    status: Mapped[TaskStatus] = mapped_column(String(50), default=TaskStatus.PENDING)
    
    start_time: Mapped[Optional[str]] = mapped_column(String(50)) # e.g. "09:00"
    location: Mapped[Optional[str]] = mapped_column(String(200))
    pax_count: Mapped[Optional[int]] = mapped_column(Integer)
    vehicle_info: Mapped[Optional[str]] = mapped_column(String(200))
    
    project = relationship("Project")

class FieldIncident(Base, BaseMixin):
    """Incident reported from the field."""
    __tablename__ = "field_incidents"

    task_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("field_tasks.id"), nullable=True)
    staff_id: Mapped[str] = mapped_column(String(36), index=True)
    
    severity: Mapped[str] = mapped_column(String(20), default="medium") # low, medium, high, critical
    message: Mapped[str] = mapped_column(Text)
    is_resolved: Mapped[bool] = mapped_column(default=False)
    resolved_at: Mapped[Optional[str]] = mapped_column(String(50))
    
    task = relationship("FieldTask")

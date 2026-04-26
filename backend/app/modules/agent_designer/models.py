"""Joule Agent Designer — no-code agent definitions and run history."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class AgentDesign(Base, BaseMixin):
    """A user-designed agent: DAG of nodes (trigger → fetch → logic → action)."""

    __tablename__ = "agent_designs"

    name:        Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status:      Mapped[str] = mapped_column(String(20), default="draft", index=True)  # draft | active | paused
    trigger:     Mapped[str] = mapped_column(String(40), default="manual")             # manual | cron | event:<name>
    nodes:       Mapped[list] = mapped_column(JSON, default=list)
    # nodes: [{id, type, label, config: {...}, next: [next_id_yes, next_id_no?]}]
    icon:        Mapped[str] = mapped_column(String(40), default="Bot")
    color:       Mapped[str] = mapped_column(String(20), default="violet")
    template_key: Mapped[Optional[str]] = mapped_column(String(60), index=True)


class AgentRun(Base, BaseMixin):
    """A single execution of an AgentDesign — log of node-by-node outcomes."""

    __tablename__ = "agent_runs"

    agent_id:    Mapped[str] = mapped_column(String(36), index=True)
    status:      Mapped[str] = mapped_column(String(20), default="pending", index=True)
    # pending | running | success | failed
    started_at:  Mapped[Optional[str]] = mapped_column(String(40))
    finished_at: Mapped[Optional[str]] = mapped_column(String(40))
    duration_ms: Mapped[int] = mapped_column(default=0)
    trace:       Mapped[list] = mapped_column(JSON, default=list)
    # trace: [{node_id, label, type, status, output, error?, ts}]
    error:       Mapped[Optional[str]] = mapped_column(Text)

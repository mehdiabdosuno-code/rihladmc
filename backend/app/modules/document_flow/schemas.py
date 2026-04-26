"""Document Flow — schema definitions for the graph response."""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel


NodeType = Literal["project", "quotation", "proposal", "invoice", "payment"]


class FlowNode(BaseModel):
    id: str  # graph-unique: "{type}:{db_id}"
    type: NodeType
    label: str
    status: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    db_id: str
    created_at: Optional[datetime] = None
    meta: dict = {}


class FlowEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None


class FlowGraph(BaseModel):
    project_id: str
    nodes: list[FlowNode]
    edges: list[FlowEdge]

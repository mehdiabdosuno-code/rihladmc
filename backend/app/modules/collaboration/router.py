"""Collaboration Router — /api/collaboration."""

from fastapi import APIRouter, Depends, Body
from typing import List

from app.modules.collaboration.service import CollaborationService
from app.modules.auth.models import User
from app.shared.dependencies import require_auth

router = APIRouter(prefix="/collaboration", tags=["Collaboration"])

@router.post("/presence/{project_id}")
def report_presence(
    project_id: str, 
    user: User = Depends(require_auth),
    svc: CollaborationService = Depends(CollaborationService)
):
    """Notify system that user is viewing/editing this project."""
    svc.report_presence(project_id, user.id, user.full_name)
    return {"status": "ok", "active_users": svc.get_active_users(project_id)}

@router.get("/presence/{project_id}")
def get_active_users(
    project_id: str,
    svc: CollaborationService = Depends(CollaborationService)
):
    """Get the list of active users on a project."""
    return svc.get_active_users(project_id)

@router.post("/lock/{resource_id}")
def acquire_lock(
    resource_id: str,
    user: User = Depends(require_auth),
    svc: CollaborationService = Depends(CollaborationService)
):
    """Lock a specific line or resource."""
    success = svc.acquire_lock(resource_id, user.id)
    return {"success": success}

@router.delete("/lock/{resource_id}")
def release_lock(
    resource_id: str,
    user: User = Depends(require_auth),
    svc: CollaborationService = Depends(CollaborationService)
):
    """Unlock a specific line or resource."""
    svc.release_lock(resource_id, user.id)
    return {"status": "released"}

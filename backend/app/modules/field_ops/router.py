"""Field Operations router — Managing guide/driver tasks and incident reporting."""

import hashlib
import hmac
import json
import base64
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as _BM
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional

from app.core.database import get_db
from app.core.config import settings
from app.shared.dependencies import require_auth
from app.modules.field_ops.models import FieldTask, FieldIncident, TaskStatus
from app.modules.notifications.service import push_notification


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _sign_voucher(task_id: str, days_valid: int = 7) -> str:
    """Create a compact signed voucher token: base64(payload).sig"""
    exp = int((datetime.utcnow() + timedelta(days=days_valid)).timestamp())
    payload = {"tid": task_id, "exp": exp}
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(settings.SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64url(sig)}"


def _verify_voucher(token: str) -> Optional[dict]:
    try:
        body, sig = token.split(".")
        expected = hmac.new(settings.SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(sig), expected):
            return None
        payload = json.loads(_b64url_decode(body))
        if payload.get("exp", 0) < int(datetime.utcnow().timestamp()):
            return None
        return payload
    except Exception:
        return None


class IncidentRequest(_BM):
    message: str
    severity: str = "medium"
    task_id: str | None = None


router = APIRouter(prefix="/field-ops", tags=["field-ops"], dependencies=[Depends(require_auth)])
public_router = APIRouter(prefix="/field-ops", tags=["field-ops-public"])

@router.get("/tasks", response_model=List[dict])
def get_my_tasks(
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Retrieve all tasks assigned to the current guide/driver."""
    user_id = current_user.get("sub") or current_user.get("id")
    tasks = db.execute(
        select(FieldTask).where(FieldTask.staff_id == user_id).order_by(FieldTask.start_time)
    ).scalars().all()
    
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "task_type": t.task_type,
            "status": t.status,
            "time": t.start_time,
            "location": t.location,
            "pax_count": t.pax_count,
            "vehicle": t.vehicle_info,
            "project_id": t.project_id
        }
        for t in tasks
    ]

@router.patch("/tasks/{task_id}/status")
def update_task_status(
    task_id: str,
    new_status: TaskStatus,
    db: Session = Depends(get_db)
):
    """Update status of a field task (e.g., mark as completed)."""
    task = db.get(FieldTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = new_status
    db.commit()
    return {"id": task_id, "status": new_status}

@router.post("/incidents")
def report_incident(
    body: IncidentRequest,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Report an incident from the field. Alerts the travel designer via notification."""
    user_id = current_user.get("sub") or current_user.get("id")
    
    incident = FieldIncident(
        staff_id=user_id,
        task_id=body.task_id,
        message=body.message,
        severity=body.severity
    )
    db.add(incident)
    db.commit()
    
    # Logic to notify the travel designer/admin would go here
    # Example: notification_service.send_to_project_owner(incident.task.project_id, ...)
    
    return {"id": incident.id, "status": "reported"}


# ── Voucher / QR endpoints (C6) ────────────────────────────────────────
@router.get("/tasks/{task_id}/voucher")
def get_task_voucher(task_id: str, db: Session = Depends(get_db)):
    """Generate a signed voucher token for QR code (valid 7 days).

    Returns task details + token. The QR code on the field encodes the public
    verification URL so any operator can scan and verify on the spot.
    """
    task = db.get(FieldTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    token = _sign_voucher(task_id)
    return {
        "task_id": task.id,
        "title": task.title,
        "location": task.location,
        "time": task.start_time,
        "pax_count": task.pax_count,
        "vehicle": task.vehicle_info,
        "voucher_token": token,
        "voucher_url": f"/api/field-ops/vouchers/verify?token={token}",
        "expires_in_days": 7,
    }


@public_router.get("/vouchers/verify")
def verify_voucher(token: str, db: Session = Depends(get_db)):
    """Public-friendly endpoint to validate a voucher QR token.

    Used by hotel reception, restaurant staff, etc. to verify a guest is
    genuinely covered by a confirmed booking from this DMC.
    """
    payload = _verify_voucher(token)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired voucher")
    task = db.get(FieldTask, payload["tid"])
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "valid": True,
        "task": {
            "id": task.id,
            "title": task.title,
            "location": task.location,
            "time": task.start_time,
            "pax_count": task.pax_count,
            "vehicle": task.vehicle_info,
            "status": task.status,
        },
        "expires_at": payload["exp"],
    }


# ── Offline queue sync (C6) ────────────────────────────────────────────
class QueuedUpdate(_BM):
    task_id: str
    status: str
    timestamp: Optional[int] = None


class SyncRequest(_BM):
    updates: List[QueuedUpdate]


@router.post("/sync")
def bulk_sync(
    body: SyncRequest,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Apply queued offline updates in bulk when connectivity is restored."""
    applied = []
    skipped = []
    for u in body.updates:
        task = db.get(FieldTask, u.task_id)
        if not task:
            skipped.append({"task_id": u.task_id, "reason": "not_found"})
            continue
        try:
            task.status = TaskStatus(u.status)
            applied.append(u.task_id)
        except ValueError:
            skipped.append({"task_id": u.task_id, "reason": "invalid_status"})
    db.commit()
    return {"applied": applied, "skipped": skipped, "total": len(body.updates)}

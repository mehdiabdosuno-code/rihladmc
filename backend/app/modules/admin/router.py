"""Admin router — User management, role assignment, system stats, and audit logs.

Endpoints:
    GET    /admin/users              — List all users (super_admin only)
    POST   /admin/users              — Create user with role
    GET    /admin/users/{id}         — Get user details
    PUT    /admin/users/{id}         — Update user (name, email, role)
    PATCH  /admin/users/{id}/status  — Activate / deactivate user
    DELETE /admin/users/{id}         — Hard delete (super_admin only)

    GET    /admin/roles              — List roles with permissions
    POST   /admin/roles/{id}/permissions — Assign permissions to role

    GET    /admin/stats              — System-wide stats for dashboard
    GET    /admin/audit              — Audit log (paginated, filterable)
"""

from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr, Field

from app.core.database import get_db
from app.core.security import hash_password
from app.shared.dependencies import require_role
from app.modules.auth.models import User, Role, RoleEnum, Permission
from app.modules.admin.models import AuditLog, AuditAction
from app.modules.projects.models import Project
from app.modules.quotations.models import Quotation

# All admin endpoints require super_admin or sales_director
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_role("super_admin", "sales_director"))],
)

SUPER_ADMIN_ONLY = [Depends(require_role("super_admin"))]

# ── Schemas ───────────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8)
    role_name: RoleEnum


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role_name: Optional[RoleEnum] = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    is_active: bool
    role_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8)


# ── Helpers ───────────────────────────────────────────────────────────────


def _get_role(db: Session, role_name: RoleEnum) -> Role:
    role = db.execute(select(Role).where(Role.name == role_name)).scalars().first()
    if not role:
        raise HTTPException(
            status_code=400,
            detail=f"Rôle '{role_name}' inexistant. Lancez l'initialisation des rôles.",
        )
    return role


def _user_out(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "role_name": user.role.name if user.role else "—",
        "created_at": user.created_at,
    }


def _log_action(
    db: Session,
    action: AuditAction,
    entity_type: str,
    entity_id: str,
    user_id: Optional[str] = None,
    description: Optional[str] = None,
    changes: Optional[dict] = None,
    request: Optional[Request] = None,
):
    ip = request.client.host if request and request.client else None
    ua = request.headers.get("user-agent") if request else None
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=changes,
        ip_address=ip,
        user_agent=ua,
        description=description,
    )
    db.add(log)


# ════════════════════════════════════════════════════════════════════════════
# USER MANAGEMENT
# ════════════════════════════════════════════════════════════════════════════


@router.get("/users", summary="List all users")
def list_users(
    is_active: Optional[bool] = Query(None),
    role: Optional[RoleEnum] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return paginated list of users with optional filters."""
    q = select(User)

    if is_active is not None:
        q = q.where(User.is_active == is_active)
    if search:
        q = q.where(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
    if role:
        role_obj = db.execute(select(Role).where(Role.name == role)).scalars().first()
        if role_obj:
            q = q.where(User.role_id == role_obj.id)

    users = db.execute(q.offset(skip).limit(limit)).scalars().all()
    return [_user_out(u) for u in users]


@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
    summary="Create user with role",
    dependencies=SUPER_ADMIN_ONLY,
)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create a new platform user. Requires super_admin."""
    # Uniqueness check
    existing = db.execute(select(User).where(User.email == payload.email)).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Email '{payload.email}' déjà utilisé.")

    role = _get_role(db, payload.role_name)
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role_id=role.id,
    )
    db.add(user)
    db.flush()

    _log_action(db, AuditAction.CREATE, "User", user.id,
                description=f"Created user {payload.email} with role {payload.role_name}",
                request=request)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.get("/users/{user_id}", summary="Get user by ID")
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return _user_out(user)


@router.put(
    "/users/{user_id}",
    summary="Update user details",
    dependencies=SUPER_ADMIN_ONLY,
)
def update_user(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    before = {"email": user.email, "full_name": user.full_name, "role_id": user.role_id}

    if payload.email:
        clash = db.execute(
            select(User).where(User.email == payload.email, User.id != user_id)
        ).scalars().first()
        if clash:
            raise HTTPException(status_code=409, detail="Email déjà utilisé.")
        user.email = payload.email
    if payload.full_name:
        user.full_name = payload.full_name
    if payload.role_name:
        role = _get_role(db, payload.role_name)
        user.role_id = role.id

    after = {"email": user.email, "full_name": user.full_name, "role_id": user.role_id}
    _log_action(db, AuditAction.UPDATE, "User", user_id,
                changes={"before": before, "after": after}, request=request)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.patch("/users/{user_id}/status", summary="Activate or deactivate user")
def toggle_user_status(
    user_id: str,
    is_active: bool,
    request: Request,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    user.is_active = is_active
    _log_action(db, AuditAction.UPDATE, "User", user_id,
                description=f"{'Activated' if is_active else 'Deactivated'} user {user.email}",
                request=request)
    db.commit()
    return {"id": user_id, "is_active": is_active}


@router.patch(
    "/users/{user_id}/password",
    summary="Reset user password",
    dependencies=SUPER_ADMIN_ONLY,
)
def reset_password(
    user_id: str,
    payload: PasswordReset,
    request: Request,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    user.password_hash = hash_password(payload.new_password)
    _log_action(db, AuditAction.UPDATE, "User", user_id,
                description=f"Password reset for {user.email}", request=request)
    db.commit()
    return {"message": "Mot de passe réinitialisé avec succès."}


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Hard delete user",
    dependencies=SUPER_ADMIN_ONLY,
)
def delete_user(user_id: str, request: Request, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    _log_action(db, AuditAction.DELETE, "User", user_id,
                description=f"Deleted user {user.email}", request=request)
    db.delete(user)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# ROLES & PERMISSIONS
# ════════════════════════════════════════════════════════════════════════════


@router.get("/roles", summary="List roles with user count")
def list_roles(db: Session = Depends(get_db)):
    """Return all roles with their user count."""
    # Single query: count users per role_id
    counts_rows = db.execute(
        select(User.role_id, func.count(User.id).label("cnt"))
        .group_by(User.role_id)
    ).all()
    counts = {row.role_id: row.cnt for row in counts_rows}

    roles = db.execute(select(Role)).scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "user_count": counts.get(r.id, 0),
            "permissions": [p.name for p in (r.permissions or [])],
        }
        for r in roles
    ]


@router.post(
    "/roles/initialize",
    summary="Initialize default roles",
    dependencies=SUPER_ADMIN_ONLY,
)
def initialize_roles(db: Session = Depends(get_db)):
    """Create all default roles if they don't exist. Safe to call multiple times."""
    defaults = [
        (RoleEnum.SUPER_ADMIN,      "CEO / Admin — accès total à toutes les fonctionnalités"),
        (RoleEnum.SALES_DIRECTOR,   "Directeur Transport & Opérations — gestion flotte, flux transport, planning"),
        (RoleEnum.TRAVEL_DESIGNER,  "Travel Designer — création circuits, cotations, itinéraires, menus, transports"),
        (RoleEnum.QUOTATION_OFFICER,"Directeur Financier — devis, factures, reporting financier"),
        (RoleEnum.DATA_OPERATOR,    "Opérateur Data — saisie et maintenance des données inventaire"),
        (RoleEnum.SALES_AGENT,      "Commercial / Agent — lecture seule, consultation projets"),
        (RoleEnum.GUIDE,            "Guide — portail guide, agenda de travail, remarques circuit"),
        (RoleEnum.CLIENT,           "Client — portail client, téléchargement documents, avis prestataires"),
    ]
    created = []
    for role_name, desc in defaults:
        exists = db.execute(select(Role).where(Role.name == role_name)).scalars().first()
        if not exists:
            role = Role(name=role_name, description=desc)
            db.add(role)
            created.append(role_name)
    db.commit()
    return {"created": created, "message": f"{len(created)} rôle(s) initialisé(s)."}


# ════════════════════════════════════════════════════════════════════════════
# SYSTEM STATS
# ════════════════════════════════════════════════════════════════════════════


@router.get("/stats", summary="System-wide stats for admin dashboard")
def get_system_stats(db: Session = Depends(get_db)):
    """Return global system statistics."""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users   = db.execute(select(func.count(User.id))).scalar_one()
    active_users  = db.execute(select(func.count(User.id)).where(User.is_active == True)).scalar_one()
    total_projects= db.execute(select(func.count(Project.id)).where(Project.active == True)).scalar_one()
    total_quotes  = db.execute(select(func.count(Quotation.id))).scalar_one()

    # Users by role
    role_dist = db.execute(
        select(Role.name, func.count(User.id))
        .join(User, User.role_id == Role.id)
        .group_by(Role.name)
    ).all()

    # Recent audit activity (last 7 days)
    recent_actions = db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.created_at >= week_ago)
    ).scalar_one()

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "inactive": total_users - active_users,
            "by_role": {row[0]: row[1] for row in role_dist},
        },
        "projects": {"total": total_projects},
        "quotations": {"total": total_quotes},
        "audit": {"actions_last_7d": recent_actions},
        "generated_at": now.isoformat(),
    }


# ════════════════════════════════════════════════════════════════════════════
# AUDIT LOG
# ════════════════════════════════════════════════════════════════════════════


@router.get("/audit", summary="Paginated audit log")
def get_audit_log(
    action: Optional[AuditAction] = Query(None),
    entity_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return filtered, paginated audit trail."""
    q = select(AuditLog)

    if action:
        q = q.where(AuditLog.action == action)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if user_id:
        q = q.where(AuditLog.user_id == user_id)

    q = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    logs = db.execute(q).scalars().all()

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "description": log.description,
            "ip_address": log.ip_address,
            "created_at": log.created_at,
        }
        for log in logs
    ]

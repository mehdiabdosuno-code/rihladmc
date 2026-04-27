"""ERP integration HTTP router — /api/erp."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.modules.erp_integration import service
from app.modules.erp_integration.models import ClientErpConfig, ErpPushLog
from app.modules.erp_integration.schemas import (
    ErpConfigCreate,
    ErpConfigOut,
    ErpConfigUpdate,
    ErpPushLogOut,
    ErpPushRequest,
    ErpPushResult,
)
from app.modules.invoices.models import Invoice
from app.shared.dependencies import require_auth, require_role


router = APIRouter(
    prefix="/erp",
    tags=["erp-integration"],
    dependencies=[Depends(require_auth)],
)


# ── Configs ───────────────────────────────────────────────────────────

@router.get("/configs", response_model=list[ErpConfigOut])
def list_configs(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    """List ERP configs scoped to the current company."""
    q = select(ClientErpConfig).where(ClientErpConfig.company_id == company_id)
    if is_active is not None:
        q = q.where(ClientErpConfig.is_active.is_(is_active))
    q = q.order_by(ClientErpConfig.created_at.desc())
    rows = db.execute(q).scalars().all()
    return [service.to_safe_dict(r) for r in rows]


@router.post(
    "/configs",
    response_model=ErpConfigOut,
    status_code=201,
    dependencies=[Depends(require_role("super_admin", "quotation_officer"))],
)
def create_config(
    data: ErpConfigCreate,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    """Create a new ERP target. Admin-only."""
    existing = db.execute(
        select(ClientErpConfig).where(
            ClientErpConfig.company_id == company_id,
            ClientErpConfig.client_key == data.client_key,
        )
    ).scalars().first()
    if existing:
        raise HTTPException(
            409,
            f"A config already exists for client_key={data.client_key!r}; "
            "PATCH the existing one instead.",
        )

    cfg = ClientErpConfig(
        company_id=company_id,
        client_key=data.client_key,
        label=data.label,
        kind=data.kind,
        base_url=data.base_url,
        is_dry_run=data.is_dry_run,
        is_active=data.is_active,
        notes=data.notes,
        oauth_token_url=data.oauth_token_url,
        oauth_client_id=data.oauth_client_id,
        oauth_client_secret=data.oauth_client_secret,
        oauth_scope=data.oauth_scope,
        b1_company_db=data.b1_company_db,
        b1_username=data.b1_username,
        b1_password=data.b1_password,
        mapping=data.mapping,
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return service.to_safe_dict(cfg)


@router.patch(
    "/configs/{cfg_id}",
    response_model=ErpConfigOut,
    dependencies=[Depends(require_role("super_admin", "quotation_officer"))],
)
def update_config(
    cfg_id: str,
    data: ErpConfigUpdate,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    cfg = db.get(ClientErpConfig, cfg_id)
    if not cfg or cfg.company_id != company_id:
        raise HTTPException(404, "ErpConfig not found")

    # Pydantic v2: only fields explicitly set by the caller are present here
    # — omitted ones are NOT included, so we never clobber existing values.
    provided = data.model_dump(exclude_unset=True)

    # Sensitive fields: ignore empty strings (the frontend sends "" to mean
    # "keep current value") so we don't wipe stored secrets to empty.
    if not provided.get("oauth_client_secret"):
        provided.pop("oauth_client_secret", None)
    if not provided.get("b1_password"):
        provided.pop("b1_password", None)

    for field, value in provided.items():
        setattr(cfg, field, value)
    db.commit()
    db.refresh(cfg)
    return service.to_safe_dict(cfg)


@router.delete(
    "/configs/{cfg_id}",
    status_code=204,
    dependencies=[Depends(require_role("super_admin", "quotation_officer"))],
)
def delete_config(
    cfg_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    cfg = db.get(ClientErpConfig, cfg_id)
    if not cfg or cfg.company_id != company_id:
        raise HTTPException(404, "ErpConfig not found")
    db.delete(cfg)
    db.commit()


# ── Push ──────────────────────────────────────────────────────────────

@router.post("/invoices/{invoice_id}/push", response_model=ErpPushResult)
def push_invoice(
    invoice_id: str,
    body: ErpPushRequest = ErpPushRequest(),
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    """Push a single invoice to its mapped ERP backend.

    Idempotent: re-pushing without changes returns the previous successful log.
    Pass `force=true` to override.
    """
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    log = service.push_invoice(
        db, company_id, inv,
        config_id=body.config_id,
        force=body.force,
    )
    return ErpPushResult(
        log_id=log.id,
        status=log.status,
        http_status=log.http_status,
        remote_ref=log.remote_ref,
        is_dry_run=log.is_dry_run,
        duration_ms=log.duration_ms,
        error_message=log.error_message,
        request_payload=log.request_payload,
    )


# ── Logs ──────────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[ErpPushLogOut])
def list_logs(
    invoice_id: Optional[str] = None,
    config_id:  Optional[str] = None,
    status:     Optional[str] = Query(default=None, pattern="^(pending|success|failed)$"),
    limit:      int = Query(default=50, le=200),
    offset:     int = 0,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    """List recent ERP push attempts for the current company."""
    q = select(ErpPushLog).where(ErpPushLog.company_id == company_id)
    if invoice_id:
        q = q.where(ErpPushLog.invoice_id == invoice_id)
    if config_id:
        q = q.where(ErpPushLog.config_id == config_id)
    if status:
        q = q.where(ErpPushLog.status == status)
    q = q.order_by(ErpPushLog.created_at.desc()).offset(offset).limit(limit)
    rows = db.execute(q).scalars().all()
    return [
        ErpPushLogOut(
            id=r.id,
            company_id=r.company_id,
            config_id=r.config_id,
            invoice_id=r.invoice_id,
            idempotency_key=r.idempotency_key,
            kind=r.kind,
            is_dry_run=r.is_dry_run,
            status=r.status,
            http_status=r.http_status,
            remote_ref=r.remote_ref,
            request_payload=r.request_payload,
            response_payload=r.response_payload,
            error_message=r.error_message,
            duration_ms=r.duration_ms,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/logs/{log_id}", response_model=ErpPushLogOut)
def get_log(
    log_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    r = db.get(ErpPushLog, log_id)
    if not r or r.company_id != company_id:
        raise HTTPException(404, "Log not found")
    return ErpPushLogOut(
        id=r.id,
        company_id=r.company_id,
        config_id=r.config_id,
        invoice_id=r.invoice_id,
        idempotency_key=r.idempotency_key,
        kind=r.kind,
        is_dry_run=r.is_dry_run,
        status=r.status,
        http_status=r.http_status,
        remote_ref=r.remote_ref,
        request_payload=r.request_payload,
        response_payload=r.response_payload,
        error_message=r.error_message,
        duration_ms=r.duration_ms,
        created_at=r.created_at,
    )

"""ERP integration service — invoice → SAP push orchestration.

Pipeline:
  1. Resolve `ClientErpConfig` for (company_id, invoice.client_email|client_name).
  2. Compute idempotency key.
  3. If a successful log already exists for that key → return early.
  4. Build SAP payload via mappers.
  5. If `cfg.is_dry_run`: short-circuit with status='success', remote_ref='DRY-…'.
  6. Else: dispatch to the right client (S/4HANA / Business One) and persist log.
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.erp_integration.clients.base import ErpClientError, PushOutcome
from app.modules.erp_integration.mappers import (
    map_invoice_to_business_one,
    map_invoice_to_s4hana,
)
from app.modules.erp_integration.models import (
    ClientErpConfig,
    ErpKind,
    ErpPushLog,
)
from app.modules.invoices.models import Invoice

logger = logging.getLogger(__name__)


# ── Resolution ────────────────────────────────────────────────────────

def resolve_config(
    db: Session,
    company_id: str,
    invoice: Invoice,
    config_id: Optional[str] = None,
) -> Optional[ClientErpConfig]:
    """Find the ClientErpConfig that matches the invoice's client.

    Lookup priority:
      1. `config_id` if provided.
      2. (company_id, client_email) — exact match.
      3. (company_id, client_name lowercased) — fallback.
    Returns None if no active config matches.
    """
    if config_id:
        cfg = db.get(ClientErpConfig, config_id)
        if cfg and cfg.company_id == company_id and cfg.is_active:
            return cfg
        return None

    candidates: list[str] = []
    if invoice.client_email:
        candidates.append(invoice.client_email.strip().lower())
    if invoice.client_name:
        candidates.append(invoice.client_name.strip().lower())
    if not candidates:
        return None

    rows = db.execute(
        select(ClientErpConfig).where(
            ClientErpConfig.company_id == company_id,
            ClientErpConfig.is_active.is_(True),
        )
    ).scalars().all()
    for r in rows:
        if r.client_key.strip().lower() in candidates:
            return r
    return None


# ── Idempotency ───────────────────────────────────────────────────────

def compute_idempotency_key(invoice: Invoice, cfg: ClientErpConfig) -> str:
    """sha256(invoice_id|invoice.updated_at|cfg.id|cfg.updated_at) — first 64 chars."""
    parts = [
        invoice.id,
        invoice.updated_at.isoformat() if invoice.updated_at else "0",
        cfg.id,
        cfg.updated_at.isoformat() if cfg.updated_at else "0",
    ]
    raw = "|".join(parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:64]


# ── Push ──────────────────────────────────────────────────────────────

def push_invoice(
    db: Session,
    company_id: str,
    invoice: Invoice,
    *,
    config_id: Optional[str] = None,
    force: bool = False,
) -> ErpPushLog:
    """Push an invoice to its mapped ERP and return the persisted log row."""
    cfg = resolve_config(db, company_id, invoice, config_id)
    if cfg is None:
        log = ErpPushLog(
            company_id=company_id,
            config_id=None,
            invoice_id=invoice.id,
            idempotency_key=hashlib.sha256(
                f"unmapped|{invoice.id}|{time.time()}".encode("utf-8"),
            ).hexdigest()[:64],
            kind="unmapped",
            is_dry_run=False,
            status="failed",
            http_status=None,
            error_message="No active ErpConfig matches this invoice's client",
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    idem = compute_idempotency_key(invoice, cfg)
    existing = db.execute(
        select(ErpPushLog).where(ErpPushLog.idempotency_key == idem)
    ).scalars().first()
    if existing is not None:
        # The idempotency key is derived from (invoice.updated_at, cfg.updated_at)
        # so a returning existing row means *nothing has changed since last push*.
        # Skip the early return only if the previous attempt failed AND the
        # caller explicitly asked to retry via force=True.
        if existing.status == "success" or not force:
            return existing
        # Failed retry path: drop the previous failed attempt so we can
        # write a fresh log row with the same idempotency key.
        db.delete(existing)
        db.flush()

    # Build payload
    if cfg.kind == ErpKind.SAP_S4HANA:
        request_payload = map_invoice_to_s4hana(invoice, cfg.mapping)
    elif cfg.kind == ErpKind.SAP_BUSINESS_ONE:
        request_payload = map_invoice_to_business_one(invoice, cfg.mapping)
    else:
        log = ErpPushLog(
            company_id=company_id,
            config_id=cfg.id,
            invoice_id=invoice.id,
            idempotency_key=idem,
            kind=cfg.kind,
            is_dry_run=cfg.is_dry_run,
            status="failed",
            error_message=f"Unsupported ERP kind: {cfg.kind}",
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    # Dispatch (or short-circuit in dry_run)
    t0 = time.perf_counter()
    if cfg.is_dry_run:
        outcome = PushOutcome(
            ok=True, http_status=200,
            remote_ref=f"DRY-{idem[:12]}",
            response_payload={"dry_run": True, "would_post_to": cfg.base_url or "(no base_url configured)"},
        )
    else:
        try:
            if cfg.kind == ErpKind.SAP_S4HANA:
                from app.modules.erp_integration.clients import sap_s4hana
                outcome = sap_s4hana.push_supplier_invoice(cfg, request_payload)
            else:
                from app.modules.erp_integration.clients import sap_business_one
                outcome = sap_business_one.push_invoice(cfg, request_payload)
        except ErpClientError as e:
            outcome = PushOutcome(
                ok=False, http_status=None,
                error_message=str(e),
            )
        except Exception as e:  # safety net
            logger.exception("Unexpected ERP push error")
            outcome = PushOutcome(
                ok=False, http_status=None,
                error_message=f"Unexpected error: {e}",
            )
    duration_ms = int((time.perf_counter() - t0) * 1000)

    log = ErpPushLog(
        company_id=company_id,
        config_id=cfg.id,
        invoice_id=invoice.id,
        idempotency_key=idem,
        kind=cfg.kind,
        is_dry_run=cfg.is_dry_run,
        status="success" if outcome.ok else "failed",
        http_status=outcome.http_status,
        remote_ref=outcome.remote_ref,
        request_payload=request_payload,
        response_payload=_truncate_response(outcome.response_payload),
        error_message=outcome.error_message,
        duration_ms=duration_ms,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def _truncate_response(data: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Avoid storing massive response bodies (some SAP responses are huge)."""
    if data is None:
        return None
    try:
        import json
        s = json.dumps(data, default=str)
        if len(s) > 8000:
            return {"_truncated": True, "preview": s[:4000]}
    except Exception:
        return {"_truncated": True, "_unserializable": True}
    return data


# ── Sensitive-field redaction ─────────────────────────────────────────

def to_safe_dict(cfg: ClientErpConfig) -> dict[str, Any]:
    """Project a ClientErpConfig into a dict safe to return over the API.

    NEVER returns oauth_client_secret or b1_password — only their presence.
    """
    return {
        "id":         cfg.id,
        "company_id": cfg.company_id,
        "client_key": cfg.client_key,
        "label":      cfg.label,
        "kind":       cfg.kind,
        "base_url":   cfg.base_url,
        "is_dry_run": cfg.is_dry_run,
        "is_active":  cfg.is_active,
        "notes":      cfg.notes,
        "has_oauth_secret": bool(cfg.oauth_client_secret),
        "has_b1_password":  bool(cfg.b1_password),
        "oauth_token_url":  cfg.oauth_token_url,
        "oauth_client_id":  cfg.oauth_client_id,
        "oauth_scope":      cfg.oauth_scope,
        "b1_company_db":    cfg.b1_company_db,
        "b1_username":      cfg.b1_username,
        "mapping":          cfg.mapping,
        "created_at":       cfg.created_at,
        "updated_at":       cfg.updated_at,
    }

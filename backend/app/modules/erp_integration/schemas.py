"""ERP integration Pydantic schemas (v2)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ErpConfigCreate(BaseModel):
    """Create or update an ERP target for a given (company, client) pair."""

    client_key: str = Field(..., min_length=1, max_length=255)
    label: str = Field(..., min_length=1, max_length=255)
    kind: str = Field(..., pattern="^(sap_s4hana|sap_business_one)$")
    base_url: Optional[str] = None
    is_dry_run: bool = True
    is_active: bool = True
    notes: Optional[str] = None

    # S/4HANA
    oauth_token_url:     Optional[str] = None
    oauth_client_id:     Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_scope:         Optional[str] = None

    # Business One
    b1_company_db: Optional[str] = None
    b1_username:   Optional[str] = None
    b1_password:   Optional[str] = None

    mapping: Optional[dict] = None


class ErpConfigUpdate(BaseModel):
    """Partial-update payload for an existing ERP target.

    Every field is optional. Only fields explicitly provided by the caller
    are applied (via Pydantic's ``model_dump(exclude_unset=True)``); omitted
    fields keep their existing value. This is the correct PATCH semantic:
    e.g. omitting ``is_dry_run`` must NOT silently revert a live config to
    dry-run mode.
    """

    client_key: Optional[str] = Field(default=None, min_length=1, max_length=255)
    label:      Optional[str] = Field(default=None, min_length=1, max_length=255)
    kind:       Optional[str] = Field(default=None, pattern="^(sap_s4hana|sap_business_one)$")
    base_url:   Optional[str] = None
    is_dry_run: Optional[bool] = None
    is_active:  Optional[bool] = None
    notes:      Optional[str] = None

    oauth_token_url:     Optional[str] = None
    oauth_client_id:     Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_scope:         Optional[str] = None

    b1_company_db: Optional[str] = None
    b1_username:   Optional[str] = None
    b1_password:   Optional[str] = None

    mapping: Optional[dict] = None


class ErpConfigOut(BaseModel):
    id: str
    company_id: str
    client_key: str
    label: str
    kind: str
    base_url: Optional[str]
    is_dry_run: bool
    is_active: bool
    notes: Optional[str]

    # Sensitive fields are NEVER returned — we expose presence only.
    has_oauth_secret: bool = False
    has_b1_password:  bool = False

    oauth_token_url: Optional[str]
    oauth_client_id: Optional[str]
    oauth_scope:     Optional[str]
    b1_company_db:   Optional[str]
    b1_username:     Optional[str]

    mapping: Optional[dict]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


class ErpPushRequest(BaseModel):
    """Payload to push a specific invoice to its mapped ERP."""

    config_id: Optional[str] = Field(
        default=None,
        description="Override config lookup; defaults to invoice.client_email/name match.",
    )
    force: bool = Field(
        default=False,
        description="Re-push even if a successful log already exists for this idempotency_key.",
    )


class ErpPushLogOut(BaseModel):
    id: str
    company_id: str
    config_id: Optional[str]
    invoice_id: str
    idempotency_key: str
    kind: str
    is_dry_run: bool
    status: str
    http_status: Optional[int]
    remote_ref: Optional[str]
    request_payload:  Optional[dict]
    response_payload: Optional[dict]
    error_message: Optional[str]
    duration_ms:   Optional[int]
    created_at: Optional[datetime]


class ErpPushResult(BaseModel):
    """Synchronous response after a push attempt."""

    log_id: str
    status: str
    http_status: Optional[int]
    remote_ref: Optional[str]
    is_dry_run: bool
    duration_ms: Optional[int]
    error_message: Optional[str] = None
    request_payload: Optional[dict[str, Any]] = None

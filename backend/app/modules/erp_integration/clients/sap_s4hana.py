"""SAP S/4HANA Cloud (Public Edition) — OData v4 client.

The SupplierInvoice service is the canonical entrypoint to push an A/P invoice
into the client's S/4HANA tenant. Authentication is OAuth2 client_credentials
(machine-to-machine), token cached in-memory per config.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

from app.modules.erp_integration.clients.base import ErpClientError, PushOutcome
from app.modules.erp_integration.models import ClientErpConfig

logger = logging.getLogger(__name__)


# Token cache — keyed by config_id, holds (access_token, expires_at_epoch).
_TOKEN_CACHE: dict[str, tuple[str, float]] = {}

# OData service path for SupplierInvoice — overridable by env / mapping.
SUPPLIER_INVOICE_PATH = (
    "/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/"
    "supplierinvoice/0001/SupplierInvoice"
)


def _fetch_token(cfg: ClientErpConfig) -> str:
    """Return a valid bearer token for the given config (cached)."""
    cached = _TOKEN_CACHE.get(cfg.id)
    if cached and cached[1] > time.time() + 30:
        return cached[0]

    if not (cfg.oauth_token_url and cfg.oauth_client_id and cfg.oauth_client_secret):
        raise ErpClientError("S/4HANA config missing OAuth credentials")

    try:
        import httpx  # type: ignore
    except ImportError as e:  # pragma: no cover
        raise ErpClientError("httpx not installed") from e

    data = {"grant_type": "client_credentials"}
    if cfg.oauth_scope:
        data["scope"] = cfg.oauth_scope
    try:
        r = httpx.post(
            cfg.oauth_token_url,
            data=data,
            auth=(cfg.oauth_client_id, cfg.oauth_client_secret),
            timeout=30.0,
        )
        r.raise_for_status()
    except Exception as e:
        logger.warning("S/4HANA token fetch failed: %s", e)
        raise ErpClientError(f"OAuth token fetch failed: {e}") from e

    body = r.json()
    token = body.get("access_token")
    if not token:
        raise ErpClientError("OAuth response missing access_token")
    expires_in = int(body.get("expires_in") or 3600)
    _TOKEN_CACHE[cfg.id] = (token, time.time() + expires_in)
    return token


def push_supplier_invoice(
    cfg: ClientErpConfig,
    payload: dict[str, Any],
    *,
    timeout: float = 30.0,
) -> PushOutcome:
    """POST a SupplierInvoice document to the configured S/4HANA tenant."""
    if not cfg.base_url:
        raise ErpClientError("S/4HANA config missing base_url")
    try:
        import httpx  # type: ignore
    except ImportError as e:  # pragma: no cover
        raise ErpClientError("httpx not installed") from e

    token = _fetch_token(cfg)
    url = cfg.base_url.rstrip("/") + SUPPLIER_INVOICE_PATH
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        r = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    except Exception as e:
        logger.warning("S/4HANA push failed (transport): %s", e)
        raise ErpClientError(f"Transport error: {e}") from e

    body: Optional[dict[str, Any]] = None
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text[:500]}

    if r.status_code in (200, 201, 204):
        # Try multiple shapes — OData wraps in `d` or `value` depending on version.
        ref = None
        if isinstance(body, dict):
            ref = body.get("SupplierInvoice")
            if not ref and isinstance(body.get("d"), dict):
                ref = body["d"].get("SupplierInvoice")
            ref = ref or body.get("SupplierInvoiceIDByInvcgParty")
        return PushOutcome(
            ok=True, http_status=r.status_code,
            remote_ref=str(ref) if ref else None,
            response_payload=body,
        )

    err_msg = None
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict):
            msg = err.get("message")
            if isinstance(msg, dict):
                err_msg = msg.get("value")
            elif isinstance(msg, str):
                err_msg = msg
    return PushOutcome(
        ok=False,
        http_status=r.status_code,
        response_payload=body,
        error_message=err_msg or f"HTTP {r.status_code}",
    )

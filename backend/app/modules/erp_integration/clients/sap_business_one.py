"""SAP Business One — Service Layer REST client.

Auth model: `POST /Login` returns a session cookie (`B1SESSION`) and a routeid
that must be sent on subsequent requests. We cache (cookies, expires_at) per
config in-memory and re-login on 401 / expiry.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

from app.modules.erp_integration.clients.base import ErpClientError, PushOutcome
from app.modules.erp_integration.models import ClientErpConfig

logger = logging.getLogger(__name__)


# Cookie cache — keyed by config_id.
_COOKIE_CACHE: dict[str, tuple[dict[str, str], float]] = {}


def _login(cfg: ClientErpConfig) -> dict[str, str]:
    """Return Service Layer cookies (B1SESSION + ROUTEID), cached per config."""
    cached = _COOKIE_CACHE.get(cfg.id)
    if cached and cached[1] > time.time() + 30:
        return cached[0]

    if not (cfg.base_url and cfg.b1_company_db and cfg.b1_username and cfg.b1_password):
        raise ErpClientError("Business One config missing credentials")
    try:
        import httpx  # type: ignore
    except ImportError as e:  # pragma: no cover
        raise ErpClientError("httpx not installed") from e

    url = cfg.base_url.rstrip("/") + "/Login"
    body = {
        "CompanyDB": cfg.b1_company_db,
        "UserName":  cfg.b1_username,
        "Password":  cfg.b1_password,
    }
    try:
        r = httpx.post(url, json=body, timeout=30.0, verify=False)
        r.raise_for_status()
    except Exception as e:
        logger.warning("B1 login failed: %s", e)
        raise ErpClientError(f"B1 login failed: {e}") from e

    cookies: dict[str, str] = {}
    for c in r.cookies.jar:
        cookies[c.name] = c.value
    if "B1SESSION" not in cookies:
        raise ErpClientError("B1 login did not set B1SESSION cookie")

    # SessionTimeout is in minutes per the docs.
    expires = time.time() + 25 * 60  # safe default
    try:
        timeout_min = int(r.json().get("SessionTimeout") or 25)
        expires = time.time() + max(60, timeout_min * 60 - 30)
    except Exception:
        pass

    _COOKIE_CACHE[cfg.id] = (cookies, expires)
    return cookies


def push_invoice(
    cfg: ClientErpConfig,
    payload: dict[str, Any],
    *,
    timeout: float = 30.0,
) -> PushOutcome:
    """POST an A/R Invoice (or A/P if `mapping.b1_doc_kind = 'ap_invoice'`)."""
    try:
        import httpx  # type: ignore
    except ImportError as e:  # pragma: no cover
        raise ErpClientError("httpx not installed") from e

    cookies = _login(cfg)
    doc_kind = ((cfg.mapping or {}).get("b1_doc_kind") or "ar_invoice").lower()
    endpoint = "/PurchaseInvoices" if doc_kind == "ap_invoice" else "/Invoices"
    url = cfg.base_url.rstrip("/") + endpoint

    try:
        r = httpx.post(
            url, json=payload, cookies=cookies,
            timeout=timeout, verify=False,
        )
    except Exception as e:
        logger.warning("B1 push failed (transport): %s", e)
        raise ErpClientError(f"Transport error: {e}") from e

    if r.status_code == 401:
        # Session expired — drop cache and retry once.
        _COOKIE_CACHE.pop(cfg.id, None)
        cookies = _login(cfg)
        r = httpx.post(
            url, json=payload, cookies=cookies,
            timeout=timeout, verify=False,
        )

    body: Optional[dict[str, Any]] = None
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text[:500]}

    if r.status_code in (200, 201):
        ref = None
        if isinstance(body, dict):
            doc_entry = body.get("DocEntry")
            ref = str(doc_entry) if doc_entry is not None else body.get("DocNum")
        return PushOutcome(
            ok=True, http_status=r.status_code,
            remote_ref=str(ref) if ref else None,
            response_payload=body,
        )

    err_msg: Optional[str] = None
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

"""Common types for ERP HTTP clients."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class PushOutcome:
    """Normalized return value across all ERP backends.

    Attributes:
        ok: True iff the remote system accepted the document.
        http_status: HTTP status code returned by the SAP system (or 200 in dry_run).
        remote_ref: External reference assigned by SAP — `SupplierInvoiceID`
            for S/4HANA, `DocEntry` (as str) for Business One.
        response_payload: Raw JSON returned by the SAP system (truncated/sanitized).
        error_message: Human-readable error if `ok=False`.
    """

    ok: bool
    http_status: Optional[int]
    remote_ref: Optional[str] = None
    response_payload: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None


class ErpClientError(Exception):
    """Raised on transport-level failure (DNS, TLS, refused connection, etc.)."""

"""B5 — Online payments (Stripe + CMI Maroc).

Endpoints:
  POST /payments/stripe/checkout       — create Stripe Checkout Session
  POST /payments/stripe/webhook        — Stripe webhook (public, signed)
  POST /payments/cmi/initiate          — build CMI form payload (HMAC-signed)
  POST /payments/cmi/callback          — CMI return URL handler (public)
  GET  /payments/status                — return provider configuration

Demo mode: when keys are missing, returns simulated payment URLs that don't
charge anything but flow through the same UI states.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.invoices.models import Invoice
from app.modules.projects.models import Project

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/payments",
    tags=["payments"],
    dependencies=[Depends(require_auth)],
)
public_router = APIRouter(prefix="/payments", tags=["payments-public"])


# ── Schemas ───────────────────────────────────────────────────────────

PayKind = Literal["deposit", "balance", "full"]
Provider = Literal["stripe", "cmi"]


class CheckoutRequest(BaseModel):
    invoice_id: str
    kind: PayKind = "full"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutResponse(BaseModel):
    provider: Provider
    is_demo: bool
    checkout_url: str
    session_id: str
    amount: float
    currency: str
    invoice_id: str
    kind: PayKind


class CmiInitiateResponse(BaseModel):
    is_demo: bool
    gateway_url: str
    fields: dict[str, str]
    amount: float
    currency: str
    oid: str  # ordre id


class StatusResponse(BaseModel):
    stripe_configured: bool
    cmi_configured: bool
    stripe_publishable_key: Optional[str] = None
    cmi_gateway_url: str
    supported_currencies: list[str]


# ── Helpers ───────────────────────────────────────────────────────────

def _amount_for_kind(invoice: Invoice, kind: PayKind) -> float:
    if kind == "deposit":
        return float(invoice.deposit_amount or 0)
    if kind == "balance":
        return float(invoice.balance_due or 0)
    return float(invoice.total or 0)


def _resolve_invoice(db: Session, invoice_id: str) -> Invoice:
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


# ── Stripe ────────────────────────────────────────────────────────────

@router.post("/stripe/checkout", response_model=CheckoutResponse)
def stripe_checkout(body: CheckoutRequest, db: Session = Depends(get_db)) -> CheckoutResponse:
    inv = _resolve_invoice(db, body.invoice_id)
    amount = _amount_for_kind(inv, body.kind)
    if amount <= 0:
        raise HTTPException(400, f"Amount for kind={body.kind} is zero on this invoice")

    base = settings.APP_BASE_URL.rstrip("/")
    success_url = body.success_url or f"{base}/invoices/{inv.id}?payment=success"
    cancel_url = body.cancel_url or f"{base}/invoices/{inv.id}?payment=cancelled"

    # ── Demo mode ──
    if not settings.STRIPE_SECRET_KEY:
        sid = f"cs_demo_{secrets.token_urlsafe(12)}"
        return CheckoutResponse(
            provider="stripe",
            is_demo=True,
            checkout_url=f"{base}/payments/demo?provider=stripe&session={sid}&amount={amount}&currency={inv.currency}&kind={body.kind}",
            session_id=sid,
            amount=amount,
            currency=inv.currency,
            invoice_id=inv.id,
            kind=body.kind,
        )

    # ── Live mode ──
    try:
        import stripe  # type: ignore
        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            line_items=[{
                "price_data": {
                    "currency": inv.currency.lower(),
                    "product_data": {
                        "name": f"Facture {inv.number} — {body.kind}",
                        "description": f"Voyage {inv.client_name or ''}".strip(),
                    },
                    "unit_amount": int(round(amount * 100)),
                },
                "quantity": 1,
            }],
            metadata={
                "invoice_id": inv.id,
                "invoice_number": inv.number,
                "kind": body.kind,
                "project_id": inv.project_id,
            },
            customer_email=inv.client_email or None,
        )
        return CheckoutResponse(
            provider="stripe",
            is_demo=False,
            checkout_url=session.url,  # type: ignore[attr-defined]
            session_id=session.id,  # type: ignore[attr-defined]
            amount=amount,
            currency=inv.currency,
            invoice_id=inv.id,
            kind=body.kind,
        )
    except Exception as e:
        logger.exception("Stripe checkout failed")
        raise HTTPException(502, f"Stripe error: {e}")


@public_router.post("/stripe/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe webhook — verifies signature then marks invoice as paid."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    if not settings.STRIPE_WEBHOOK_SECRET or not settings.STRIPE_SECRET_KEY:
        # Demo: log and accept
        logger.info("[stripe webhook demo] received %d bytes", len(payload))
        return {"received": True, "demo": True}

    try:
        import stripe  # type: ignore
        stripe.api_key = settings.STRIPE_SECRET_KEY
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.warning("Stripe webhook signature verification failed: %s", e)
        raise HTTPException(400, "Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        inv_id = (session.get("metadata") or {}).get("invoice_id")
        kind = (session.get("metadata") or {}).get("kind", "full")
        if inv_id:
            inv = db.get(Invoice, inv_id)
            if inv:
                if kind == "deposit":
                    inv.balance_due = float(inv.total or 0) - float(inv.deposit_amount or 0)
                else:
                    inv.balance_due = 0
                # Status enum varies; set to "paid" string for compatibility
                try:
                    inv.status = "paid"  # type: ignore[assignment]
                except Exception:
                    pass
                db.commit()
                # also update project payment_status if available
                project = db.get(Project, inv.project_id)
                if project and hasattr(project, "payment_status"):
                    project.payment_status = "paid" if kind != "deposit" else "partial"
                    db.commit()
    return {"received": True}


# ── CMI Maroc (3D-Secure form POST) ───────────────────────────────────

def _cmi_hash(fields: dict[str, str], store_key: str) -> str:
    """CMI hash: sort fields by key, concat values + storekey, SHA-512, base64."""
    keys = sorted(fields.keys(), key=lambda s: s.lower())
    plain = "|".join(fields.get(k, "") for k in keys) + "|" + store_key
    digest = hashlib.sha512(plain.encode("utf-8")).digest()
    return base64.b64encode(digest).decode()


@router.post("/cmi/initiate", response_model=CmiInitiateResponse)
def cmi_initiate(body: CheckoutRequest, db: Session = Depends(get_db)) -> CmiInitiateResponse:
    inv = _resolve_invoice(db, body.invoice_id)
    amount = _amount_for_kind(inv, body.kind)
    if amount <= 0:
        raise HTTPException(400, "Zero amount")

    oid = f"INV-{inv.number}-{body.kind}-{secrets.token_hex(4)}"
    base = settings.APP_BASE_URL.rstrip("/")

    fields = {
        "clientid": settings.CMI_MERCHANT_ID or "DEMO",
        "amount": f"{amount:.2f}",
        "oid": oid,
        "okUrl": body.success_url or f"{base}/invoices/{inv.id}?cmi=ok",
        "failUrl": body.cancel_url or f"{base}/invoices/{inv.id}?cmi=fail",
        "TranType": "PreAuth",
        "currency": "504" if (inv.currency or "MAD").upper() == "MAD" else "978",  # 504=MAD, 978=EUR
        "rnd": secrets.token_hex(8),
        "storetype": "3D_PAY_HOSTING",
        "hashAlgorithm": "ver3",
        "lang": "fr",
        "encoding": "UTF-8",
        "BillToEmail": inv.client_email or "",
        "shopurl": base,
    }

    is_demo = not (settings.CMI_MERCHANT_ID and settings.CMI_STORE_KEY)
    if is_demo:
        fields["HASH"] = "DEMO_HASH_NOT_SIGNED"
    else:
        fields["HASH"] = _cmi_hash(fields, settings.CMI_STORE_KEY)  # type: ignore[arg-type]

    return CmiInitiateResponse(
        is_demo=is_demo,
        gateway_url=settings.CMI_GATEWAY_URL,
        fields=fields,
        amount=amount,
        currency=inv.currency,
        oid=oid,
    )


@public_router.post("/cmi/callback", include_in_schema=False)
async def cmi_callback(request: Request, db: Session = Depends(get_db)):
    """CMI returns POST form-encoded data after payment."""
    form = dict((await request.form()).items())
    response_code = str(form.get("Response", ""))
    proc_return_code = str(form.get("ProcReturnCode", ""))
    oid = str(form.get("oid", ""))
    received_hash = str(form.get("HASH", ""))

    # Verify HMAC if configured
    if settings.CMI_STORE_KEY:
        params = {k: str(v) for k, v in form.items() if k != "HASH"}
        expected = _cmi_hash(params, settings.CMI_STORE_KEY)
        if not hmac.compare_digest(expected, received_hash):
            logger.warning("CMI hash mismatch for oid=%s", oid)
            return {"status": "error", "reason": "bad_signature"}

    # Mark invoice paid if approved
    if response_code.lower() in {"approved", "1"} and "INV-" in oid:
        invoice_number = oid.split("-")[1] if "-" in oid else None
        if invoice_number:
            inv = db.execute(
                select(Invoice).where(Invoice.number == invoice_number)
            ).scalars().first()
            if inv:
                inv.balance_due = 0
                try:
                    inv.status = "paid"  # type: ignore[assignment]
                except Exception:
                    pass
                db.commit()
    return {"status": "ok", "response": response_code, "proc": proc_return_code, "oid": oid}


# ── Status ────────────────────────────────────────────────────────────

@router.get("/status", response_model=StatusResponse)
def get_status() -> StatusResponse:
    return StatusResponse(
        stripe_configured=bool(settings.STRIPE_SECRET_KEY),
        cmi_configured=bool(settings.CMI_MERCHANT_ID and settings.CMI_STORE_KEY),
        stripe_publishable_key=settings.STRIPE_PUBLISHABLE_KEY,
        cmi_gateway_url=settings.CMI_GATEWAY_URL,
        supported_currencies=["EUR", "USD", "MAD", "GBP"],
    )

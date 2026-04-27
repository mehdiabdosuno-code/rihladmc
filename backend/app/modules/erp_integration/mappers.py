"""Map RIHLA Invoice → SAP payloads.

S/4HANA Cloud:
    Service:  API_SUPPLIERINVOICE_PROCESS_SRV
    Entity:   A_SupplierInvoice (POST collection)

Business One:
    Service Layer endpoint: /b1s/v2/Invoices  (A/R Invoice — RIHLA is the
    seller). Note: in mode 'supplier' (RIHLA seen as a vendor in client's B1)
    the endpoint is /b1s/v2/PurchaseInvoices instead. We keep both options
    via mapping["b1_doc_kind"] = "ar_invoice" | "ap_invoice".

The mappers are pure functions — they do NOT touch the network or the DB,
so they are trivially unit-testable.
"""

from __future__ import annotations

from typing import Any, Optional

from app.modules.invoices.models import Invoice


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None:
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def _iso_date(s: Optional[str]) -> Optional[str]:
    """Best-effort ISO-8601 normalization. SAP accepts 'YYYY-MM-DD'."""
    if not s:
        return None
    s = s.strip()
    if len(s) >= 10:
        return s[:10]
    return s


def _lines_or_total(inv: Invoice) -> list[dict[str, Any]]:
    """Return invoice lines, falling back to a single line built from totals.

    RIHLA stores lines as JSON (`Invoice.lines`), but some invoices created
    from quotations only have totals — produce a single fallback line so SAP
    accepts the document.
    """
    lines = inv.lines or []
    if isinstance(lines, list) and lines:
        return lines

    label = "Prestation voyage"
    if inv.travel_dates:
        label = f"Prestation voyage — {inv.travel_dates}"
    return [
        {
            "label": label,
            "qty": float(inv.pax_count or 1),
            "unit_price": _safe_float(inv.price_per_pax) or _safe_float(inv.subtotal),
            "total": _safe_float(inv.subtotal),
            "category": "package",
        },
    ]


def map_invoice_to_s4hana(
    inv: Invoice,
    mapping: Optional[dict] = None,
) -> dict[str, Any]:
    """Produce a payload accepted by API_SUPPLIERINVOICE_PROCESS_SRV.

    See: https://api.sap.com/api/API_SUPPLIERINVOICE_PROCESS_SRV

    Mandatory fields: SupplierInvoiceIDByInvcgParty, InvoicingParty, CompanyCode,
    DocumentDate, PostingDate, InvoiceGrossAmount, DocumentCurrency,
    SupplierInvoiceItemGLAccount + items.
    """
    mapping = mapping or {}
    lines = _lines_or_total(inv)
    items: list[dict[str, Any]] = []
    for idx, line in enumerate(lines, start=1):
        qty = _safe_float(line.get("qty"), 1.0)
        unit_price = _safe_float(line.get("unit_price"))
        total = _safe_float(line.get("total")) or (qty * unit_price)
        items.append({
            "SupplierInvoiceItem": str(idx),
            "DocumentCurrency": inv.currency or "EUR",
            "SupplierInvoiceItemAmount": round(total, 2),
            "PurchaseOrderQuantityUnit": str(line.get("unit") or "EA")[:3].upper(),
            "QuantityInPurchaseOrderUnit": qty,
            "TaxCode": mapping.get("tax_code") or "V0",
            "GLAccount": mapping.get("gl_account") or "0000400000",
            "CostCenter": mapping.get("cost_center"),
            "SupplierInvoiceItemText": str(line.get("label") or "Item")[:50],
        })

    payload: dict[str, Any] = {
        "CompanyCode": mapping.get("company_code") or "1010",
        "DocumentDate":   _iso_date(inv.issue_date),
        "PostingDate":    _iso_date(inv.issue_date),
        "InvoicingParty": mapping.get("invoicing_party_id") or mapping.get("supplier_id") or "RIHLA",
        "DocumentCurrency": inv.currency or "EUR",
        "InvoiceGrossAmount": round(_safe_float(inv.total), 2),
        "SupplierInvoiceIDByInvcgParty": inv.number,
        "PaymentTerms": mapping.get("payment_terms") or "Z030",
        "DueCalculationBaseDate": _iso_date(inv.due_date),
        "BusinessPlace": mapping.get("business_place"),
        "TaxIsCalculatedAutomatically": True,
        "to_SupplierInvoiceItemGLAcct": items,
    }
    # Drop None values to keep payloads clean (SAP rejects null on some fields).
    return {k: v for k, v in payload.items() if v is not None}


def map_invoice_to_business_one(
    inv: Invoice,
    mapping: Optional[dict] = None,
) -> dict[str, Any]:
    """Produce a payload accepted by /b1s/v2/Invoices (A/R) or PurchaseInvoices (A/P).

    See: SAP Business One Service Layer Reference,
    https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727
    """
    mapping = mapping or {}
    lines = _lines_or_total(inv)
    document_lines: list[dict[str, Any]] = []
    for line in lines:
        qty = _safe_float(line.get("qty"), 1.0)
        unit_price = _safe_float(line.get("unit_price"))
        total = _safe_float(line.get("total")) or (qty * unit_price)
        document_lines.append({
            "ItemDescription": str(line.get("label") or "Item")[:100],
            "Quantity": qty,
            "UnitPrice": unit_price if unit_price else round(total / qty, 4) if qty else 0,
            "LineTotal": round(total, 2),
            "Currency": inv.currency or "EUR",
            "VatGroup": mapping.get("vat_group") or "EX",
            "AccountCode": mapping.get("revenue_account") or "_SYS00000000175",
        })

    payload: dict[str, Any] = {
        "DocType": "dDocument_Items",
        "CardCode": mapping.get("card_code") or mapping.get("supplier_card_code") or "C-RIHLA",
        "NumAtCard": inv.number,  # external reference (the RIHLA invoice number)
        "DocDate":  _iso_date(inv.issue_date),
        "DocDueDate": _iso_date(inv.due_date),
        "DocCurrency": inv.currency or "EUR",
        "DocTotal": round(_safe_float(inv.total), 2),
        "Comments": (inv.notes or "")[:254] or f"RIHLA — facture {inv.number}",
        "DocumentLines": document_lines,
    }
    return {k: v for k, v in payload.items() if v is not None}

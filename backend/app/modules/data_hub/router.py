"""RIHLA Data Hub — unified semantic search across all modules.

Indexes Project / Quotation / Invoice / PR / PO / Itinerary / MediaAsset into a
single `data_hub_documents` table, then ranks with BM25 over all matching docs.
Demo mode: a single POST /data-hub/reindex repopulates everything from existing
business records — no embeddings needed, no external APIs.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from rank_bm25 import BM25Okapi
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user

from app.modules.data_hub.models import HubDocument
from app.modules.projects.models import Project
from app.modules.quotations.models import Quotation, QuotationLine
from app.modules.invoices.models import Invoice
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.media_library.models import MediaAsset
from app.modules.p2p.models import (
    PurchaseRequisition, PurchaseOrder, SupplierInvoice,
)


router = APIRouter(prefix="/data-hub", tags=["data-hub"])


_TOKEN_RE = re.compile(r"[a-z0-9àâäéèêëïîôöùûüÿç]+", re.UNICODE)
_STOPWORDS = {
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "à", "au",
    "aux", "en", "dans", "sur", "par", "pour", "avec", "sans", "ce", "cette",
    "ces", "qui", "que", "quoi", "dont", "où", "se", "sa", "son", "ses",
    "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "this", "that", "these", "those",
}


def _tok(text: str) -> list[str]:
    if not text:
        return []
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS and len(t) > 1]


# ─── Reindex ──────────────────────────────────────────────────────────────────

def _upsert(db: Session, doc: HubDocument) -> None:
    existing = db.execute(
        select(HubDocument).where(
            HubDocument.source_module == doc.source_module,
            HubDocument.source_id == doc.source_id,
        )
    ).scalar_one_or_none()
    if existing:
        for col in ("title", "body", "tokens", "project_id", "client_name",
                   "destination", "amount", "currency", "status",
                   "occurred_at", "payload"):
            setattr(existing, col, getattr(doc, col))
    else:
        db.add(doc)


def _index_projects(db: Session) -> int:
    n = 0
    for p in db.execute(select(Project)).scalars().all():
        body_parts = [
            p.name, p.client_name or "", p.destination or "",
            p.notes or "", p.travel_dates or "",
        ]
        if p.highlights and isinstance(p.highlights, list):
            body_parts.extend(p.highlights)
        if p.inclusions and isinstance(p.inclusions, list):
            body_parts.extend(p.inclusions)
        body = " · ".join(s for s in body_parts if s)
        title = p.name or "Dossier"
        _upsert(db, HubDocument(
            source_module="project", source_id=p.id,
            title=title, body=body, tokens=len(_tok(body)),
            project_id=p.id, client_name=p.client_name,
            destination=p.destination,
            currency=p.currency, status=str(p.status),
            occurred_at=str(p.created_at) if p.created_at else None,
            payload={"reference": p.reference, "pax_count": p.pax_count,
                     "duration_days": p.duration_days},
        ))
        n += 1
    return n


def _index_quotations(db: Session) -> int:
    n = 0
    for q in db.execute(select(Quotation)).scalars().all():
        lines = db.execute(
            select(QuotationLine).where(QuotationLine.quotation_id == q.id)
        ).scalars().all()
        # pull client_name from parent project
        proj = db.get(Project, q.project_id) if q.project_id else None
        client_name = proj.client_name if proj else None
        destination = proj.destination if proj else None
        body_parts: list[str] = []
        if proj: body_parts.extend([proj.name or "", proj.client_name or "", proj.destination or ""])
        for ln in lines:
            label = getattr(ln, "label", None) or getattr(ln, "description", None)
            if label: body_parts.append(str(label))
            city = getattr(ln, "city", None)
            if city: body_parts.append(str(city))
            sup = getattr(ln, "supplier", None)
            if sup: body_parts.append(str(sup))
        body = " · ".join(s for s in body_parts if s)
        title = f"Devis v{q.version} — {proj.name if proj else q.id[:8]}"
        _upsert(db, HubDocument(
            source_module="quotation", source_id=q.id,
            title=title, body=body, tokens=len(_tok(body)),
            project_id=q.project_id,
            client_name=client_name, destination=destination,
            amount=float(q.total_selling or 0),
            currency=getattr(q, "currency", None),
            status=str(q.status),
            occurred_at=str(q.created_at) if q.created_at else None,
            payload={"version": q.version, "lines_count": len(lines)},
        ))
        n += 1
    return n


def _index_invoices(db: Session) -> int:
    n = 0
    for inv in db.execute(select(Invoice)).scalars().all():
        body = f"{inv.client_name or ''} · {inv.notes or ''}"
        title = f"Facture {inv.number or inv.id[:8]}"
        _upsert(db, HubDocument(
            source_module="invoice", source_id=inv.id,
            title=title, body=body, tokens=len(_tok(body)),
            project_id=getattr(inv, "project_id", None),
            client_name=inv.client_name,
            amount=float(inv.total or 0),
            currency=getattr(inv, "currency", None),
            status=str(inv.status),
            occurred_at=str(inv.issue_date) if getattr(inv, "issue_date", None) else None,
            payload={"number": inv.number, "due_date": str(inv.due_date) if getattr(inv, "due_date", None) else None},
        ))
        n += 1
    return n


def _index_itineraries(db: Session) -> int:
    n = 0
    for it in db.execute(select(Itinerary)).scalars().all():
        days = db.execute(
            select(ItineraryDay).where(ItineraryDay.itinerary_id == it.id)
        ).scalars().all()
        body_parts: list[str] = []
        for d in days:
            for col in ("title", "subtitle", "city", "description", "hotel"):
                v = getattr(d, col, None)
                if v: body_parts.append(str(v))
            acts = getattr(d, "activities", None)
            if acts and isinstance(acts, list):
                body_parts.extend([str(a) for a in acts])
        body = " · ".join(body_parts)[:4000]
        proj = db.get(Project, it.project_id) if it.project_id else None
        title = f"Itinéraire v{it.version} — {proj.name if proj else it.id[:8]}"
        _upsert(db, HubDocument(
            source_module="itinerary", source_id=it.id,
            title=title, body=body, tokens=len(_tok(body)),
            project_id=it.project_id,
            client_name=proj.client_name if proj else None,
            destination=proj.destination if proj else None,
            occurred_at=str(it.created_at) if it.created_at else None,
            payload={"days_count": len(days), "version": it.version},
        ))
        n += 1
    return n


def _index_media(db: Session) -> int:
    n = 0
    for m in db.execute(select(MediaAsset)).scalars().all():
        body_parts = [m.title or "", m.subtitle or "", m.description or "",
                      m.city or "", m.category or "", m.country or ""]
        if m.tags and isinstance(m.tags, list):
            body_parts.extend([str(t) for t in m.tags])
        body = " · ".join(s for s in body_parts if s)
        title = m.title or "Asset média"
        _upsert(db, HubDocument(
            source_module="media", source_id=m.id,
            title=title, body=body, tokens=len(_tok(body)),
            destination=m.city,
            occurred_at=str(m.created_at) if m.created_at else None,
            payload={"asset_type": m.asset_type, "image_url": m.image_url},
        ))
        n += 1
    return n


def _index_p2p(db: Session) -> int:
    n = 0
    for pr in db.execute(select(PurchaseRequisition)).scalars().all():
        body = f"{pr.title} · {pr.description or ''} · {pr.supplier_name or ''} · {pr.category}"
        _upsert(db, HubDocument(
            source_module="purchase_requisition", source_id=pr.id,
            title=f"PR {pr.reference} — {pr.title}", body=body, tokens=len(_tok(body)),
            project_id=pr.project_id, amount=float(pr.total or 0),
            currency=pr.currency, status=pr.status,
            occurred_at=str(pr.created_at) if pr.created_at else None,
            payload={"reference": pr.reference, "supplier": pr.supplier_name,
                     "category": pr.category},
        ))
        n += 1
    for po in db.execute(select(PurchaseOrder)).scalars().all():
        body = f"{po.supplier_name} · {po.notes or ''}"
        _upsert(db, HubDocument(
            source_module="purchase_order", source_id=po.id,
            title=f"PO {po.reference} — {po.supplier_name}", body=body, tokens=len(_tok(body)),
            project_id=po.project_id, amount=float(po.total or 0),
            currency=po.currency, status=po.status,
            occurred_at=str(po.issue_date) if po.issue_date else None,
            payload={"reference": po.reference, "supplier": po.supplier_name},
        ))
        n += 1
    for si in db.execute(select(SupplierInvoice)).scalars().all():
        body = f"{si.supplier_name} · facture fournisseur {si.number}"
        _upsert(db, HubDocument(
            source_module="supplier_invoice", source_id=si.id,
            title=f"Facture fournisseur {si.number}", body=body, tokens=len(_tok(body)),
            client_name=si.supplier_name, amount=float(si.total or 0),
            currency=si.currency, status=si.status,
            occurred_at=str(si.issue_date) if si.issue_date else None,
        ))
        n += 1
    return n


@router.post("/reindex")
def reindex(_: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    counts = {
        "projects":    _index_projects(db),
        "quotations":  _index_quotations(db),
        "invoices":    _index_invoices(db),
        "itineraries": _index_itineraries(db),
        "media":       _index_media(db),
        "p2p":         _index_p2p(db),
    }
    db.commit()
    total = db.execute(select(func.count(HubDocument.id))).scalar_one()
    return {"ok": True, "indexed": counts, "total_documents": total}


# ─── Search ────────────────────────────────────────────────────────────────────

class SearchHit(BaseModel):
    id: str
    source_module: str
    source_id: str
    title: str
    snippet: str
    score: float
    project_id: Optional[str] = None
    client_name: Optional[str] = None
    destination: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    occurred_at: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    total: int
    facets: dict
    hits: list[SearchHit]


def _make_snippet(body: str, query_tokens: list[str], max_len: int = 240) -> str:
    if not body:
        return ""
    lower = body.lower()
    pos = -1
    for tok in query_tokens:
        i = lower.find(tok)
        if i >= 0:
            pos = i; break
    if pos < 0:
        return body[:max_len] + ("…" if len(body) > max_len else "")
    start = max(0, pos - 60)
    end = min(len(body), pos + max_len - 60)
    snippet = ("…" if start > 0 else "") + body[start:end] + ("…" if end < len(body) else "")
    return snippet


@router.get("/search", response_model=SearchResponse)
def search(
    q: str,
    modules: Optional[str] = None,
    limit: int = 25,
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not q or not q.strip():
        raise HTTPException(400, "missing query")
    q_tokens = _tok(q)
    if not q_tokens:
        raise HTTPException(400, "query is empty after stop-word filtering")

    stmt = select(HubDocument)
    if modules:
        wanted = [m.strip() for m in modules.split(",") if m.strip()]
        stmt = stmt.where(HubDocument.source_module.in_(wanted))
    docs = db.execute(stmt).scalars().all()
    if not docs:
        return SearchResponse(query=q, total=0, facets={}, hits=[])

    corpus = [_tok(f"{d.title} · {d.body}") for d in docs]
    bm = BM25Okapi(corpus)
    scores = bm.get_scores(q_tokens)

    ranked = sorted(zip(docs, scores), key=lambda x: float(x[1]), reverse=True)
    hits: list[SearchHit] = []
    facets_module: Counter = Counter()
    facets_status: Counter = Counter()
    facets_dest: Counter = Counter()

    for doc, score in ranked:
        if float(score) <= 0.0 and len(hits) > 0:
            break
        if len(hits) >= limit:
            break
        if float(score) <= 0.0:
            continue
        hits.append(SearchHit(
            id=doc.id, source_module=doc.source_module, source_id=doc.source_id,
            title=doc.title,
            snippet=_make_snippet(doc.body, q_tokens),
            score=round(float(score), 3),
            project_id=doc.project_id, client_name=doc.client_name,
            destination=doc.destination, amount=doc.amount,
            currency=doc.currency, status=doc.status,
            occurred_at=doc.occurred_at,
        ))
        facets_module[doc.source_module] += 1
        if doc.status:      facets_status[doc.status] += 1
        if doc.destination: facets_dest[doc.destination] += 1

    return SearchResponse(
        query=q, total=len(hits),
        facets={
            "by_module": dict(facets_module),
            "by_status": dict(facets_status),
            "by_destination": dict(facets_dest),
        },
        hits=hits,
    )


# ─── Stats / Status ────────────────────────────────────────────────────────────

class HubStats(BaseModel):
    total_documents: int
    by_module: dict
    last_indexed_at: Optional[str] = None


@router.get("/stats", response_model=HubStats)
def stats(_: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(HubDocument.source_module, func.count(HubDocument.id))
        .group_by(HubDocument.source_module)
    ).all()
    last = db.execute(select(func.max(HubDocument.updated_at))).scalar_one_or_none()
    return HubStats(
        total_documents=sum(c for _, c in rows),
        by_module={m: c for m, c in rows},
        last_indexed_at=str(last) if last else None,
    )


# ─── Suggestions / examples ───────────────────────────────────────────────────

class Suggestion(BaseModel):
    label: str
    query: str
    description: str


@router.get("/suggestions", response_model=list[Suggestion])
def suggestions(_: dict = Depends(get_current_user)):
    return [
        Suggestion(label="Tous les dossiers Marrakech",  query="Marrakech",
                  description="Cherche dossiers, devis, factures, médias, achats liés à Marrakech"),
        Suggestion(label="Achats hôtel à risque",        query="hotel discrepancy",
                  description="POs/factures fournisseurs hôtels avec écart"),
        Suggestion(label="Encours clients à relancer",   query="facture sent overdue",
                  description="Factures émises non encore payées"),
        Suggestion(label="Royal Mansour",                query="Royal Mansour",
                  description="Toutes les opérations liées au fournisseur Royal Mansour"),
        Suggestion(label="Désert / Sahara",              query="Sahara désert Erg Chebbi",
                  description="Contenus & dossiers sur les voyages désert"),
        Suggestion(label="Discovery Tangier",            query="Discovery Tangier Chefchaouen",
                  description="Tout ce qui concerne le dossier Discovery Tangier-Chefchaouen"),
    ]

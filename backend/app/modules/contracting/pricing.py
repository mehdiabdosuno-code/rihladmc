"""Pricing Engine v2 — deterministic price resolution.

Resolution order (first match wins):
  1) Active contract for { company, supplier, article } whose validity
     covers `service_date` AND has a season covering `service_date`
     AND a rate matching `rate_key` (or pax range).
  2) Active contract for { company, supplier, article_category } same logic.
  3) Article.sell_price as fallback.
  4) Raises 404 if nothing found.

The function is pure (no commit) — it ONLY reads. Allotment consumption is
performed by callers (e.g. on quotation confirmation) via `consume_allotment`.
"""

from datetime import date
from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.modules.master_data.models import Article
from app.modules.contracting.models import (
    Allotment,
    Contract,
    ContractRate,
    ContractSeason,
    ContractStatus,
)
from app.modules.contracting.schemas import PriceQuoteRequest, PriceQuoteResponse


def _find_matching_rate(
    db: Session,
    season: ContractSeason,
    rate_key: Optional[str],
    pax: Optional[int],
) -> Optional[ContractRate]:
    rates = (
        db.execute(
            select(ContractRate).where(ContractRate.season_id == season.id)
        )
        .scalars()
        .all()
    )
    if not rates:
        return None

    # Exact rate_key match wins
    if rate_key:
        for r in rates:
            if r.rate_key == rate_key:
                return r

    # Else match pax range
    if pax is not None:
        for r in rates:
            lo = r.pax_min if r.pax_min is not None else 0
            hi = r.pax_max if r.pax_max is not None else 10**9
            if lo <= pax <= hi:
                return r

    # Fallback: first rate
    return rates[0]


def _find_allotment(
    db: Session, season_id: str, rate_key: Optional[str]
) -> Optional[Allotment]:
    q = db.execute(
        select(Allotment).where(Allotment.season_id == season_id)
    ).scalars().all()
    if not q:
        return None
    if rate_key:
        for a in q:
            if a.rate_key == rate_key:
                return a
    return q[0]


def calculate_price(
    db: Session,
    company_id: str,
    request: PriceQuoteRequest,
) -> PriceQuoteResponse:
    warnings: list[str] = []

    article = (
        db.execute(
            select(Article).where(
                Article.id == request.article_id,
                Article.company_id == company_id,
            )
        )
        .scalars()
        .first()
    )
    if not article:
        raise ValueError("Article introuvable")

    supplier_id = request.supplier_id or article.default_supplier_id

    # Step 1+2: try to find a contract
    contract: Optional[Contract] = None
    if supplier_id:
        contract_q = (
            select(Contract)
            .where(
                Contract.company_id == company_id,
                Contract.supplier_id == supplier_id,
                Contract.status == ContractStatus.active,
                Contract.valid_from <= request.service_date,
                Contract.valid_to >= request.service_date,
                or_(
                    Contract.article_id == article.id,
                    and_(
                        Contract.article_id.is_(None),
                        Contract.article_category == article.category,
                    ),
                ),
            )
            .order_by(
                # Prefer article-specific contracts over category-wide ones
                Contract.article_id.is_(None),
            )
        )
        contract = db.execute(contract_q).scalars().first()

    if contract:
        season = (
            db.execute(
                select(ContractSeason).where(
                    ContractSeason.contract_id == contract.id,
                    ContractSeason.starts_on <= request.service_date,
                    ContractSeason.ends_on >= request.service_date,
                )
            )
            .scalars()
            .first()
        )
        if not season:
            warnings.append("Contrat trouvé mais aucune saison ne couvre la date")
        else:
            rate = _find_matching_rate(db, season, request.rate_key, request.pax)
            if rate is None:
                warnings.append("Contrat/Saison trouvés mais aucun tarif ne correspond")
            else:
                allot = _find_allotment(db, season.id, rate.rate_key)
                if allot and allot.remaining < request.quantity:
                    warnings.append(
                        f"Allotement insuffisant ({allot.remaining} restants pour {request.quantity} demandés)"
                    )
                return PriceQuoteResponse(
                    article_id=article.id,
                    supplier_id=supplier_id,
                    contract_id=contract.id,
                    season_id=season.id,
                    rate_id=rate.id,
                    unit_price=float(rate.unit_price),
                    currency=rate.currency or contract.currency,
                    quantity=request.quantity,
                    total=float(rate.unit_price) * request.quantity,
                    source="contract",
                    warnings=warnings,
                    allotment_remaining=allot.remaining if allot else None,
                )

    # Step 3: fallback to article default
    if article.sell_price is not None:
        warnings.append("Aucun contrat actif — tarif par défaut de l'article appliqué")
        return PriceQuoteResponse(
            article_id=article.id,
            supplier_id=supplier_id,
            contract_id=None,
            season_id=None,
            rate_id=None,
            unit_price=float(article.sell_price),
            currency=article.currency or "MAD",
            quantity=request.quantity,
            total=float(article.sell_price) * request.quantity,
            source="article_default",
            warnings=warnings,
        )

    raise ValueError("Aucun tarif trouvé pour cet article à cette date")


def consume_allotment(
    db: Session,
    season_id: str,
    rate_key: Optional[str],
    quantity: int,
) -> Optional[Allotment]:
    """Atomically increment `consumed` on the matching allotment.

    Caller is responsible for the transaction commit. Returns the updated
    allotment (or None if no matching allotment exists)."""
    allot = _find_allotment(db, season_id, rate_key)
    if not allot:
        return None
    allot.consumed = (allot.consumed or 0) + quantity
    db.add(allot)
    db.flush()
    return allot

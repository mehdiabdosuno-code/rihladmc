"""Contracting router — Contracts, Seasons, Rates, Allotments + Pricing."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth
from app.modules.master_data.models import Partner
from app.modules.contracting.models import (
    Allotment,
    Contract,
    ContractRate,
    ContractSeason,
    ContractStatus,
)
from app.modules.contracting.schemas import (
    AllotmentCreate,
    AllotmentOut,
    ContractCreate,
    ContractOut,
    ContractRateCreate,
    ContractRateOut,
    ContractSeasonCreate,
    ContractSeasonOut,
    ContractUpdate,
    PriceQuoteRequest,
    PriceQuoteResponse,
)
from app.modules.contracting.pricing import calculate_price


router = APIRouter(prefix="/contracts", tags=["contracting"])
pricing_router = APIRouter(prefix="/pricing", tags=["contracting"])


# ── Contract CRUD ──────────────────────────────────────────────────

@router.get("", response_model=list[ContractOut])
def list_contracts(
    supplier_id: Optional[str] = Query(None),
    status: Optional[ContractStatus] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(Contract).filter(Contract.company_id == company_id)
    if supplier_id:
        q = q.filter(Contract.supplier_id == supplier_id)
    if status:
        q = q.filter(Contract.status == status)
    return q.order_by(Contract.valid_from.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=ContractOut, status_code=201)
def create_contract(
    payload: ContractCreate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    if (
        db.query(Contract)
        .filter(Contract.company_id == company_id, Contract.code == payload.code)
        .first()
    ):
        raise HTTPException(status_code=409, detail="Code contrat déjà utilisé")

    supplier = (
        db.query(Partner)
        .filter(Partner.id == payload.supplier_id, Partner.company_id == company_id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=400, detail="Fournisseur introuvable")
    if payload.valid_to < payload.valid_from:
        raise HTTPException(status_code=400, detail="valid_to doit être ≥ valid_from")

    seasons_data = payload.seasons
    contract = Contract(
        **payload.model_dump(exclude={"seasons"}),
        company_id=company_id,
    )
    db.add(contract)
    db.flush()

    for s in seasons_data:
        season = ContractSeason(
            contract_id=contract.id,
            name=s.name,
            starts_on=s.starts_on,
            ends_on=s.ends_on,
        )
        db.add(season)
        db.flush()
        for r in s.rates:
            db.add(ContractRate(season_id=season.id, **r.model_dump()))
        for a in s.allotments:
            db.add(Allotment(season_id=season.id, **a.model_dump()))

    db.commit()
    db.refresh(contract)
    return contract


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(
    contract_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    c = (
        db.query(Contract)
        .filter(Contract.id == contract_id, Contract.company_id == company_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    return c


@router.patch("/{contract_id}", response_model=ContractOut)
def update_contract(
    contract_id: str,
    payload: ContractUpdate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    c = (
        db.query(Contract)
        .filter(Contract.id == contract_id, Contract.company_id == company_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


# ── Sub-resources ──────────────────────────────────────────────────

@router.post("/{contract_id}/seasons", response_model=ContractSeasonOut, status_code=201)
def add_season(
    contract_id: str,
    payload: ContractSeasonCreate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    c = (
        db.query(Contract)
        .filter(Contract.id == contract_id, Contract.company_id == company_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    season = ContractSeason(
        contract_id=contract_id,
        name=payload.name,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
    )
    db.add(season)
    db.flush()
    for r in payload.rates:
        db.add(ContractRate(season_id=season.id, **r.model_dump()))
    for a in payload.allotments:
        db.add(Allotment(season_id=season.id, **a.model_dump()))
    db.commit()
    db.refresh(season)
    return season


@router.post("/seasons/{season_id}/rates", response_model=ContractRateOut, status_code=201)
def add_rate(
    season_id: str,
    payload: ContractRateCreate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    season = (
        db.query(ContractSeason)
        .join(Contract, Contract.id == ContractSeason.contract_id)
        .filter(ContractSeason.id == season_id, Contract.company_id == company_id)
        .first()
    )
    if not season:
        raise HTTPException(status_code=404, detail="Saison introuvable")
    rate = ContractRate(season_id=season_id, **payload.model_dump())
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate


@router.post("/seasons/{season_id}/allotments", response_model=AllotmentOut, status_code=201)
def add_allotment(
    season_id: str,
    payload: AllotmentCreate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    season = (
        db.query(ContractSeason)
        .join(Contract, Contract.id == ContractSeason.contract_id)
        .filter(ContractSeason.id == season_id, Contract.company_id == company_id)
        .first()
    )
    if not season:
        raise HTTPException(status_code=404, detail="Saison introuvable")
    allot = Allotment(season_id=season_id, **payload.model_dump())
    db.add(allot)
    db.commit()
    db.refresh(allot)
    return allot


# ── Pricing ────────────────────────────────────────────────────────

@pricing_router.post("/calculate", response_model=PriceQuoteResponse)
def quote_price(
    payload: PriceQuoteRequest,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    try:
        return calculate_price(db, company_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

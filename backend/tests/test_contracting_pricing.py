"""Pricing Engine v2 — unit tests."""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.modules.companies.models import Company
from app.modules.master_data.models import Article, ArticleCategory, Partner, PartnerType
from app.modules.contracting.models import (
    Allotment,
    Contract,
    ContractRate,
    ContractSeason,
    ContractStatus,
)
from app.modules.contracting.pricing import calculate_price, consume_allotment
from app.modules.contracting.schemas import PriceQuoteRequest


@pytest.fixture
def stours(db: Session) -> Company:
    c = Company(code="STOURS", name="STOURS VOYAGES", currency="MAD")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def supplier(db: Session, stours: Company) -> Partner:
    p = Partner(
        company_id=stours.id, code="MAMOUNIA", name="La Mamounia",
        type=PartnerType.supplier, currency="MAD",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture
def article(db: Session, stours: Company, supplier: Partner) -> Article:
    a = Article(
        company_id=stours.id, code="MAM-NIGHT", name="Mamounia DBL",
        category=ArticleCategory.hotel_night, unit="nuitée",
        sell_price=2500.00, currency="MAD",
        default_supplier_id=supplier.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def test_pricing_falls_back_to_article_default_when_no_contract(
    db: Session, stours: Company, article: Article
):
    res = calculate_price(
        db, stours.id,
        PriceQuoteRequest(article_id=article.id, service_date=date(2026, 7, 15), quantity=2),
    )
    assert res.source == "article_default"
    assert res.unit_price == 2500.00
    assert res.total == 5000.00
    assert res.contract_id is None


def test_pricing_resolves_active_contract_with_matching_season_and_rate(
    db: Session, stours: Company, supplier: Partner, article: Article
):
    contract = Contract(
        company_id=stours.id, code="MAM-2026", name="Mamounia 2026",
        supplier_id=supplier.id, article_id=article.id,
        status=ContractStatus.active,
        valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
        currency="MAD",
    )
    db.add(contract)
    db.flush()
    season = ContractSeason(
        contract_id=contract.id, name="high",
        starts_on=date(2026, 6, 1), ends_on=date(2026, 9, 30),
    )
    db.add(season)
    db.flush()
    db.add(ContractRate(season_id=season.id, rate_key="DBL", unit_price=1800.00, currency="MAD"))
    db.add(ContractRate(season_id=season.id, rate_key="SGL", unit_price=1500.00, currency="MAD"))
    db.commit()

    res = calculate_price(
        db, stours.id,
        PriceQuoteRequest(
            article_id=article.id, service_date=date(2026, 7, 15),
            rate_key="DBL", quantity=3,
        ),
    )
    assert res.source == "contract"
    assert res.unit_price == 1800.00
    assert res.total == 5400.00
    assert res.contract_id == contract.id


def test_pricing_warns_when_allotment_insufficient(
    db: Session, stours: Company, supplier: Partner, article: Article
):
    contract = Contract(
        company_id=stours.id, code="MAM-26B", name="Mamounia 2026 B",
        supplier_id=supplier.id, article_id=article.id,
        status=ContractStatus.active,
        valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
    )
    db.add(contract)
    db.flush()
    season = ContractSeason(
        contract_id=contract.id, name="high",
        starts_on=date(2026, 6, 1), ends_on=date(2026, 9, 30),
    )
    db.add(season)
    db.flush()
    db.add(ContractRate(season_id=season.id, rate_key="DBL", unit_price=1800.00))
    db.add(Allotment(season_id=season.id, rate_key="DBL", quantity=5, consumed=4))
    db.commit()

    res = calculate_price(
        db, stours.id,
        PriceQuoteRequest(
            article_id=article.id, service_date=date(2026, 7, 15),
            rate_key="DBL", quantity=3,
        ),
    )
    assert res.source == "contract"
    assert res.allotment_remaining == 1
    assert any("Allotement insuffisant" in w for w in res.warnings)


def test_consume_allotment_increments_consumed(
    db: Session, stours: Company, supplier: Partner, article: Article
):
    contract = Contract(
        company_id=stours.id, code="X", name="X",
        supplier_id=supplier.id, article_id=article.id,
        status=ContractStatus.active,
        valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
    )
    db.add(contract); db.flush()
    season = ContractSeason(contract_id=contract.id, name="s",
        starts_on=date(2026, 1, 1), ends_on=date(2026, 12, 31))
    db.add(season); db.flush()
    db.add(Allotment(season_id=season.id, rate_key="DBL", quantity=10, consumed=0))
    db.commit()

    a = consume_allotment(db, season.id, "DBL", 3)
    db.commit()
    assert a is not None
    assert a.consumed == 3
    assert a.remaining == 7


def test_pricing_isolates_companies(
    db: Session, stours: Company, supplier: Partner, article: Article
):
    other = Company(code="OTHER", name="Other Co", currency="MAD")
    db.add(other)
    db.commit()
    with pytest.raises(ValueError):
        calculate_price(
            db, other.id,
            PriceQuoteRequest(article_id=article.id, service_date=date(2026, 7, 15)),
        )

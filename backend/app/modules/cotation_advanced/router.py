"""Cotation Avancée — endpoints couvrant pricing grid, catering, T&C, vehicles.

Inspiré de la structure de quotation S'TOURS observée dans le document
YS Travel Morocco 11D (Excel cotation interne + Word présentation client).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user

from app.modules.cotation_advanced.models import (
    PricingBracket, ItineraryDayMeal, QuotationTerm, Vehicle,
)
from app.modules.quotations.models import Quotation, QuotationLine
from app.modules.itineraries.models import ItineraryDay
from app.modules.projects.models import Project


router = APIRouter(prefix="/cotation", tags=["cotation-advanced"])


# ─── α  PRICING GRID ─────────────────────────────────────────────────────────

class BracketIn(BaseModel):
    pax_basis:         int
    foc_count:         int = 1
    price_per_pax:     float = 0
    single_supplement: float = 0
    currency:          str = "EUR"
    breakdown:         Optional[dict] = None


class BracketOut(BracketIn):
    id: str
    quotation_id: str


def _bracket_out(b: PricingBracket) -> BracketOut:
    return BracketOut(
        id=b.id, quotation_id=b.quotation_id,
        pax_basis=b.pax_basis, foc_count=b.foc_count,
        price_per_pax=float(b.price_per_pax), single_supplement=float(b.single_supplement),
        currency=b.currency, breakdown=b.breakdown,
    )


@router.get("/quotations/{quotation_id}/brackets", response_model=list[BracketOut])
def list_brackets(quotation_id: str,
                  _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(PricingBracket).where(PricingBracket.quotation_id == quotation_id)
        .order_by(PricingBracket.pax_basis)
    ).scalars().all()
    return [_bracket_out(b) for b in rows]


class RecomputeIn(BaseModel):
    pax_brackets:     list[int] = [10, 15, 20, 25, 30, 35]
    foc_count:        int = 1
    markup_pct:       Optional[float] = None        # override quotation.margin_pct
    bus_total_cost:   float = 0
    tour_leader_cost: float = 0
    guide_cost:       float = 0
    guide_local_cost: float = 0
    extras_per_pax:   dict = Field(default_factory=dict)
    # ex: {tips_lug: 70, tips_rest: 75, water: 45, horse: 100, jeep_4wd: 280, camel: 100}
    single_supplement: float = 0
    currency:         str = "EUR"


@router.post("/quotations/{quotation_id}/recompute-grid", response_model=list[BracketOut])
def recompute_grid(quotation_id: str, payload: RecomputeIn,
                   _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Recalcule la grille PAX-scaling à partir des QuotationLine + scaling rules.

    Logique (inspirée S'TOURS):
    - **Coûts fixes par groupe** (bus, tour-leader, guide, guide-local) : divisés par PAX.
    - **Coûts variables par PAX par jour** (hôtel, restaurants, monuments) : agrégés depuis
      QuotationLine.total_cost groupé par catégorie. Multiplied per-pax pour total.
    - **Extras par PAX** (eau, tips, calèche, 4WD, dromadaire) : ajoutés tels quels.
    - Markup_pct appliqué au sous-total → prix final par PAX.
    """
    q = db.get(Quotation, quotation_id)
    if not q: raise HTTPException(404, "quotation not found")

    lines = db.execute(
        select(QuotationLine).where(QuotationLine.quotation_id == quotation_id)
    ).scalars().all()

    # Sum lines by category
    by_cat: dict[str, float] = {}
    for ln in lines:
        cat = str(ln.category)
        by_cat[cat] = by_cat.get(cat, 0.0) + float(ln.total_cost or 0.0)

    hotel_total      = by_cat.get("hotel", 0.0)
    restaurant_total = by_cat.get("restaurant", 0.0)
    monument_total   = by_cat.get("monument", 0.0)
    activity_total   = by_cat.get("activity", 0.0)
    misc_total       = by_cat.get("misc", 0.0)

    markup_pct = float(payload.markup_pct if payload.markup_pct is not None else (q.margin_pct or 0))
    extras_pp  = sum(float(v or 0) for v in (payload.extras_per_pax or {}).values())

    # wipe existing
    db.execute(delete(PricingBracket).where(PricingBracket.quotation_id == quotation_id))
    db.commit()

    out: list[PricingBracket] = []
    for pax in payload.pax_brackets:
        if pax <= 0: continue
        # Per-pax cost decomposition
        hotel_pp      = hotel_total / pax if pax else 0
        rest_pp       = restaurant_total / pax if pax else 0
        monu_pp       = monument_total / pax if pax else 0
        activity_pp   = activity_total / pax if pax else 0
        misc_pp       = misc_total / pax if pax else 0
        bus_pp        = payload.bus_total_cost / pax if pax else 0
        tl_pp         = payload.tour_leader_cost / pax if pax else 0
        guide_pp      = payload.guide_cost / pax if pax else 0
        guide_loc_pp  = payload.guide_local_cost / pax if pax else 0
        subtotal_pp   = (hotel_pp + rest_pp + monu_pp + activity_pp + misc_pp +
                         bus_pp + tl_pp + guide_pp + guide_loc_pp + extras_pp)
        markup_pp     = subtotal_pp * markup_pct / 100.0
        price_pp      = round(subtotal_pp + markup_pp, 2)

        breakdown = {
            "hotel":          round(hotel_pp, 2),
            "restaurants":    round(rest_pp, 2),
            "monuments":      round(monu_pp, 2),
            "activities":     round(activity_pp, 2),
            "misc":           round(misc_pp, 2),
            "bus":            round(bus_pp, 2),
            "tour_leader":    round(tl_pp, 2),
            "guide":          round(guide_pp, 2),
            "guide_local":    round(guide_loc_pp, 2),
            "extras":         round(extras_pp, 2),
            "extras_detail":  payload.extras_per_pax or {},
            "subtotal":       round(subtotal_pp, 2),
            "markup_pct":     markup_pct,
            "markup":         round(markup_pp, 2),
        }

        b = PricingBracket(
            quotation_id=quotation_id, pax_basis=pax, foc_count=payload.foc_count,
            price_per_pax=price_pp, single_supplement=payload.single_supplement,
            currency=payload.currency, breakdown=breakdown,
        )
        db.add(b); out.append(b)

    db.commit()
    for b in out: db.refresh(b)
    return [_bracket_out(b) for b in out]


# ─── β  CATERING (DayMeal) ────────────────────────────────────────────────────

class MealIn(BaseModel):
    meal_type:       str
    city:            Optional[str] = None
    restaurant_name: Optional[str] = None
    menu_text:       Optional[str] = None
    menu_id:         Optional[str] = None
    cost_per_pax:    Optional[float] = None
    currency:        Optional[str] = None


class MealOut(MealIn):
    id: str
    day_id: str


def _meal_out(m: ItineraryDayMeal) -> MealOut:
    return MealOut(
        id=m.id, day_id=m.day_id, meal_type=m.meal_type, city=m.city,
        restaurant_name=m.restaurant_name, menu_text=m.menu_text, menu_id=m.menu_id,
        cost_per_pax=float(m.cost_per_pax) if m.cost_per_pax else None,
        currency=m.currency,
    )


@router.get("/days/{day_id}/meals", response_model=list[MealOut])
def list_meals(day_id: str, _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(ItineraryDayMeal).where(ItineraryDayMeal.day_id == day_id)
    ).scalars().all()
    return [_meal_out(m) for m in rows]


@router.post("/days/{day_id}/meals", response_model=MealOut)
def add_meal(day_id: str, payload: MealIn,
             _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    day = db.get(ItineraryDay, day_id)
    if not day: raise HTTPException(404, "itinerary day not found")
    m = ItineraryDayMeal(day_id=day_id, **payload.model_dump())
    db.add(m); db.commit(); db.refresh(m)
    return _meal_out(m)


@router.delete("/meals/{meal_id}")
def remove_meal(meal_id: str, _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.get(ItineraryDayMeal, meal_id)
    if not m: raise HTTPException(404, "meal not found")
    db.delete(m); db.commit()
    return {"ok": True}


# ─── γ  TERMS & CONDITIONS ────────────────────────────────────────────────────

class TermIn(BaseModel):
    section:    str
    title:      Optional[str] = None
    body:       str
    sort_order: int = 0


class TermOut(TermIn):
    id: str
    quotation_id: str


def _term_out(t: QuotationTerm) -> TermOut:
    return TermOut(
        id=t.id, quotation_id=t.quotation_id,
        section=t.section, title=t.title, body=t.body, sort_order=t.sort_order,
    )


@router.get("/quotations/{quotation_id}/terms", response_model=list[TermOut])
def list_terms(quotation_id: str,
               _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(QuotationTerm).where(QuotationTerm.quotation_id == quotation_id)
        .order_by(QuotationTerm.sort_order, QuotationTerm.section)
    ).scalars().all()
    return [_term_out(t) for t in rows]


@router.put("/quotations/{quotation_id}/terms", response_model=list[TermOut])
def replace_terms(quotation_id: str, payload: list[TermIn],
                  _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.get(Quotation, quotation_id)
    if not q: raise HTTPException(404, "quotation not found")
    db.execute(delete(QuotationTerm).where(QuotationTerm.quotation_id == quotation_id))
    out = []
    for i, t in enumerate(payload):
        row = QuotationTerm(quotation_id=quotation_id, sort_order=i, **t.model_dump(exclude={"sort_order"}))
        db.add(row); out.append(row)
    db.commit()
    for r in out: db.refresh(r)
    return [_term_out(t) for t in out]


# ─── S'TOURS T&C templates ────────────────────────────────────────────────────

STOURS_TERMS_TEMPLATES = [
    {"section": "validity", "title": "Validité de l'offre",
     "body": "Cette offre est une estimation préliminaire valable pour la période indiquée. Aucune réservation n'est faite à ce stade ; ce document constitue uniquement un devis."},
    {"section": "pricing_currency", "title": "Devise & ajustements",
     "body": "Les tarifs sont indiqués en EUR ou USD sur la base du taux de change actuel. Des ajustements peuvent intervenir en cas de fluctuations significatives du taux de change."},
    {"section": "payment", "title": "Modalités de paiement",
     "body": "Les paiements peuvent être effectués par virement bancaire, carte de crédit ou PayPal selon les conditions convenues. Le solde intégral doit être réglé 15 jours avant la date de départ."},
    {"section": "deposit", "title": "Acompte de confirmation",
     "body": "Un acompte de 20% est requis pour confirmer la réservation. Cet acompte sera déduit du montant total de la facture."},
    {"section": "cancellation", "title": "Politique d'annulation",
     "body": "Les frais d'annulation s'appliquent en fonction de la date d'annulation par rapport à la date d'arrivée. En haute saison ou pour certains services, des conditions plus strictes peuvent s'appliquer (festivals, jours fériés, etc.). Les détails complets sont précisés sur la facture ou le contrat de service."},
    {"section": "modifications", "title": "Modifications de réservation",
     "body": "Les changements (dates, nombre de participants, type de chambres, services) sont sujets à disponibilité et peuvent entraîner des frais supplémentaires."},
    {"section": "rooming_list", "title": "Liste de rooming",
     "body": "Le client doit transmettre la liste de rooming finale au plus tard 30 jours avant l'arrivée. Tout retard peut affecter la disponibilité des chambres."},
    {"section": "force_majeure", "title": "Force majeure",
     "body": "En cas d'événements imprévus indépendants de notre volonté (catastrophes naturelles, grèves, etc.), nous ferons de notre mieux pour proposer des alternatives ou reprogrammer les services."},
    {"section": "hotel_substitution", "title": "Substitution d'hôtel",
     "body": "Les services sont sujets à disponibilité au moment de la confirmation. Les hôtels listés peuvent être remplacés par des établissements de catégorie similaire."},
    {"section": "vehicle_disclaimer", "title": "Véhicules — clause d'usage",
     "body": "Les images des véhicules sont fournies à titre indicatif. Un véhicule similaire peut être utilisé. Les autocars ne disposent pas de toilettes embarquées ; des arrêts réguliers sont prévus pendant les longs trajets. La couverture Wi-Fi peut être limitée selon les zones traversées. Tous les autocars fournis ont entre 4 et 5 ans maximum."},
    {"section": "hotel_services", "title": "Services hôteliers",
     "body": "Les services suivants sont fournis selon la politique de chaque hôtel : bouteille d'eau minérale en chambre (selon catégorie), coffre-fort (généralement inclus), thé/café (catégories supérieures uniquement), peignoirs et chaussons (chambres supérieures ou sur demande)."},
    {"section": "responsibility", "title": "Limitation de responsabilité",
     "body": "S'TOURS agit en tant qu'intermédiaire entre le client et les prestataires de services (hôtels, restaurants, etc.) et ne peut être tenu responsable des retards, changements ou défaillances de services hors de son contrôle. La responsabilité de S'TOURS ne s'étend pas aux dommages ou pertes causés par des prestataires tiers."},
    {"section": "booking_process", "title": "Processus de réservation",
     "body": "Pour sécuriser votre réservation, nous demandons une confirmation écrite accompagnée des acomptes ou pré-paiements requis. Aucun service (hôtels, transport, repas) ne sera réservé avant réception de cette confirmation. Une fois les réservations sécurisées, S'TOURS émet une confirmation détaillée de réservation indiquant les services confirmés, noms d'hôtels, catégories de chambres et inclusions."},
]


@router.post("/quotations/{quotation_id}/terms/seed-stours")
def seed_stours_terms(quotation_id: str,
                      _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.get(Quotation, quotation_id)
    if not q: raise HTTPException(404, "quotation not found")
    db.execute(delete(QuotationTerm).where(QuotationTerm.quotation_id == quotation_id))
    for i, tpl in enumerate(STOURS_TERMS_TEMPLATES):
        db.add(QuotationTerm(
            quotation_id=quotation_id, sort_order=i,
            section=tpl["section"], title=tpl["title"], body=tpl["body"],
        ))
    db.commit()
    return {"ok": True, "sections": len(STOURS_TERMS_TEMPLATES)}


# ─── δ  VEHICLE LIBRARY ──────────────────────────────────────────────────────

class VehicleIn(BaseModel):
    label:        str
    type:         str
    capacity_min: int = 1
    capacity_max: int = 4
    brand_models: Optional[str] = None
    rate_per_km:  float = 0.0
    rate_per_day: Optional[float] = None
    currency:     str = "MAD"
    photo_url:    Optional[str] = None
    specs:        Optional[dict] = None
    notes:        Optional[str] = None
    active:       bool = True


class VehicleOut(VehicleIn):
    id: str


def _vehicle_out(v: Vehicle) -> VehicleOut:
    return VehicleOut(
        id=v.id, label=v.label, type=v.type,
        capacity_min=v.capacity_min, capacity_max=v.capacity_max,
        brand_models=v.brand_models, rate_per_km=float(v.rate_per_km),
        rate_per_day=float(v.rate_per_day) if v.rate_per_day else None,
        currency=v.currency, photo_url=v.photo_url, specs=v.specs,
        notes=v.notes, active=v.active,
    )


@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(active_only: bool = True,
                  _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Vehicle)
    if active_only: stmt = stmt.where(Vehicle.active == True)  # noqa
    rows = db.execute(stmt.order_by(Vehicle.capacity_max)).scalars().all()
    return [_vehicle_out(v) for v in rows]


@router.post("/vehicles", response_model=VehicleOut)
def create_vehicle(payload: VehicleIn,
                   _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    v = Vehicle(**payload.model_dump())
    db.add(v); db.commit(); db.refresh(v)
    return _vehicle_out(v)


@router.put("/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: str, payload: VehicleIn,
                   _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    v = db.get(Vehicle, vehicle_id)
    if not v: raise HTTPException(404, "vehicle not found")
    for k, val in payload.model_dump().items(): setattr(v, k, val)
    db.commit(); db.refresh(v)
    return _vehicle_out(v)


@router.delete("/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: str,
                   _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    v = db.get(Vehicle, vehicle_id)
    if not v: raise HTTPException(404, "vehicle not found")
    db.delete(v); db.commit()
    return {"ok": True}


STOURS_VEHICLE_FLEET = [
    {"label": "Berline / Sedan",   "type": "sedan",
     "capacity_min": 1, "capacity_max": 3,
     "brand_models": "Mercedes Classe E, Audi A6 ou similaire",
     "rate_per_km": 6.0, "currency": "MAD",
     "specs": {"ac": True, "wifi": False, "restroom": False, "max_age_years": 4, "luggage_compatible": True}},
    {"label": "Mini-van 4-7 PAX", "type": "mini-van",
     "capacity_min": 4, "capacity_max": 7,
     "brand_models": "Mercedes Vito, Renault Trafic ou similaire",
     "rate_per_km": 7.5, "currency": "MAD",
     "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 5, "luggage_compatible": True}},
    {"label": "Mini-bus 11 PAX",  "type": "minibus",
     "capacity_min": 8, "capacity_max": 11,
     "brand_models": "Mercedes Sprinter, Iveco Daily ou similaire",
     "rate_per_km": 8.0, "currency": "MAD",
     "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 5, "luggage_compatible": True}},
    {"label": "Mini-bus 26 PAX",  "type": "minibus",
     "capacity_min": 12, "capacity_max": 26,
     "brand_models": "Mercedes Sprinter long, Iveco Daily 30 ou similaire",
     "rate_per_km": 9.0, "currency": "MAD",
     "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 5, "seatbelts": True}},
    {"label": "Autocar 39-48 PAX", "type": "coach",
     "capacity_min": 27, "capacity_max": 48,
     "brand_models": "MAN Irizar I6, Mercedes Irizar I6 ou similaire",
     "rate_per_km": 8.5, "currency": "MAD",
     "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 5, "seatbelts": True,
               "note": "Pas de WC à bord — arrêts réguliers prévus sur longs trajets."}},
    {"label": "Autocar 54 PAX",   "type": "coach",
     "capacity_min": 49, "capacity_max": 54,
     "brand_models": "MAN Lion's Coach, Mercedes Tourismo ou similaire",
     "rate_per_km": 9.5, "currency": "MAD",
     "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 5, "seatbelts": True}},
    {"label": "4×4 Land Cruiser", "type": "4wd",
     "capacity_min": 1, "capacity_max": 4,
     "brand_models": "Toyota Land Cruiser ou similaire",
     "rate_per_km": 0, "rate_per_day": 1500.0, "currency": "MAD",
     "specs": {"ac": True, "wifi": False, "off_road": True,
               "ratio_pax_per_vehicle": 4, "use_cases": ["Erfoud-Merzouga", "Désert"]}},
]


@router.post("/vehicles/seed-stours")
def seed_stours_fleet(_: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    created = 0; updated = 0
    for tpl in STOURS_VEHICLE_FLEET:
        existing = db.execute(
            select(Vehicle).where(Vehicle.label == tpl["label"])
        ).scalar_one_or_none()
        if existing:
            for k, val in tpl.items(): setattr(existing, k, val)
            updated += 1
        else:
            db.add(Vehicle(**tpl)); created += 1
    db.commit()
    return {"ok": True, "created": created, "updated": updated, "total": len(STOURS_VEHICLE_FLEET)}


# ─── ε  Misc helpers (monument status, taxes, water, guides, room types) ─────

class DayMetaIn(BaseModel):
    """Patch the JSON-typed activities and add structured fields without Alembic."""
    activities: Optional[list[dict]] = None
    # [{label, entry_status: included|exterior_only|photo_stop|free, fee_pax}]
    room_type:  Optional[str] = None  # Standard | Deluxe | Suite | Junior Suite
    city_taxes_per_night: Optional[float] = None
    mineral_water_policy: Optional[str] = None  # "1 BTL 1.5L / 3 PAX / repas"


@router.put("/days/{day_id}/meta")
def patch_day_meta(day_id: str, payload: DayMetaIn,
                   _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    day = db.get(ItineraryDay, day_id)
    if not day: raise HTTPException(404, "day not found")
    if payload.activities is not None: day.activities = payload.activities
    extra = day.activities or {}
    # we coalesce structured meta into the JSON 'activities' bag for forward-compat
    if isinstance(extra, list):
        meta = {"items": extra}
    else:
        meta = dict(extra) if isinstance(extra, dict) else {}
    if payload.room_type is not None: meta["room_type"] = payload.room_type
    if payload.city_taxes_per_night is not None: meta["city_taxes_per_night"] = payload.city_taxes_per_night
    if payload.mineral_water_policy is not None: meta["mineral_water_policy"] = payload.mineral_water_policy
    if payload.activities is None:  # only meta patch
        day.activities = meta
    db.commit()
    return {"ok": True, "day_id": day.id, "meta": day.activities}


# ─── Listing helpers (used by the Cotation Avancée page) ─────────────────────

@router.get("/projects-with-quotations")
def list_projects_with_quotations(_: dict = Depends(get_current_user),
                                  db: Session = Depends(get_db)):
    """Renvoie la liste compacte (project, quotations[]) pour peupler le sélecteur."""
    rows = db.execute(
        select(Quotation).order_by(Quotation.created_at.desc())
    ).scalars().all()
    by_proj: dict[str, list[dict]] = {}
    for q in rows:
        by_proj.setdefault(q.project_id, []).append({
            "id": q.id, "version": q.version, "status": str(q.status),
            "currency": q.currency, "margin_pct": float(q.margin_pct or 0),
        })
    out = []
    for pid, quotes in by_proj.items():
        p = db.get(Project, pid)
        if not p: continue
        out.append({
            "id": p.id, "name": p.name,
            "client_name": getattr(p, "client_name", None),
            "destination": getattr(p, "destination", None),
            "quotations": quotes,
        })
    return out


# ─── Composite read for the front "Cotation Avancée" page ────────────────────

@router.get("/quotations/{quotation_id}/full")
def full_view(quotation_id: str,
              _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.get(Quotation, quotation_id)
    if not q: raise HTTPException(404, "quotation not found")

    brackets = db.execute(
        select(PricingBracket).where(PricingBracket.quotation_id == quotation_id)
        .order_by(PricingBracket.pax_basis)
    ).scalars().all()
    terms = db.execute(
        select(QuotationTerm).where(QuotationTerm.quotation_id == quotation_id)
        .order_by(QuotationTerm.sort_order)
    ).scalars().all()
    lines = db.execute(
        select(QuotationLine).where(QuotationLine.quotation_id == quotation_id)
        .order_by(QuotationLine.day_number, QuotationLine.sort_order)
    ).scalars().all()

    return {
        "quotation": {
            "id": q.id, "project_id": q.project_id, "version": q.version,
            "status": str(q.status), "currency": q.currency,
            "margin_pct": float(q.margin_pct or 0),
            "single_supplement": float(q.single_supplement or 0) if q.single_supplement else 0,
        },
        "brackets": [_bracket_out(b).model_dump() for b in brackets],
        "terms":    [_term_out(t).model_dump() for t in terms],
        "lines":    [{
            "id": l.id, "day_number": l.day_number, "category": str(l.category),
            "label": l.label, "city": l.city, "supplier": l.supplier,
            "unit_cost": float(l.unit_cost or 0), "quantity": float(l.quantity or 0),
            "total_cost": float(l.total_cost or 0),
        } for l in lines],
        "summary": {
            "total_lines": len(lines),
            "total_brackets": len(brackets),
            "total_terms": len(terms),
        },
    }

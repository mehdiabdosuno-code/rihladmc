"""Cotation Avancée — modèles pour parité avec documents type S'TOURS.

Couvre les gaps identifiés dans l'audit YS Travel Morocco 11D:
- α: PricingBracket (grille PAX scaling 10/15/20/25/30/35 + FOC)
- β: ItineraryDayMeal (pivot day ↔ meals: lunch + dinner)
- γ: QuotationTerm (9 sections T&C structurés)
- δ: Vehicle (catalogue véhicules + photos + specs + tarif/km)
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


# ── α — Pricing grid PAX scaling ─────────────────────────────────────────────

class PricingBracket(Base, BaseMixin):
    """Une ligne de la grille de scaling PAX.

    Exemple S'TOURS YS Travel Morocco 11D :
    pax_basis=10 foc=1 price_pp=1588 single_supp=315 currency=USD.
    """
    __tablename__ = "quotation_pricing_brackets"

    quotation_id:    Mapped[str] = mapped_column(String(36),
                        ForeignKey("quotations.id", ondelete="CASCADE"), index=True)
    pax_basis:       Mapped[int] = mapped_column(Integer, index=True)   # 10, 15, 20…
    foc_count:       Mapped[int] = mapped_column(Integer, default=1)    # tour leader free
    price_per_pax:   Mapped[float] = mapped_column(Float, default=0.0)
    single_supplement: Mapped[float] = mapped_column(Float, default=0.0)
    currency:        Mapped[str] = mapped_column(String(10), default="EUR")
    breakdown:       Mapped[Optional[dict]] = mapped_column(JSON)
    # breakdown JSON: { hotel: 5243, restaurants: 1566, monuments: 620, tips_lug: 70,
    #                   tips_rest: 75, tour_leader: 1013, guide: 900, guide_local: 30,
    #                   horse: 100, jeep_4wd: 280, camel: 100, water: 45, bus: 3150,
    #                   subtotal: 13233, markup_pct: 8, markup: 1058 }


# ── β — Catering pivot day ↔ meals ────────────────────────────────────────────

class ItineraryDayMeal(Base, BaseMixin):
    """Repas (lunch/dinner) attaché à un jour d'itinéraire."""
    __tablename__ = "itinerary_day_meals"

    day_id:          Mapped[str] = mapped_column(String(36),
                        ForeignKey("itinerary_days.id", ondelete="CASCADE"), index=True)
    meal_type:       Mapped[str] = mapped_column(String(20), index=True)
    # breakfast | lunch | dinner | gala | bbq | picnic | other
    city:            Mapped[Optional[str]] = mapped_column(String(120))
    restaurant_name: Mapped[Optional[str]] = mapped_column(String(200))
    menu_text:       Mapped[Optional[str]] = mapped_column(Text)
    menu_id:         Mapped[Optional[str]] = mapped_column(String(36),
                        ForeignKey("menus.id", ondelete="SET NULL"), nullable=True)
    cost_per_pax:    Mapped[Optional[float]] = mapped_column(Float)
    currency:        Mapped[Optional[str]] = mapped_column(String(10))


# ── γ — Terms & Conditions structurés ────────────────────────────────────────

class QuotationTerm(Base, BaseMixin):
    """Section de termes et conditions attachée à une cotation."""
    __tablename__ = "quotation_terms"

    quotation_id:    Mapped[str] = mapped_column(String(36),
                        ForeignKey("quotations.id", ondelete="CASCADE"), index=True)
    section:         Mapped[str] = mapped_column(String(50), index=True)
    # validity | pricing_currency | payment | deposit | cancellation | modifications |
    # force_majeure | hotel_substitution | vehicle_disclaimer | hotel_services |
    # responsibility | rooming_list | booking_process
    title:           Mapped[Optional[str]] = mapped_column(String(200))
    body:            Mapped[str] = mapped_column(Text)
    sort_order:      Mapped[int] = mapped_column(Integer, default=0)


# ── δ — Vehicle library ──────────────────────────────────────────────────────

class Vehicle(Base, BaseMixin):
    """Catalogue véhicules — peut être référencé par QuotationLine."""
    __tablename__ = "vehicles"

    label:           Mapped[str] = mapped_column(String(200), index=True)
    type:            Mapped[str] = mapped_column(String(40))   # mini-van | minibus | coach | 4wd | sedan
    capacity_min:    Mapped[int] = mapped_column(Integer, default=1)
    capacity_max:    Mapped[int] = mapped_column(Integer, default=4)
    brand_models:    Mapped[Optional[str]] = mapped_column(String(300))  # MAN Irizar I6, Mercedes Sprinter
    rate_per_km:     Mapped[float] = mapped_column(Float, default=0.0)
    rate_per_day:    Mapped[Optional[float]] = mapped_column(Float)
    currency:        Mapped[str] = mapped_column(String(10), default="MAD")
    photo_url:       Mapped[Optional[str]] = mapped_column(String(500))
    specs:           Mapped[Optional[dict]] = mapped_column(JSON)
    # specs: { ac: true, wifi: true, restroom: false, max_age_years: 5, seatbelts: true, ... }
    notes:           Mapped[Optional[str]] = mapped_column(Text)
    active:          Mapped[bool] = mapped_column(default=True)

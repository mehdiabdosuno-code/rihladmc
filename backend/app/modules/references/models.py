"""References module — Generateur de références de dossiers S'TOURS.

Format : [NOM GROUPE] [Ville IATA] [DEPT] [AAMMJJ] [NNNN]
Exemple : TECHCORP Casablanca CMN ME 260416 0001
"""

from typing import Optional
from sqlalchemy import String, Integer, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


AIRPORTS = [
    {"city": "Casablanca",  "code": "CMN"},
    {"city": "Marrakech",   "code": "RAK"},
    {"city": "Agadir",      "code": "AGA"},
    {"city": "Fès",         "code": "FEZ"},
    {"city": "Tanger",      "code": "TNG"},
    {"city": "Rabat",       "code": "RBA"},
    {"city": "Essaouira",   "code": "ESU"},
    {"city": "Ouarzazate",  "code": "OZZ"},
    {"city": "Nador",       "code": "NDR"},
    {"city": "Oujda",       "code": "OUD"},
    {"city": "Dakhla",      "code": "VIL"},
    {"city": "Laâyoune",    "code": "EUN"},
    {"city": "Guelmim",     "code": "GLN"},
    {"city": "Tétouan",     "code": "TTU"},
    {"city": "Al Hoceima",  "code": "AHU"},
    {"city": "Errachidia",  "code": "ERH"},
]

DEPARTMENTS = [
    {"code": "ME", "label": "Meetings & Events"},
    {"code": "DL", "label": "Découverte & Loisirs"},
    {"code": "DI", "label": "Direction"},
    {"code": "BT", "label": "Business Travel"},
    {"code": "MS", "label": "MICE & Séminaires"},
]


class ReferenceCounter(Base, BaseMixin):
    """Compteur auto-incrémenté par clé (dept + date).
    Garantit l'unicité des numéros à 4 chiffres par département et par date.
    """

    __tablename__ = "reference_counters"

    dept_code:  Mapped[str] = mapped_column(String(5),  nullable=False)
    date_str:   Mapped[str] = mapped_column(String(6),  nullable=False)  # AAMMJJ
    last_num:   Mapped[int] = mapped_column(Integer,    default=0)       # dernier numéro utilisé

    __table_args__ = (
        UniqueConstraint("dept_code", "date_str", name="uq_counter_dept_date"),
        Index("idx_counter_key", "dept_code", "date_str"),
    )


class GeneratedReference(Base, BaseMixin):
    """Archive de toutes les références générées."""

    __tablename__ = "generated_references"

    group_name:  Mapped[str]           = mapped_column(String(300), nullable=False)
    airport_city:Mapped[str]           = mapped_column(String(100), nullable=False)
    airport_code:Mapped[str]           = mapped_column(String(5),   nullable=False)
    dept_code:   Mapped[str]           = mapped_column(String(5),   nullable=False)
    date_str:    Mapped[str]           = mapped_column(String(6),   nullable=False)
    seq_number:  Mapped[int]           = mapped_column(Integer,     nullable=False)
    full_reference: Mapped[str]        = mapped_column(String(500), nullable=False, unique=True)
    project_id:  Mapped[Optional[str]] = mapped_column(String(36),  nullable=True)
    notes:       Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("idx_ref_dept",  "dept_code"),
        Index("idx_ref_date",  "date_str"),
        Index("idx_ref_group", "group_name"),
    )

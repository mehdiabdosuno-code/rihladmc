"""Document Flow — document templates & operational forms.

Stores S'TOURS internal document templates (voucher, reservation, information
letter, appreciation forms, tips sheet, letterhead, etc.) as structured data
so they can be generated dynamically with project/quotation data.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class DocumentTemplate(Base, BaseMixin):
    """Template de document opérationnel S'TOURS."""
    __tablename__ = "document_templates"

    code:        Mapped[str] = mapped_column(String(50), unique=True, index=True)
    # voucher | reservation | information_letter | appreciation_de | appreciation_en |
    # tips_sheet | letterhead | fiche_dossier
    name:        Mapped[str] = mapped_column(String(200))
    name_i18n:   Mapped[Optional[dict]] = mapped_column(JSON)
    # {"fr": "Bon de service", "en": "Service Voucher", "de": "Gutschein", ...}
    category:    Mapped[str] = mapped_column(String(50), default="operational")
    # operational | branding | client_facing | internal
    description: Mapped[Optional[str]] = mapped_column(Text)
    language:    Mapped[str] = mapped_column(String(10), default="fr")
    # Primary language of the template
    fields:      Mapped[Optional[dict]] = mapped_column(JSON)
    # JSON schema of dynamic fields, e.g.:
    # {"dossier_ref": "string", "client_name": "string", "pax_count": "number",
    #  "rooms": {"single": "number", "double": "number", "triple": "number"},
    #  "meals": {"breakfast": "bool", "lunch": "bool", "dinner": "bool"},
    #  "transport": {"type": "string", "pickup": "string", "dropoff": "string"}}
    body_html:   Mapped[Optional[str]] = mapped_column(Text)
    # HTML template with {{variable}} placeholders
    body_text:   Mapped[Optional[str]] = mapped_column(Text)
    # Plain text fallback
    active:      Mapped[bool] = mapped_column(Boolean, default=True)

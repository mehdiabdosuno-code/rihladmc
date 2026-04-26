"""Media library — shared assets (photos, POI descriptions) across DMC team (B2)."""

from typing import Optional
from sqlalchemy import String, Text, Integer, JSON, Index, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class MediaAsset(Base, BaseMixin):
    """A shared asset (photo or POI description) reusable across projects."""

    __tablename__ = "media_assets"

    company_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    asset_type: Mapped[str] = mapped_column(String(20), default="photo")  # photo | poi | description
    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[Optional[str]] = mapped_column(String(300))
    description: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    country: Mapped[Optional[str]] = mapped_column(String(50), default="Maroc")
    category: Mapped[Optional[str]] = mapped_column(String(50))   # culture, gastronomy, nature, hotel, ...
    tags: Mapped[Optional[list]] = mapped_column(JSON)
    language: Mapped[str] = mapped_column(String(10), default="fr")
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    thumb_url: Mapped[Optional[str]] = mapped_column(String(500))
    source: Mapped[Optional[str]] = mapped_column(String(200))   # photographer / source attribution
    license: Mapped[Optional[str]] = mapped_column(String(50))
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    use_count: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        Index("idx_media_company", "company_id"),
        Index("idx_media_city", "city"),
        Index("idx_media_type", "asset_type"),
    )

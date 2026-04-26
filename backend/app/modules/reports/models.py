"""Report Builder models — DataSource, DataRecord, Report, ExportLog."""

from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class DataSource(Base, BaseMixin):
    """A named dataset (Ventes, Hôtels, Clients…)."""

    __tablename__ = "report_data_sources"

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    source_type: Mapped[str] = mapped_column(String(50), default="manual")
    # fields: [{"name": "CA", "type": "num", "label": "Chiffre d'affaires"}]
    fields: Mapped[Optional[dict]] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    records: Mapped[list["DataRecord"]] = relationship(
        "DataRecord", back_populates="data_source", cascade="all, delete-orphan"
    )
    reports: Mapped[list["Report"]] = relationship(
        "Report", back_populates="data_source"
    )


class DataRecord(Base, BaseMixin):
    """Single row stored for a DataSource."""

    __tablename__ = "report_data_records"

    data_source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("report_data_sources.id", ondelete="CASCADE"), index=True
    )
    row_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    period: Mapped[Optional[str]] = mapped_column(String(50))

    data_source: Mapped["DataSource"] = relationship("DataSource", back_populates="records")

    __table_args__ = (Index("idx_record_source", "data_source_id"),)


class Report(Base, BaseMixin):
    """Saved report definition — title, widgets, filters, settings."""

    __tablename__ = "reports"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String(500))
    data_source_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("report_data_sources.id", ondelete="SET NULL"), nullable=True
    )
    # widgets: [{"type": "kpi"|"chart"|"table", "order": 1, "config": {}}]
    widgets: Mapped[Optional[dict]] = mapped_column(JSON, default=list)
    # filters: [{"field": "Ville", "op": "=", "value": "Marrakech"}]
    filters: Mapped[Optional[dict]] = mapped_column(JSON, default=list)
    # settings: {"color": "#A8371D", "group_by": "Ville", "show_totals": true}
    settings: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)

    data_source: Mapped[Optional["DataSource"]] = relationship(
        "DataSource", back_populates="reports"
    )
    exports: Mapped[list["ExportLog"]] = relationship(
        "ExportLog", back_populates="report", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("idx_report_template", "is_template"),)


class ExportLog(Base, BaseMixin):
    """Audit trail for every generated export."""

    __tablename__ = "report_export_logs"

    report_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("reports.id", ondelete="CASCADE"), index=True
    )
    format: Mapped[str] = mapped_column(String(20))   # pdf | pptx | xlsx | csv
    file_path: Mapped[Optional[str]] = mapped_column(String(500))
    file_size: Mapped[Optional[int]] = mapped_column(Integer)

    report: Mapped["Report"] = relationship("Report", back_populates="exports")

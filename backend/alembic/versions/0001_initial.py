"""Initial migration — all STOURS Studio tables.

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── permissions ────────────────────────────────────────────────
    op.create_table(
        "permissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.String(500)),
        sa.Column("module", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── roles ──────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.String(500)),
        sa.Column("permissions_json", sa.JSON()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── role_permissions ───────────────────────────────────────────
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.String(36), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", sa.String(36), sa.ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    )

    # ── users ──────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255)),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("role_id", sa.String(36), sa.ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── audit_logs ─────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("changes", sa.JSON()),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("description", sa.String(1000)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── ai_requests ────────────────────────────────────────────────
    op.create_table(
        "ai_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("project_id", sa.String(36), nullable=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("request_type", sa.String(50), nullable=False),
        sa.Column("input_tokens", sa.Integer(), default=0),
        sa.Column("output_tokens", sa.Integer(), default=0),
        sa.Column("cost_usd", sa.Numeric(10, 6)),
        sa.Column("duration_ms", sa.Integer()),
        sa.Column("status", sa.String(20), default="success"),
        sa.Column("error_message", sa.Text()),
        sa.Column("active", sa.Boolean(), default=True),
        sa.Column("created_by", sa.String(36)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    # ── projects ───────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("reference", sa.String(100), unique=True),
        sa.Column("client_name", sa.String(200)),
        sa.Column("client_email", sa.String(255)),
        sa.Column("status", sa.String(50), default="draft"),
        sa.Column("project_type", sa.String(50)),
        sa.Column("destination", sa.String(200)),
        sa.Column("duration_days", sa.Integer()),
        sa.Column("duration_nights", sa.Integer()),
        sa.Column("pax_count", sa.Integer()),
        sa.Column("travel_dates", sa.String(200)),
        sa.Column("language", sa.String(10), default="fr"),
        sa.Column("currency", sa.String(10), default="EUR"),
        sa.Column("notes", sa.Text()),
        sa.Column("tags", sa.JSON()),
        sa.Column("cover_image_url", sa.String(500)),
        sa.Column("map_image_url", sa.String(500)),
        sa.Column("highlights", sa.JSON()),
        sa.Column("inclusions", sa.JSON()),
        sa.Column("exclusions", sa.JSON()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── quotations ─────────────────────────────────────────────────
    op.create_table(
        "quotations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), default=1),
        sa.Column("status", sa.String(50), default="draft"),
        sa.Column("currency", sa.String(10), default="EUR"),
        sa.Column("margin_pct", sa.Numeric(5, 2), default=0),
        sa.Column("notes", sa.Text()),
        sa.Column("total_cost", sa.Numeric(12, 2)),
        sa.Column("total_selling", sa.Numeric(12, 2)),
        sa.Column("price_per_pax", sa.Numeric(12, 2)),
        sa.Column("single_supplement", sa.Numeric(12, 2)),
        sa.Column("pricing_grid", sa.JSON()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── quotation_lines ────────────────────────────────────────────
    op.create_table(
        "quotation_lines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("quotation_id", sa.String(36), sa.ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_number", sa.Integer()),
        sa.Column("sort_order", sa.Integer(), default=0),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("label", sa.String(300), nullable=False),
        sa.Column("city", sa.String(100)),
        sa.Column("supplier", sa.String(200)),
        sa.Column("unit_cost", sa.Numeric(12, 2), default=0),
        sa.Column("quantity", sa.Numeric(10, 2), default=1),
        sa.Column("unit", sa.String(50)),
        sa.Column("total_cost", sa.Numeric(12, 2), default=0),
        sa.Column("is_included", sa.Boolean(), default=True),
        sa.Column("notes", sa.Text()),
        sa.Column("meta", sa.JSON()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── itineraries ────────────────────────────────────────────────
    op.create_table(
        "itineraries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), default=1),
        sa.Column("language", sa.String(10), default="fr"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── itinerary_days ─────────────────────────────────────────────
    op.create_table(
        "itinerary_days",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("itinerary_id", sa.String(36), sa.ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("subtitle", sa.String(300)),
        sa.Column("city", sa.String(100)),
        sa.Column("description", sa.Text()),
        sa.Column("hotel", sa.String(200)),
        sa.Column("hotel_category", sa.String(20)),
        sa.Column("meal_plan", sa.String(20)),
        sa.Column("travel_time", sa.String(100)),
        sa.Column("distance_km", sa.Integer()),
        sa.Column("activities", sa.JSON()),
        sa.Column("image_url", sa.String(500)),
        sa.Column("image_url_2", sa.String(500)),
        sa.Column("ai_generated", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── report_data_sources ────────────────────────────────────────
    op.create_table(
        "report_data_sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("source_type", sa.String(50), default="manual"),
        sa.Column("fields", sa.JSON()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── report_data_records ────────────────────────────────────────
    op.create_table(
        "report_data_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("data_source_id", sa.String(36), sa.ForeignKey("report_data_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("row_data", sa.JSON(), nullable=False),
        sa.Column("period", sa.String(50)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )

    # ── reports ────────────────────────────────────────────────────
    op.create_table(
        "reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("subtitle", sa.String(500)),
        sa.Column("data_source_id", sa.String(36), sa.ForeignKey("report_data_sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("widgets", sa.JSON()),
        sa.Column("filters", sa.JSON()),
        sa.Column("settings", sa.JSON()),
        sa.Column("is_template", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )


    # ── reference_counters ─────────────────────────────────────────
    op.create_table(
        "reference_counters",
        sa.Column("id",         sa.String(36), primary_key=True),
        sa.Column("dept_code",  sa.String(5),  nullable=False),
        sa.Column("date_str",   sa.String(6),  nullable=False),
        sa.Column("last_num",   sa.Integer(),  default=0),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active",     sa.Boolean(), default=True),
        sa.UniqueConstraint("dept_code", "date_str", name="uq_counter_dept_date"),
    )


    # ── invoice_counters ───────────────────────────────────────────
    op.create_table(
        "invoice_counters",
        sa.Column("id",       sa.String(36), primary_key=True),
        sa.Column("year",     sa.Integer(),  nullable=False, unique=True),
        sa.Column("last_num", sa.Integer(),  default=0),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active",   sa.Boolean(), default=True),
    )

    # ── invoice_templates ──────────────────────────────────────────
    op.create_table(
        "invoice_templates",
        sa.Column("id",           sa.String(36), primary_key=True),
        sa.Column("name",         sa.String(200), nullable=False),
        sa.Column("filename",     sa.String(300)),
        sa.Column("file_path",    sa.String(500)),
        sa.Column("variable_map", sa.JSON()),
        sa.Column("is_default",   sa.Boolean(), default=False),
        sa.Column("notes",        sa.Text()),
        sa.Column("created_at",   sa.DateTime()),
        sa.Column("updated_at",   sa.DateTime()),
        sa.Column("created_by",   sa.String(36)),
        sa.Column("active",       sa.Boolean(), default=True),
    )

    # ── invoices ───────────────────────────────────────────────────
    op.create_table(
        "invoices",
        sa.Column("id",             sa.String(36), primary_key=True),
        sa.Column("number",         sa.String(30),  nullable=False, unique=True),
        sa.Column("project_id",     sa.String(36),  sa.ForeignKey("projects.id",  ondelete="RESTRICT"), nullable=False),
        sa.Column("quotation_id",   sa.String(36),  sa.ForeignKey("quotations.id",ondelete="SET NULL"), nullable=True),
        sa.Column("template_id",    sa.String(36),  nullable=True),
        sa.Column("client_name",    sa.String(300)),
        sa.Column("client_email",   sa.String(255)),
        sa.Column("client_address", sa.Text()),
        sa.Column("issue_date",     sa.String(20)),
        sa.Column("due_date",       sa.String(20)),
        sa.Column("travel_dates",   sa.String(200)),
        sa.Column("currency",       sa.String(10), default="EUR"),
        sa.Column("subtotal",       sa.Numeric(12,2), default=0),
        sa.Column("tax_rate",       sa.Numeric(5,2),  default=0),
        sa.Column("tax_amount",     sa.Numeric(12,2), default=0),
        sa.Column("total",          sa.Numeric(12,2), default=0),
        sa.Column("deposit_pct",    sa.Numeric(5,2),  default=30),
        sa.Column("deposit_amount", sa.Numeric(12,2), default=0),
        sa.Column("balance_due",    sa.Numeric(12,2), default=0),
        sa.Column("pax_count",      sa.Integer()),
        sa.Column("price_per_pax",  sa.Numeric(12,2)),
        sa.Column("status",         sa.String(30), default="draft"),
        sa.Column("pdf_path",       sa.String(500)),
        sa.Column("pdf_generated",  sa.Boolean(), default=False),
        sa.Column("notes",          sa.Text()),
        sa.Column("payment_terms",  sa.Text()),
        sa.Column("lines",          sa.JSON()),
        sa.Column("created_at",     sa.DateTime()),
        sa.Column("updated_at",     sa.DateTime()),
        sa.Column("created_by",     sa.String(36)),
        sa.Column("active",         sa.Boolean(), default=True),
    )

    # ── generated_references ───────────────────────────────────────
    op.create_table(
        "generated_references",
        sa.Column("id",             sa.String(36),  primary_key=True),
        sa.Column("group_name",     sa.String(300), nullable=False),
        sa.Column("airport_city",   sa.String(100), nullable=False),
        sa.Column("airport_code",   sa.String(5),   nullable=False),
        sa.Column("dept_code",      sa.String(5),   nullable=False),
        sa.Column("date_str",       sa.String(6),   nullable=False),
        sa.Column("seq_number",     sa.Integer(),   nullable=False),
        sa.Column("full_reference", sa.String(500), nullable=False, unique=True),
        sa.Column("project_id",     sa.String(36),  nullable=True),
        sa.Column("notes",          sa.String(500), nullable=True),
        sa.Column("created_at",     sa.DateTime()),
        sa.Column("updated_at",     sa.DateTime()),
        sa.Column("created_by",     sa.String(36)),
        sa.Column("active",         sa.Boolean(), default=True),
    )

    # ── report_export_logs ─────────────────────────────────────────
    op.create_table(
        "report_export_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("report_id", sa.String(36), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("format", sa.String(20), nullable=False),
        sa.Column("file_path", sa.String(500)),
        sa.Column("file_size", sa.Integer()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )


def downgrade() -> None:
    for table in [
        "invoices", "invoice_templates", "invoice_counters", "generated_references", "reference_counters", "report_export_logs", "reports", "report_data_records",
        "report_data_sources", "itinerary_days", "itineraries",
        "quotation_lines", "quotations", "projects",
        "ai_requests", "audit_logs", "users",
        "role_permissions", "roles", "permissions",
    ]:
        op.drop_table(table)

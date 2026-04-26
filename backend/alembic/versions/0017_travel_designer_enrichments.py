"""Travel Designer enrichments — ItineraryDay, Project, Quotation models.

Revision ID: 0017
Revises: 0016
"""

from alembic import op
import sqlalchemy as sa

revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ItineraryDay — per-day costing fields
    op.add_column('itinerary_days', sa.Column('room_type', sa.String(50), nullable=True))
    op.add_column('itinerary_days', sa.Column('city_tax_per_night', sa.Float, nullable=True))
    op.add_column('itinerary_days', sa.Column('water_bottles', sa.Integer, nullable=True))
    op.add_column('itinerary_days', sa.Column('local_guide_cost', sa.Float, nullable=True))
    op.add_column('itinerary_days', sa.Column('restaurant_lunch', sa.String(200), nullable=True))
    op.add_column('itinerary_days', sa.Column('restaurant_dinner', sa.String(200), nullable=True))
    op.add_column('itinerary_days', sa.Column('lunch_cost_pax', sa.Float, nullable=True))
    op.add_column('itinerary_days', sa.Column('dinner_cost_pax', sa.Float, nullable=True))
    op.add_column('itinerary_days', sa.Column('half_dbl_rate', sa.Float, nullable=True))
    op.add_column('itinerary_days', sa.Column('single_supplement', sa.Float, nullable=True))
    op.add_column('itinerary_days', sa.Column('monuments_detail', sa.JSON, nullable=True))
    op.add_column('itinerary_days', sa.Column('luggage_handling', sa.Float, nullable=True))

    # Project — guide, water, logistics rules
    op.add_column('projects', sa.Column('guide_rules', sa.JSON, nullable=True))
    op.add_column('projects', sa.Column('water_policy', sa.JSON, nullable=True))
    op.add_column('projects', sa.Column('competitor_name', sa.String(200), nullable=True))
    op.add_column('projects', sa.Column('km_total', sa.Integer, nullable=True))
    op.add_column('projects', sa.Column('bus_rate_per_km', sa.Numeric(8, 2), nullable=True))

    # Quotation — FOC count
    op.add_column('quotations', sa.Column('foc_count', sa.Integer, server_default='1', nullable=False))


def downgrade() -> None:
    op.drop_column('quotations', 'foc_count')

    op.drop_column('projects', 'bus_rate_per_km')
    op.drop_column('projects', 'km_total')
    op.drop_column('projects', 'competitor_name')
    op.drop_column('projects', 'water_policy')
    op.drop_column('projects', 'guide_rules')

    op.drop_column('itinerary_days', 'luggage_handling')
    op.drop_column('itinerary_days', 'monuments_detail')
    op.drop_column('itinerary_days', 'single_supplement')
    op.drop_column('itinerary_days', 'half_dbl_rate')
    op.drop_column('itinerary_days', 'dinner_cost_pax')
    op.drop_column('itinerary_days', 'lunch_cost_pax')
    op.drop_column('itinerary_days', 'restaurant_dinner')
    op.drop_column('itinerary_days', 'restaurant_lunch')
    op.drop_column('itinerary_days', 'local_guide_cost')
    op.drop_column('itinerary_days', 'water_bottles')
    op.drop_column('itinerary_days', 'city_tax_per_night')
    op.drop_column('itinerary_days', 'room_type')

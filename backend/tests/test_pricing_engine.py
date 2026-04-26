"""Tests for the DMC Pricing Engine — pure unit tests, no database needed.

Tests the deterministic calculation logic for all service categories:
hotel, transport, guide, activity, monument, taxi, misc.
"""

import pytest
from app.modules.quotations.pricing_engine import (
    calculate_service,
    calculate_range,
    calculate_quotation,
    round2,
    ceil_up,
)


# ════════════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════════════


class TestHelpers:
    def test_round2_normal(self):
        assert round2(10.555) == 10.56

    def test_round2_no_float_artifact(self):
        assert round2(1.005) == 1.01

    def test_ceil_up_integer(self):
        assert ceil_up(3.0) == 3

    def test_ceil_up_fraction(self):
        assert ceil_up(3.1) == 4

    def test_ceil_up_near_integer(self):
        """Very small floating point errors should NOT round up."""
        assert ceil_up(3.0000000001) == 3


# ════════════════════════════════════════════════════════════════════════════
# HOTEL
# ════════════════════════════════════════════════════════════════════════════


class TestHotelCalculation:
    def test_double_room_1_night(self):
        svc = {"category": "hotel", "price_per_room": 200, "occupancy": "double", "nights": 1}
        r = calculate_service(svc, min_pax=10)
        assert r.cost_per_person == 100.0  # 200 / 2 × 1 nuit
        assert r.total_cost == 1000.0

    def test_single_room_3_nights(self):
        svc = {"category": "hotel", "price_per_room": 300, "occupancy": "single", "nights": 3}
        r = calculate_service(svc, min_pax=5)
        assert r.cost_per_person == 900.0  # 300 / 1 × 3
        assert r.total_cost == 4500.0

    def test_triple_occupancy(self):
        svc = {"category": "hotel", "price_per_room": 180, "occupancy": "triple", "nights": 2}
        r = calculate_service(svc, min_pax=15)
        assert round2(r.cost_per_person) == 120.0  # 180 / 3 × 2

    def test_unknown_occupancy_defaults_to_double(self):
        svc = {"category": "hotel", "price_per_room": 200, "occupancy": "unknown_occ", "nights": 1}
        r = calculate_service(svc, min_pax=10)
        assert r.cost_per_person == 100.0  # fallback divisor=2


# ════════════════════════════════════════════════════════════════════════════
# TRANSPORT
# ════════════════════════════════════════════════════════════════════════════


class TestTransportCalculation:
    def test_exact_fit(self):
        """20 pax, capacity 20 → 1 vehicle."""
        svc = {"category": "transport", "price_per_vehicle": 1000, "vehicle_capacity": 20, "days": 1}
        r = calculate_service(svc, min_pax=20)
        assert r.cost_per_person == 50.0  # 1000 / 20
        assert r.total_cost == 1000.0
        assert r.meta["vehicles"] == 1

    def test_needs_extra_vehicle(self):
        """21 pax, capacity 20 → 2 vehicles (ceil)."""
        svc = {"category": "transport", "price_per_vehicle": 1000, "vehicle_capacity": 20, "days": 1}
        r = calculate_service(svc, min_pax=21)
        assert r.meta["vehicles"] == 2
        assert r.total_cost == 2000.0
        assert round2(r.cost_per_person) == round2(2000 / 21)

    def test_multi_day(self):
        """2 vehicles × 3 days × 500."""
        svc = {"category": "transport", "price_per_vehicle": 500, "vehicle_capacity": 10, "days": 3}
        r = calculate_service(svc, min_pax=15)  # ceil(15/10)=2 vehicles
        assert r.meta["vehicles"] == 2
        assert r.total_cost == 3000.0  # 2 × 500 × 3

    def test_zero_capacity_returns_warning(self):
        """Invalid capacity → warning, 0 cost."""
        svc = {"category": "transport", "price_per_vehicle": 500, "vehicle_capacity": 0}
        r = calculate_service(svc, min_pax=10)
        assert r.cost_per_person == 0
        assert len(r.warnings) > 0

    def test_overcapacity_warning(self):
        """1 coach for 10 pax → over 1.5× over-capacity warning."""
        svc = {"category": "transport", "price_per_vehicle": 1000, "vehicle_capacity": 55, "days": 1}
        r = calculate_service(svc, min_pax=10)
        assert any("Sur-capacité" in w for w in r.warnings)


# ════════════════════════════════════════════════════════════════════════════
# GUIDE
# ════════════════════════════════════════════════════════════════════════════


class TestGuideCalculation:
    def test_guide_1_day(self):
        svc = {"category": "guide", "daily_cost": 400, "days": 1}
        r = calculate_service(svc, min_pax=20)
        assert r.cost_per_person == 20.0  # 400 / 20

    def test_guide_7_days(self):
        svc = {"category": "guide", "daily_cost": 400, "days": 7}
        r = calculate_service(svc, min_pax=10)
        assert r.total_cost == 2800.0
        assert r.cost_per_person == 280.0


# ════════════════════════════════════════════════════════════════════════════
# ACTIVITY / MONUMENT
# ════════════════════════════════════════════════════════════════════════════


class TestActivityCalculation:
    def test_per_person_mode(self):
        svc = {"category": "activity", "price": 50, "pricing_mode": "per_person"}
        r = calculate_service(svc, min_pax=20)
        assert r.cost_per_person == 50.0
        assert r.total_cost == 1000.0

    def test_total_mode(self):
        svc = {"category": "activity", "price": 600, "pricing_mode": "total"}
        r = calculate_service(svc, min_pax=20)
        assert r.cost_per_person == 30.0  # 600 / 20
        assert r.total_cost == 600.0

    def test_monument_category(self):
        svc = {"category": "monument", "price": 80, "pricing_mode": "per_person"}
        r = calculate_service(svc, min_pax=10)
        assert r.category == "monument"
        assert r.cost_per_person == 80.0

    def test_default_mode_is_per_person(self):
        """When pricing_mode is absent, should default to per_person."""
        svc = {"category": "activity", "price": 40}
        r = calculate_service(svc, min_pax=10)
        assert r.cost_per_person == 40.0


# ════════════════════════════════════════════════════════════════════════════
# MISC
# ════════════════════════════════════════════════════════════════════════════


class TestMiscCalculation:
    def test_misc_direct(self):
        svc = {"category": "misc", "price": 25}
        r = calculate_service(svc, min_pax=10)
        assert r.cost_per_person == 25.0
        assert r.total_cost == 250.0


# ════════════════════════════════════════════════════════════════════════════
# CALCULATE_RANGE
# ════════════════════════════════════════════════════════════════════════════


SAMPLE_SERVICES = [
    {"category": "hotel",     "price_per_room": 200, "occupancy": "double", "nights": 5},
    {"category": "transport", "price_per_vehicle": 800, "vehicle_capacity": 20, "days": 5},
    {"category": "guide",     "daily_cost": 500, "days": 5},
    {"category": "activity",  "price": 60, "pricing_mode": "per_person"},
    {"category": "misc",      "price": 30},
]


class TestCalculateRange:
    def test_basic_range(self):
        r = calculate_range(20, 30, SAMPLE_SERVICES, margin_pct=0, currency="EUR")
        assert r.basis == 20
        assert r.cost_per_person > 0
        assert r.cost_total_group == round2(r.cost_per_person * 20)

    def test_margin_applied(self):
        r0 = calculate_range(20, 30, SAMPLE_SERVICES, margin_pct=0)
        r15 = calculate_range(20, 30, SAMPLE_SERVICES, margin_pct=15)
        assert round2(r15.selling_per_person) == round2(r0.cost_per_person * 1.15)

    def test_invalid_min_pax(self):
        with pytest.raises(ValueError):
            calculate_range(0, 10, SAMPLE_SERVICES)

    def test_max_pax_less_than_min(self):
        with pytest.raises(ValueError):
            calculate_range(20, 10, SAMPLE_SERVICES)

    def test_by_category_breakdown(self):
        r = calculate_range(20, 30, SAMPLE_SERVICES)
        assert "hotel" in r.by_category
        assert "transport" in r.by_category
        assert "guide" in r.by_category

    def test_uses_min_pax_not_max(self):
        """Two ranges with same min_pax must produce identical results."""
        r1 = calculate_range(20, 20, SAMPLE_SERVICES)
        r2 = calculate_range(20, 40, SAMPLE_SERVICES)
        assert r1.cost_per_person == r2.cost_per_person

    def test_inactive_services_excluded(self):
        services = [
            {"category": "misc", "price": 50, "active": True},
            {"category": "misc", "price": 999, "active": False},
        ]
        r = calculate_range(10, 10, services)
        assert r.cost_per_person == 50.0


# ════════════════════════════════════════════════════════════════════════════
# CALCULATE_QUOTATION (multi-range)
# ════════════════════════════════════════════════════════════════════════════


class TestCalculateQuotation:
    def test_multi_range_output(self):
        ranges = [
            {"min": 10, "max": 14},
            {"min": 15, "max": 19},
            {"min": 20, "max": 25},
        ]
        result = calculate_quotation(ranges, SAMPLE_SERVICES, margin_pct=10)
        assert len(result["ranges"]) == 3
        assert result["summary"]["range_count"] == 3

    def test_price_decreases_with_pax(self):
        """More pax → lower per-person price (transport fixed cost diluted)."""
        ranges = [{"min": 10, "max": 14}, {"min": 30, "max": 40}]
        result = calculate_quotation(ranges, SAMPLE_SERVICES)
        prices = [r["cost_per_person"] for r in result["ranges"]]
        assert prices[0] > prices[1]  # 10 pax is more expensive per person

    def test_no_ranges_raises(self):
        with pytest.raises(ValueError):
            calculate_quotation([], SAMPLE_SERVICES)

    def test_comparison_structure(self):
        ranges = [{"min": 20, "max": 30}]
        result = calculate_quotation(ranges, SAMPLE_SERVICES, margin_pct=15)
        assert "comparison" in result
        assert result["summary"]["lowest_per_person"] is not None

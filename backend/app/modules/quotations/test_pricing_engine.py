"""Tests for the pricing engine — pure functions, no DB."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.modules.quotations.pricing_engine import (
    calculate_service, calculate_range, calculate_quotation,
    ceil_up, round2,
)

passed = failed = 0

def assert_eq(actual, expected, msg):
    global passed, failed
    if actual == expected:
        passed += 1
        print(f"  ✓ {msg}")
    else:
        failed += 1
        print(f"  ✗ {msg}  (got: {actual}, expected: {expected})")

def assert_near(actual, expected, msg, tol=0.01):
    global passed, failed
    if abs(actual - expected) < tol:
        passed += 1
        print(f"  ✓ {msg}")
    else:
        failed += 1
        print(f"  ✗ {msg}  (got: {actual}, expected: ~{expected})")

def assert_true(cond, msg):
    global passed, failed
    if cond:
        passed += 1; print(f"  ✓ {msg}")
    else:
        failed += 1; print(f"  ✗ {msg}")


# ═══ ceil_up ══════════════════════════════════════════════════════
print("\n── ceil_up ────────────────────────────────")
assert_eq(ceil_up(2.14), 3, "ceil_up(2.14) = 3")
assert_eq(ceil_up(2.0),  2, "ceil_up(2.0)  = 2 (exact)")
assert_eq(ceil_up(15/7), 3, "15/7 = 2.14 → 3 (spec example)")
assert_eq(ceil_up(1),    1, "ceil_up(1) = 1")

# ═══ TRANSPORT — CRITICAL RULE ═══════════════════════════════════
print("\n── TRANSPORT (règle critique) ─────────────")
# Spec: 15 pax, capacité 7 → 3 véhicules, total ÷ 15
tr = calculate_service(
    {"category": "transport", "name": "Bus 7pl.",
     "price_per_vehicle": 800, "vehicle_capacity": 7, "days": 1},
    15,
)
assert_eq(tr.meta["vehicles"], 3,  "15 pax / 7pl. = 3 véhicules")
assert_eq(tr.total_cost,    2400,  "3 × 800 = 2400")
assert_near(tr.cost_per_person, 160, "2400 / 15 = 160/pax")
assert_true("3 véhicules" in tr.calculation_detail, "Détail mentionne 3 véhicules")

# 50 pax en cars 48 places → 2 cars
tr2 = calculate_service(
    {"category": "transport", "price_per_vehicle": 1200, "vehicle_capacity": 48},
    50,
)
assert_eq(tr2.meta["vehicles"], 2, "50 pax / 48pl. = 2 cars")

# 1 pax
tr3 = calculate_service(
    {"category": "transport", "price_per_vehicle": 300, "vehicle_capacity": 7},
    1,
)
assert_eq(tr3.meta["vehicles"], 1, "1 pax = 1 véhicule (toujours ceil up)")

# Transport multi-jours
tr4 = calculate_service(
    {"category": "transport", "price_per_vehicle": 800, "vehicle_capacity": 17,
     "days": 5},
    15,
)
assert_eq(tr4.meta["vehicles"], 1, "15 pax / 17pl. = 1 véhicule")
assert_eq(tr4.total_cost, 4000,     "1 × 800 × 5 jours = 4000")

# ═══ HÔTEL ════════════════════════════════════════════════════════
print("\n── HÔTEL ──────────────────────────────────")
h_single = calculate_service(
    {"category": "hotel", "price_per_room": 500,
     "occupancy": "single", "nights": 3},
    15,
)
assert_eq(h_single.cost_per_person, 1500, "Single 500 × 3 = 1500/pax")

h_double = calculate_service(
    {"category": "hotel", "price_per_room": 500,
     "occupancy": "double", "nights": 3},
    15,
)
assert_eq(h_double.cost_per_person, 750, "Double 500/2 × 3 = 750/pax")

h_triple = calculate_service(
    {"category": "hotel", "price_per_room": 900,
     "occupancy": "triple", "nights": 2},
    10,
)
assert_eq(h_triple.cost_per_person, 600, "Triple 900/3 × 2 = 600/pax")

# ═══ GUIDE ════════════════════════════════════════════════════════
print("\n── GUIDE ──────────────────────────────────")
g = calculate_service(
    {"category": "guide", "daily_cost": 150, "days": 7},
    20,
)
assert_eq(g.total_cost, 1050,         "150 × 7 = 1050")
assert_near(g.cost_per_person, 52.5,  "1050 / 20 = 52.5/pax")

# ═══ ACTIVITÉ ═════════════════════════════════════════════════════
print("\n── ACTIVITÉ ───────────────────────────────")
a_pp = calculate_service(
    {"category": "activity", "price": 45, "pricing_mode": "per_person"},
    15,
)
assert_eq(a_pp.cost_per_person, 45,     "Per-person: direct")
assert_eq(a_pp.total_cost,      45*15,  "Total = 45 × 15")

a_tot = calculate_service(
    {"category": "activity", "price": 450, "pricing_mode": "total"},
    15,
)
assert_eq(a_tot.cost_per_person, 30,  "Total 450 / 15 = 30/pax")
assert_eq(a_tot.total_cost,      450, "Total reste 450")

# ═══ TAXI ═════════════════════════════════════════════════════════
print("\n── TAXI ───────────────────────────────────")
tx1 = calculate_service(
    {"category": "taxi", "taxi_type": "small",
     "price_per_vehicle": 100},
    5,
)
assert_eq(tx1.meta["vehicles"], 2, "5 pax / 3pl. = 2 petits taxis")

tx2 = calculate_service(
    {"category": "taxi", "taxi_type": "large",
     "price_per_vehicle": 200},
    10,
)
assert_eq(tx2.meta["vehicles"], 2, "10 pax / 7pl. = 2 grands taxis")

# ═══ 4×4 ══════════════════════════════════════════════════════════
print("\n── 4×4 ────────────────────────────────────")
fx = calculate_service(
    {"category": "four_by_four", "price_per_vehicle": 600, "days": 2},
    10,
)
assert_eq(fx.meta["vehicles"], 3,     "10 pax / 4 = 3 véhicules 4×4")
assert_eq(fx.total_cost,      3600,   "3 × 600 × 2 jours = 3600")
assert_near(fx.cost_per_person, 360,  "3600 / 10 = 360/pax")

# ═══ RANGE COMPLET ════════════════════════════════════════════════
print("\n── RANGE 15–20 pax (calcul complet) ───────")
services = [
    {"category": "hotel",     "price_per_room": 500, "occupancy": "double", "nights": 3},
    {"category": "transport", "price_per_vehicle": 800, "vehicle_capacity": 7},
    {"category": "guide",     "daily_cost": 150, "days": 3},
    {"category": "activity",  "price": 45, "pricing_mode": "per_person"},
]
r = calculate_range(min_pax=15, max_pax=20, services=services, margin_pct=10)

assert_eq(r.basis, 15, "basis = min (15), PAS max (20)")
# Attendu: hôtel 750 + transport 160 + guide 30 + activité 45 = 985
assert_near(r.cost_per_person, 985, "Somme coûts/pax = 985")
# Total groupe = 985 × 15 (pas × 20)
assert_near(r.cost_total_group, 985*15, "Total groupe basé sur MIN 15 pax")
assert_near(r.selling_per_person, 985*1.10, "Marge 10% → 1083.5")

# ═══ MULTI-RANGE ══════════════════════════════════════════════════
print("\n── QUOTATION MULTI-RANGE ──────────────────")
ranges = [
    {"min": 12, "max": 15},
    {"min": 15, "max": 20},
    {"min": 30, "max": 39},
    {"min": 49, "max": 60},
]
quot = calculate_quotation(ranges, services, margin_pct=15)

assert_eq(len(quot["ranges"]), 4, "4 ranges calculés")
assert_eq(quot["summary"]["range_count"], 4, "summary.range_count = 4")

# Le prix par pax diminue quand le groupe grossit (économies d'échelle)
lowest  = quot["summary"]["lowest_per_person"]
highest = quot["summary"]["highest_per_person"]
assert_true(lowest["selling_per_person"] < highest["selling_per_person"],
            f"Prix min {lowest['selling_per_person']} < max {highest['selling_per_person']}")
assert_true(lowest["basis"] >= 30,
            f"Prix min est sur grand groupe (basis={lowest['basis']})")

# Chaque range utilise son propre min
for r_dict in quot["ranges"]:
    assert_eq(r_dict["basis"], r_dict["range_min"],
              f"Range {r_dict['range_label']} → basis = min")

# ═══ VALIDATION ═══════════════════════════════════════════════════
print("\n── VALIDATION ─────────────────────────────")
try:
    calculate_range(0, 10, services)
    assert_true(False, "Devrait rejeter min=0")
except ValueError:
    assert_true(True, "Rejette min < 1")

try:
    calculate_range(20, 10, services)
    assert_true(False, "Devrait rejeter max < min")
except ValueError:
    assert_true(True, "Rejette max < min")

try:
    calculate_quotation([], services)
    assert_true(False, "Devrait rejeter ranges vides")
except ValueError:
    assert_true(True, "Rejette ranges vide")

print(f"\n{'═'*50}")
print(f"  {passed} passés · {failed} échoués")
print(f"{'═'*50}")
sys.exit(0 if failed == 0 else 1)

"""Seed complet YS Travel Morocco 11D — données fidèles au XLS S'TOURS.

Injecte un circuit modèle avec :
- Project enrichi (guide_rules, water_policy, km_total, bus_rate)
- Itinerary 9 jours avec données XLS complètes (room_type, city_tax, restaurants,
  costs, monuments_detail, luggage_handling)
- Quotation avec FOC + grille PAX scaling 10→35
- QuotationLines décomposées par catégorie
- ItineraryDayMeals (catering pivot)
- QuotationTerms (13 sections T&C S'TOURS)
- Vehicles (7 véhicules fleet S'TOURS)
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.modules.projects.models import Project, ProjectStatus, ProjectType
from app.modules.quotations.models import Quotation, QuotationLine, LineCategory, QuotationStatus
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.cotation_advanced.models import (
    PricingBracket, ItineraryDayMeal, QuotationTerm, Vehicle,
)

# ══════════════════════════════════════════════════════════════════════
# XLS DATA — extraction fidèle du fichier Excel S'TOURS YS Travel 11D
# ══════════════════════════════════════════════════════════════════════

XLS_DAILY = [
    {"day": 1, "date": "01/11/2026", "km": 0,   "cities": "CASABLANCA",
     "hotel": "MÖVENPICK", "category": "5*", "formula": "BB", "room_type": "Standard",
     "halfDbl": 600, "ss": 400, "taxe": 39.6, "water": 40,
     "rest_lunch": None, "rest_lunch_price": 0,
     "rest_dinner": "Rick's Café", "rest_dinner_price": 500,
     "monuments": [], "monu_price": 0, "lg": 0},

    {"day": 2, "date": "02/11/2026", "km": 371, "cities": "CASA → RBA → CHEFCHAOUEN",
     "hotel": "D'ECHAOUEN", "category": "4*", "formula": "HB", "room_type": "Standard",
     "halfDbl": 746, "ss": 350, "taxe": 0, "water": 40,
     "rest_lunch": "M'Sla Riad", "rest_lunch_price": 160,
     "rest_dinner": None, "rest_dinner_price": 0,
     "monuments": [
         {"name": "Hassan II Mosque (interior)", "entry_status": "included", "fee_pax": 130},
         {"name": "Hassan Tower & Mausoleum", "entry_status": "free", "fee_pax": 0},
         {"name": "Oudayas Kasbah", "entry_status": "included", "fee_pax": 20},
     ], "monu_price": 150, "lg": 115},

    {"day": 3, "date": "03/11/2026", "km": 200, "cities": "CHEFCHAOUEN → FÈS",
     "hotel": "PALAIS MEDINA", "category": "5*", "formula": "HB", "room_type": "Deluxe",
     "halfDbl": 750, "ss": 400, "taxe": 39.6, "water": 40,
     "rest_lunch": "Roman City", "rest_lunch_price": 140,
     "rest_dinner": None, "rest_dinner_price": 0,
     "monuments": [
         {"name": "Volubilis UNESCO", "entry_status": "included", "fee_pax": 70},
         {"name": "Bab Mansour Meknes", "entry_status": "photo_stop", "fee_pax": 0},
         {"name": "Moulay Idriss Zerhoun", "entry_status": "exterior_only", "fee_pax": 0},
         {"name": "Chefchaouen Medina Walk", "entry_status": "free", "fee_pax": 0},
     ], "monu_price": 100, "lg": 100},

    {"day": 4, "date": "04/11/2026", "km": 280, "cities": "FÈS → MIDELT",
     "hotel": "TADDART", "category": "3*", "formula": "HB", "room_type": "Standard",
     "halfDbl": 420, "ss": 170, "taxe": 10, "water": 40,
     "rest_lunch": "Chez Nour", "rest_lunch_price": 150,
     "rest_dinner": None, "rest_dinner_price": 0,
     "monuments": [
         {"name": "Bou Inania Madrasah", "entry_status": "included", "fee_pax": 20},
         {"name": "Fes Tanneries", "entry_status": "included", "fee_pax": 0},
         {"name": "Karaouine Mosque", "entry_status": "exterior_only", "fee_pax": 0},
     ], "monu_price": 20, "lg": 100},

    {"day": 5, "date": "05/11/2026", "km": 370, "cities": "MIDELT → MERZOUGA",
     "hotel": "K. TOMBOUCTOU", "category": "4*", "formula": "HB", "room_type": "Standard",
     "halfDbl": 550, "ss": 250, "taxe": 5, "water": 40,
     "rest_lunch": "Local Rest.", "rest_lunch_price": 150,
     "rest_dinner": None, "rest_dinner_price": 0,
     "monuments": [], "monu_price": 0, "lg": 0},

    {"day": 6, "date": "06/11/2026", "km": 350, "cities": "MERZOUGA → OUARZAZATE",
     "hotel": "OSCAR", "category": "4*", "formula": "HB", "room_type": "Standard",
     "halfDbl": 700, "ss": 350, "taxe": 16.5, "water": 40,
     "rest_lunch": "Yasmina", "rest_lunch_price": 110,
     "rest_dinner": None, "rest_dinner_price": 0,
     "monuments": [], "monu_price": 0, "lg": 0},

    {"day": 7, "date": "07/11/2026", "km": 195, "cities": "OUARZAZATE → MARRAKECH",
     "hotel": "ADAM PARK", "category": "5*", "formula": "HB", "room_type": "Deluxe",
     "halfDbl": 680, "ss": 350, "taxe": 28.6, "water": 40,
     "rest_lunch": "Oasis", "rest_lunch_price": 140,
     "rest_dinner": None, "rest_dinner_price": 0,
     "monuments": [
         {"name": "Atlas Film Studios", "entry_status": "included", "fee_pax": 80},
     ], "monu_price": 80, "lg": 0},

    {"day": 8, "date": "08/11/2026", "km": 100, "cities": "RAK / ESS / RAK",
     "hotel": "ADAM PARK", "category": "5*", "formula": "BB", "room_type": "Deluxe",
     "halfDbl": 570, "ss": 350, "taxe": 28.6, "water": 40,
     "rest_lunch": "Zahra", "rest_lunch_price": 300,
     "rest_dinner": "Chez Ali", "rest_dinner_price": 350,
     "monuments": [
         {"name": "Palais Bahia", "entry_status": "included", "fee_pax": 70},
         {"name": "Palais Badi", "entry_status": "included", "fee_pax": 70},
         {"name": "Majorelle Garden", "entry_status": "included", "fee_pax": 130},
     ], "monu_price": 270, "lg": 0},

    {"day": 9, "date": "09/11/2026", "km": 0, "cities": "MARRAKECH — DÉPART",
     "hotel": "DÉPART", "category": None, "formula": None, "room_type": None,
     "halfDbl": 0, "ss": 0, "taxe": 0, "water": 0,
     "rest_lunch": None, "rest_lunch_price": 0,
     "rest_dinner": None, "rest_dinner_price": 0,
     "monuments": [], "monu_price": 0, "lg": 0},
]

# Variable costs (group-level, divided by PAX in grid)
XLS_VARIABLE = {
    "bus": 31500,          # MAD — 48-seater coach (8.5 MAD/km × 3706 km)
    "guide": 9000,         # MAD — national guide × 9 days (1000 MAD/day)
    "taxi_chef": 1200,     # MAD — taxis Chefchaouen (pedestrian medina)
    "merzouga_4x4": 3500,  # MAD — 4x4 Merzouga / Sahara
    "upgrade": 400,        # MAD — vehicle upgrade
}

# Per-pax extras
XLS_EXTRAS_PAX = {
    "tips_lug": 70,
    "tips_rest": 75,
    "water": sum(d["water"] for d in XLS_DAILY),  # 320
    "horse": 100,
    "jeep_4wd": 280,
    "camel": 100,
}

XLS_MARGIN_PCT = 8
XLS_EXCHANGE_RATE = 10.1  # 1 USD = 10.1 MAD
KM_TOTAL = 1866
BUS_RATE_KM = 8.5

# Reference grid from XLS (MAD values)
XLS_GRID_REFERENCE = {
    10: {"cost": 13233, "sell": 14292},
    15: {"cost": 11535, "sell": 12458},
    20: {"cost": 10614, "sell": 11463},
    25: {"cost": 10077, "sell": 10883},
    30: {"cost": 9719,  "sell": 10497},
    35: {"cost": 9494,  "sell": 10253},
}

# ══════════════════════════════════════════════════════════════════════
# ITINERARY NARRATIVES
# ══════════════════════════════════════════════════════════════════════

NARRATIVES = {
    1: "Upon arrival at Mohammed V International Airport, our elegant transfer welcomes you to Morocco's vibrant economic capital. After checking into the refined Mövenpick, embark on a discovery of Casablanca's architectural contrasts — from the imperial grandeur of the Royal Palace to the artisanal charm of the Habbous quarter. As evening falls, step into the timeless atmosphere of Rick's Café, where cinema history meets gastronomic excellence.",
    2: "Begin with a privileged tour of the monumental Hassan II Mosque, an architectural masterpiece rising dramatically from the Atlantic shore. Continue to Rabat, where colonial elegance meets imperial heritage — pause before the Royal Cavalry guarding the Mohammed V Mausoleum. The afternoon unveils the magic of the Rif Mountains as you ascend to Chefchaouen, where the fabled blue medina awaits.",
    3: "Wander through the photogenic blue-washed alleys of Chefchaouen at their most luminous, then descend toward the majestic Roman ruins of Volubilis, a UNESCO treasure framed by golden olive groves. Pass through the imperial city of Meknes to admire the grandeur of Bab Mansour. Your journey culminates in Fès, Morocco's spiritual soul.",
    4: "Immerse yourself in the labyrinthine medina of Fès el-Bali, the world's largest living medieval Islamic city. With a certified local guide, decode the secrets of the Karaouine Mosque, marvel at the intricate zellige of Bou Inania Madrasah, and witness the timeless tanning pits from panoramic terraces. After lunch, ascend the Middle Atlas toward Midelt.",
    5: "Cross the spectacular Ziz Gorges, a ribbon of green cutting through barren red cliffs, before descending to the date-palm oasis of Erfoud. Continue to Merzouga, where the amber dunes of Erg Chebbi herald the beginning of your Sahara encounter. A camel caravan at sunset leads to the luxury camp, under a sky blazing with stars.",
    6: "Dawn breaks over the dunes with an optional sunrise climb. After breakfast at the camp, journey westward through the Draa Valley, passing the fortified villages of Tinjdad and Tinejdad. The road reveals the spectacular Todra Gorges before reaching Ouarzazate, the 'Gateway to the Desert' and Hollywood of Morocco.",
    7: "Visit the legendary Atlas Film Studios before crossing the High Atlas via the Tizi n'Tichka pass (2260m). Stop at the UNESCO-listed Ait Ben Haddou kasbah, then descend into the ochre plains of Marrakech. Evening at leisure to explore the sensory spectacle of Jemaa el-Fna square.",
    8: "A day divided between Marrakech's treasures and the coastal charm of Essaouira. Visit Bahia Palace, Badi Palace, and the iconic Majorelle Garden. Lunch at a traditional restaurant, then experience the legendary Chez Ali dinner show with fantasia horseback display.",
    9: "Last morning at leisure for final souk shopping or a hammam experience. Transfer to Marrakech Menara Airport for your departure flight. Bon voyage!",
}


# ══════════════════════════════════════════════════════════════════════
# T&C TEMPLATES S'TOURS
# ══════════════════════════════════════════════════════════════════════

STOURS_TC = [
    {"section": "validity", "title": "Validity", "sort_order": 1,
     "body": "This quotation is valid for 15 days from the date of issue. Prices are subject to change after this period depending on availability and seasonal adjustments."},
    {"section": "pricing_currency", "title": "Pricing & Currency", "sort_order": 2,
     "body": "All prices are quoted in USD (United States Dollars). Conversion to other currencies will be based on the exchange rate at the time of final payment. Local services are invoiced in MAD (Moroccan Dirhams)."},
    {"section": "payment", "title": "Payment Terms", "sort_order": 3,
     "body": "Payment shall be made by bank transfer to our designated account. A deposit of 20% of the total amount is required upon confirmation. The balance (80%) is due 30 days before the arrival date."},
    {"section": "deposit", "title": "Deposit", "sort_order": 4,
     "body": "A non-refundable deposit of 20% of the total package price is required to confirm the booking. The deposit secures hotel reservations, vehicle allocation, and guide assignments."},
    {"section": "cancellation", "title": "Cancellation Policy", "sort_order": 5,
     "body": "Cancellations must be communicated in writing.\n• More than 60 days before arrival: 20% penalty (deposit forfeited)\n• 59–30 days: 50% penalty\n• 29–15 days: 75% penalty\n• Less than 15 days or no-show: 100% penalty"},
    {"section": "modifications", "title": "Modifications", "sort_order": 6,
     "body": "Modifications to the itinerary, hotel category, or number of participants are subject to availability and may incur additional charges. Requests must be submitted at least 21 days before arrival."},
    {"section": "rooming_list", "title": "Rooming List", "sort_order": 7,
     "body": "The final rooming list with full passenger names (as per passport) must be received at least 21 days before arrival. Late rooming lists may result in room allocation changes."},
    {"section": "force_majeure", "title": "Force Majeure", "sort_order": 8,
     "body": "S'TOURS shall not be held liable for any failure to perform obligations due to force majeure events including but not limited to: natural disasters, pandemics, strikes, civil unrest, government restrictions, or any event beyond reasonable control."},
    {"section": "hotel_substitution", "title": "Hotel Substitution", "sort_order": 9,
     "body": "In the unlikely event that a confirmed hotel is unavailable, S'TOURS reserves the right to substitute with a hotel of equal or superior category in the same city. The client will be notified immediately of any substitution."},
    {"section": "vehicle_disclaimer", "title": "Vehicle & Transportation", "sort_order": 10,
     "body": "All vehicles are air-conditioned, insured, and meet Moroccan tourism standards. Vehicle age does not exceed 5 years. S'TOURS is not responsible for delays caused by road conditions, weather, or traffic. Seat belts are mandatory."},
    {"section": "hotel_services", "title": "Hotel Services", "sort_order": 11,
     "body": "Hotel check-in is from 15:00 and check-out by 12:00 unless otherwise arranged. Early check-in or late check-out is subject to availability and may incur additional charges. Mini-bar, telephone, laundry, and other personal expenses are not included."},
    {"section": "responsibility", "title": "Responsibility & Liability", "sort_order": 12,
     "body": "S'TOURS acts as an intermediary between the client and service providers. While we ensure quality standards, we cannot be held responsible for acts, omissions, or defaults of hotels, restaurants, transport companies, or other third-party suppliers."},
    {"section": "booking_process", "title": "Booking Process", "sort_order": 13,
     "body": "1. Receipt of quotation request\n2. Quotation issued within 24–48h\n3. Client confirmation + deposit payment\n4. Final rooming list (21 days before)\n5. Balance payment (30 days before)\n6. Final program & vouchers sent (7 days before)\n7. Arrival & welcome in Morocco"},
]


def seed():
    db = SessionLocal()

    # ── 1. PROJECT ────────────────────────────────────────────────
    project = Project(
        name="YS Travel Morocco 9D — Circuit Impérial + Sahara",
        reference="20260408-YS-TRAVEL-MAR-11D",
        client_name="SAINT TOUR / YS Travel",
        status=ProjectStatus.VALIDATED,
        project_type=ProjectType.LEISURE,
        destination="Morocco (Casablanca → Chefchaouen → Fès → Merzouga → Ouarzazate → Marrakech)",
        duration_days=9,
        duration_nights=8,
        pax_count=20,
        travel_dates="November 2026",
        language="en",
        currency="MAD",
        competitor_name="Giant Tour",
        km_total=KM_TOTAL,
        bus_rate_per_km=BUS_RATE_KM,
        guide_rules={
            "main_language": "EN",
            "local_guide_threshold_pax": 20,
            "local_guide_cities": ["Fès", "Chefchaouen", "Midelt"],
            "daily_rate": 1000,
            "currency": "MAD",
        },
        water_policy={
            "bottles_per_pax_per_day": 1,
            "cost_per_bottle": 5,
            "currency": "MAD",
        },
        highlights=[
            "Hassan II Mosque interior visit",
            "Blue Pearl of Chefchaouen",
            "Volubilis UNESCO Roman ruins",
            "Fès medieval medina with local guide",
            "Sahara camel caravan & luxury camp",
            "Atlas Film Studios",
            "Ait Ben Haddou UNESCO kasbah",
            "Tizi n'Tichka High Atlas pass",
            "Majorelle Garden & Bahia Palace",
            "Chez Ali fantasia dinner show",
        ],
        inclusions=[
            "Accommodation in hotels as per program (twin sharing)",
            "Breakfast daily",
            "Lunch or dinner as per meal plan (HB days)",
            "Air-conditioned touring vehicle with professional driver",
            "English-speaking national guide throughout",
            "Local guides in Fès, Chefchaouen, Midelt",
            "All monument & museum entrance fees as listed",
            "Camel ride in Merzouga dunes",
            "4x4 desert excursion",
            "Horse carriage ride in Marrakech",
            "Mineral water (1 bottle/pax/day)",
            "Luggage handling at hotels",
            "Tips for porters and restaurant staff",
            "City taxes",
            "1 FOC (tour leader) in twin share",
        ],
        exclusions=[
            "International flights",
            "Travel insurance",
            "Visa fees (if applicable)",
            "Personal expenses (laundry, telephone, minibar)",
            "Drinks with meals (except water)",
            "Tips for guide and driver",
            "Meals not mentioned in the program",
            "Any service not explicitly listed in inclusions",
        ],
    )
    db.add(project)
    db.flush()

    # ── 2. ITINERARY ──────────────────────────────────────────────
    itinerary = Itinerary(project_id=project.id, version=1, language="en")
    db.add(itinerary)
    db.flush()

    day_ids = []
    for d in XLS_DAILY:
        day_obj = ItineraryDay(
            itinerary_id=itinerary.id,
            day_number=d["day"],
            title=f"Day {d['day']} — {d['cities']}",
            city=d["cities"].split("→")[-1].split("—")[0].strip() if "→" in d["cities"] or "—" in d["cities"] else d["cities"],
            hotel=d["hotel"] if d["hotel"] != "DÉPART" else None,
            hotel_category=d["category"],
            meal_plan=d["formula"],
            distance_km=d["km"] if d["km"] > 0 else None,
            description=NARRATIVES.get(d["day"], ""),
            activities=[m["name"] for m in d["monuments"]] if d["monuments"] else None,
            # Travel Designer enrichments
            room_type=d["room_type"],
            city_tax_per_night=d["taxe"] if d["taxe"] > 0 else None,
            water_bottles=1 if d["water"] > 0 else 0,
            local_guide_cost=d["lg"] if d["lg"] > 0 else None,
            restaurant_lunch=d["rest_lunch"],
            restaurant_dinner=d["rest_dinner"],
            lunch_cost_pax=d["rest_lunch_price"] if d["rest_lunch_price"] > 0 else None,
            dinner_cost_pax=d["rest_dinner_price"] if d["rest_dinner_price"] > 0 else None,
            half_dbl_rate=d["halfDbl"] if d["halfDbl"] > 0 else None,
            single_supplement=d["ss"] if d["ss"] > 0 else None,
            monuments_detail=d["monuments"] if d["monuments"] else None,
            luggage_handling=d["lg"] if d["lg"] > 0 else None,
        )
        db.add(day_obj)
        db.flush()
        day_ids.append((d, day_obj.id))

    # ── 2b. CATERING PIVOT (ItineraryDayMeals) ────────────────────
    for d, day_id in day_ids:
        if d["rest_lunch"]:
            db.add(ItineraryDayMeal(
                day_id=day_id, meal_type="lunch",
                city=d["cities"].split("→")[-1].split("—")[0].strip() if "→" in d["cities"] or "—" in d["cities"] else d["cities"],
                restaurant_name=d["rest_lunch"],
                cost_per_pax=d["rest_lunch_price"] if d["rest_lunch_price"] > 0 else None,
                currency="MAD",
            ))
        if d["rest_dinner"]:
            db.add(ItineraryDayMeal(
                day_id=day_id, meal_type="dinner",
                city=d["cities"].split("→")[-1].split("—")[0].strip() if "→" in d["cities"] or "—" in d["cities"] else d["cities"],
                restaurant_name=d["rest_dinner"],
                cost_per_pax=d["rest_dinner_price"] if d["rest_dinner_price"] > 0 else None,
                currency="MAD",
            ))

    # ── 3. QUOTATION ──────────────────────────────────────────────
    hotels_total = sum(d["halfDbl"] for d in XLS_DAILY)
    restaurants_total = sum(d["rest_lunch_price"] + d["rest_dinner_price"] for d in XLS_DAILY)
    monuments_total = sum(d["monu_price"] for d in XLS_DAILY)
    taxes_total = sum(d["taxe"] for d in XLS_DAILY)
    ss_total = sum(d["ss"] for d in XLS_DAILY)

    quotation = Quotation(
        project_id=project.id,
        version=1,
        status=QuotationStatus.CALCULATED,
        currency="MAD",
        margin_pct=XLS_MARGIN_PCT,
        foc_count=1,
        single_supplement=ss_total,
        pricing_grid=[
            {"basis": pax, "foc": 1, "price_pax": ref["sell"], "ss": ss_total}
            for pax, ref in XLS_GRID_REFERENCE.items()
        ],
    )
    db.add(quotation)
    db.flush()

    # ── 3b. QUOTATION LINES ──────────────────────────────────────
    # Hotels
    for d in XLS_DAILY:
        if d["halfDbl"] > 0:
            db.add(QuotationLine(
                quotation_id=quotation.id,
                day_number=d["day"],
                category=LineCategory.HOTEL,
                label=d["hotel"],
                city=d["cities"].split("→")[-1].split("—")[0].strip() if "→" in d["cities"] or "—" in d["cities"] else d["cities"],
                unit_cost=d["halfDbl"],
                quantity=1,
                unit="room/night",
                total_cost=d["halfDbl"],
                meta={"category": d["category"], "meal_plan": d["formula"],
                      "room_type": d["room_type"], "ss": d["ss"]},
            ))

    # Restaurants
    for d in XLS_DAILY:
        if d["rest_lunch_price"] > 0:
            db.add(QuotationLine(
                quotation_id=quotation.id,
                day_number=d["day"],
                category=LineCategory.RESTAURANT,
                label=f"Lunch — {d['rest_lunch']}",
                city=d["cities"].split("→")[-1].split("—")[0].strip() if "→" in d["cities"] or "—" in d["cities"] else d["cities"],
                unit_cost=d["rest_lunch_price"],
                quantity=1,
                unit="pax",
                total_cost=d["rest_lunch_price"],
            ))
        if d["rest_dinner_price"] > 0:
            db.add(QuotationLine(
                quotation_id=quotation.id,
                day_number=d["day"],
                category=LineCategory.RESTAURANT,
                label=f"Dinner — {d['rest_dinner']}",
                city=d["cities"].split("→")[-1].split("—")[0].strip() if "→" in d["cities"] or "—" in d["cities"] else d["cities"],
                unit_cost=d["rest_dinner_price"],
                quantity=1,
                unit="pax",
                total_cost=d["rest_dinner_price"],
            ))

    # Monuments
    for d in XLS_DAILY:
        if d["monu_price"] > 0:
            for m in d["monuments"]:
                if m["fee_pax"] > 0:
                    db.add(QuotationLine(
                        quotation_id=quotation.id,
                        day_number=d["day"],
                        category=LineCategory.MONUMENT,
                        label=m["name"],
                        city=d["cities"].split("→")[-1].split("—")[0].strip() if "→" in d["cities"] or "—" in d["cities"] else d["cities"],
                        unit_cost=m["fee_pax"],
                        quantity=1,
                        unit="pax",
                        total_cost=m["fee_pax"],
                        meta={"entry_status": m["entry_status"]},
                    ))

    # Transport — main bus
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.TRANSPORT,
        label="Autocar 48 places (circuit complet)",
        unit_cost=XLS_VARIABLE["bus"],
        quantity=1,
        unit="circuit",
        total_cost=XLS_VARIABLE["bus"],
        meta={"rate_per_km": BUS_RATE_KM, "km_total": KM_TOTAL, "capacity": 48},
    ))

    # Transport — taxis Chefchaouen
    db.add(QuotationLine(
        quotation_id=quotation.id,
        day_number=2,
        category=LineCategory.TRANSPORT,
        label="Taxis Chefchaouen (médina piétonne)",
        city="Chefchaouen",
        unit_cost=XLS_VARIABLE["taxi_chef"],
        quantity=1,
        unit="group",
        total_cost=XLS_VARIABLE["taxi_chef"],
    ))

    # Transport — 4x4 Merzouga
    db.add(QuotationLine(
        quotation_id=quotation.id,
        day_number=5,
        category=LineCategory.TRANSPORT,
        label="4x4 Merzouga / Sahara",
        city="Merzouga",
        unit_cost=XLS_VARIABLE["merzouga_4x4"],
        quantity=1,
        unit="group",
        total_cost=XLS_VARIABLE["merzouga_4x4"],
        meta={"ratio_pax_per_vehicle": 4},
    ))

    # Guide
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.GUIDE,
        label="Guide national anglophone (9 jours)",
        unit_cost=1000,
        quantity=9,
        unit="day",
        total_cost=XLS_VARIABLE["guide"],
    ))

    # Local guides
    local_guide_total = sum(d["lg"] for d in XLS_DAILY)
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.GUIDE,
        label="Guides locaux (Fès, Chefchaouen, Midelt)",
        unit_cost=local_guide_total,
        quantity=1,
        unit="circuit",
        total_cost=local_guide_total,
    ))

    # Activities (camel, horse carriage, etc.)
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.ACTIVITY,
        label="Camel ride (Merzouga dunes)",
        unit_cost=100, quantity=1, unit="pax", total_cost=100,
    ))
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.ACTIVITY,
        label="Horse carriage (Marrakech)",
        unit_cost=100, quantity=1, unit="pax", total_cost=100,
    ))

    # Misc — city taxes
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.MISC,
        label="City taxes (toutes villes)",
        unit_cost=taxes_total, quantity=1, unit="pax", total_cost=taxes_total,
    ))

    # Misc — water
    water_total = sum(d["water"] for d in XLS_DAILY)
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.MISC,
        label="Mineral water (1 btl/pax/day)",
        unit_cost=water_total, quantity=1, unit="pax", total_cost=water_total,
    ))

    # Misc — tips
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.MISC,
        label="Tips porters & luggage",
        unit_cost=70, quantity=1, unit="pax", total_cost=70,
    ))
    db.add(QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.MISC,
        label="Tips restaurants",
        unit_cost=75, quantity=1, unit="pax", total_cost=75,
    ))

    # ── 4. PRICING BRACKETS ──────────────────────────────────────
    for pax_basis, ref in XLS_GRID_REFERENCE.items():
        db.add(PricingBracket(
            quotation_id=quotation.id,
            pax_basis=pax_basis,
            foc_count=1,
            price_per_pax=ref["sell"],
            single_supplement=ss_total,
            currency="MAD",
            breakdown={
                "hotel": hotels_total,
                "restaurants": restaurants_total,
                "monuments": monuments_total,
                "bus": round(XLS_VARIABLE["bus"] / pax_basis, 2),
                "guide": round(XLS_VARIABLE["guide"] / pax_basis, 2),
                "guide_local": round(local_guide_total, 2),
                "taxi": round(XLS_VARIABLE["taxi_chef"] / pax_basis, 2),
                "4wd": round(XLS_VARIABLE["merzouga_4x4"] / pax_basis, 2),
                "extras": sum(XLS_EXTRAS_PAX.values()),
                "subtotal": ref["cost"],
                "markup_pct": XLS_MARGIN_PCT,
                "markup": ref["sell"] - ref["cost"],
            },
        ))

    # ── 5. TERMS & CONDITIONS ─────────────────────────────────────
    for tc in STOURS_TC:
        db.add(QuotationTerm(
            quotation_id=quotation.id,
            section=tc["section"],
            title=tc["title"],
            body=tc["body"],
            sort_order=tc["sort_order"],
        ))

    # ── 6. VEHICLES — S'TOURS Real Fleet ────────────────────────
    # Based on S'TOURS BDD MEDIA/Transport SharePoint assets
    fleet = [
        # --- Berlines / Cars (Mercedes S-Class fleet with chauffeurs) ---
        {"label": "Mercedes Classe S — VIP", "type": "sedan", "capacity_min": 1, "capacity_max": 3,
         "brand_models": "Mercedes S-Class", "rate_per_km": 14.0, "rate_per_day": 2500,
         "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 3, "seatbelts": True,
                   "leather": True, "chauffeur": True, "color": "black", "fleet_tag": "cars"}},
        {"label": "Mercedes Classe E", "type": "sedan", "capacity_min": 1, "capacity_max": 3,
         "brand_models": "Mercedes E-Class", "rate_per_km": 12.0, "rate_per_day": 1800,
         "specs": {"ac": True, "wifi": False, "restroom": False, "max_age_years": 3, "seatbelts": True,
                   "leather": True, "chauffeur": True, "color": "black", "fleet_tag": "cars"}},
        # --- 4×4 (missing from SharePoint — added per user request) ---
        {"label": "4×4 Toyota Land Cruiser — Sahara", "type": "4wd", "capacity_min": 1, "capacity_max": 4,
         "brand_models": "Toyota Land Cruiser Prado", "rate_per_km": 15.0, "rate_per_day": 1800,
         "specs": {"ac": True, "wifi": False, "restroom": False, "max_age_years": 5, "seatbelts": True,
                   "offroad": True, "desert_ready": True, "fleet_tag": "4x4"}},
        {"label": "4×4 Toyota Hilux — Désert", "type": "4wd", "capacity_min": 1, "capacity_max": 3,
         "brand_models": "Toyota Hilux", "rate_per_km": 13.0, "rate_per_day": 1200,
         "specs": {"ac": True, "wifi": False, "restroom": False, "max_age_years": 5, "seatbelts": True,
                   "offroad": True, "desert_ready": True, "pickup": True, "fleet_tag": "4x4"}},
        {"label": "4×4 Mitsubishi Pajero — Atlas", "type": "4wd", "capacity_min": 1, "capacity_max": 4,
         "brand_models": "Mitsubishi Pajero", "rate_per_km": 14.0, "rate_per_day": 1400,
         "specs": {"ac": True, "wifi": False, "restroom": False, "max_age_years": 5, "seatbelts": True,
                   "offroad": True, "mountain_ready": True, "fleet_tag": "4x4"}},
        {"label": "4×4 Mercedes Classe G — VIP", "type": "4wd", "capacity_min": 1, "capacity_max": 4,
         "brand_models": "Mercedes G-Class", "rate_per_km": 18.0, "rate_per_day": 3500,
         "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 3, "seatbelts": True,
                   "offroad": True, "leather": True, "luxury": True, "fleet_tag": "4x4"}},
        # --- Mercedes Vito (black S'TOURS branding) ---
        {"label": "Mercedes Vito Tourer", "type": "mini-van", "capacity_min": 4, "capacity_max": 8,
         "brand_models": "Mercedes Vito Tourer", "rate_per_km": 10.0, "rate_per_day": 1500,
         "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 4, "seatbelts": True,
                   "color": "black", "fleet_tag": "vito"}},
        # --- MAN TGE Minibus (blue S'TOURS branding, TGE 5.180) ---
        {"label": "MAN TGE 5.180 — Minibus", "type": "minibus", "capacity_min": 8, "capacity_max": 19,
         "brand_models": "MAN TGE 5.180", "rate_per_km": 9.0, "rate_per_day": 2200,
         "specs": {"ac": True, "wifi": True, "restroom": False, "max_age_years": 5, "seatbelts": True,
                   "color": "blue_stours", "fleet_tag": "man_tge"}},
        # --- King Long Coach (blue S'TOURS branding) ---
        {"label": "King Long — Autocar 49 PAX", "type": "coach", "capacity_min": 30, "capacity_max": 49,
         "brand_models": "King Long", "rate_per_km": 8.5, "rate_per_day": 3200,
         "specs": {"ac": True, "wifi": True, "restroom": True, "max_age_years": 5, "seatbelts": True,
                   "color": "blue_stours", "fleet_tag": "king_long"}},
        # --- Irizar i6 Coach (blue S'TOURS, Mercedes chassis) ---
        {"label": "Irizar i6 — Autocar Premium 48 PAX", "type": "coach", "capacity_min": 30, "capacity_max": 48,
         "brand_models": "Irizar i6 (Mercedes chassis)", "rate_per_km": 9.0, "rate_per_day": 3500,
         "specs": {"ac": True, "wifi": True, "restroom": True, "max_age_years": 5, "seatbelts": True,
                   "ratio_pax_per_vehicle": 48, "color": "blue_stours", "fleet_tag": "irizar"}},
        # --- 54 Seat (MAN bus, blue S'TOURS) ---
        {"label": "MAN — Autocar 54 PAX", "type": "coach", "capacity_min": 49, "capacity_max": 54,
         "brand_models": "MAN Lion's Coach", "rate_per_km": 9.5, "rate_per_day": 4000,
         "specs": {"ac": True, "wifi": True, "restroom": True, "max_age_years": 5, "seatbelts": True,
                   "color": "blue_stours", "fleet_tag": "54_seat"}},
    ]

    for v in fleet:
        db.add(Vehicle(
            label=v["label"], type=v["type"],
            capacity_min=v["capacity_min"], capacity_max=v["capacity_max"],
            brand_models=v["brand_models"],
            rate_per_km=v["rate_per_km"], rate_per_day=v["rate_per_day"],
            currency="MAD", specs=v["specs"],
        ))

    db.commit()
    print(f"Seeded YS Travel full circuit: {project.name}")
    print(f"  Project ID: {project.id}")
    print(f"  Quotation ID: {quotation.id}")
    print(f"  Itinerary: {len(XLS_DAILY)} days")
    print(f"  Pricing brackets: {len(XLS_GRID_REFERENCE)}")
    print(f"  T&C sections: {len(STOURS_TC)}")
    print(f"  Fleet vehicles: {len(fleet)}")
    db.close()


if __name__ == "__main__":
    seed()

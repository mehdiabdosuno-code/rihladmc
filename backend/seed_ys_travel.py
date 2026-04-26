import sys
import os
import json
from pathlib import Path

# Add current directory to path so we can import app
sys.path.append(str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.modules.projects.models import Project, ProjectStatus, ProjectType
from app.modules.quotations.models import Quotation, QuotationLine, LineCategory, QuotationStatus
from app.modules.itineraries.models import Itinerary, ItineraryDay

def seed():
    db = SessionLocal()
    
    # Load JSON data
    json_path = Path(__file__).parent.parent / "tools" / "proposal-generator" / "sample_project.json"
    
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    client = data["client"]
    itinerary_data = data["itinerary"]
    hotels_data = data["hotels"]
    activities_data = data["activities"]
    transport_data = data["transport"]
    pricing_data = data["pricing"]

    # 1. Create Project
    project = Project(
        name="Morocco 11D — YS Travel (Premium Leisure)",
        reference=client["reference"],
        client_name=client["client_name"],
        status=ProjectStatus.VALIDATED,
        project_type=ProjectType.LEISURE,
        destination=client["destination"],
        duration_days=11, # Completed to 11 days
        duration_nights=10,
        pax_count=client["pax"],
        travel_dates=client["dates"],
        language=client["language"].lower(),
        currency=client["currency"],
        highlights=data["competitive_positioning"]["stours_advantages"] + [
            "Extended Sahara stay", 
            "Fès spiritual immersion",
            "Signature Hot Air Balloon over Marrakech",
            "Private Cooking Class in a Fès Riad",
            "Luxury Hammam & Spa session"
        ],
        inclusions=data["inclusions"] + [
            "Hot Air Balloon flight over the Atlas mountains",
            "Private culinary workshop with a 'Dada' chef",
            "Signature Spa & Hammam experience",
            "Luxury sunset picnic in the Merzouga dunes"
        ],
        exclusions=data["exclusions"]
    )
    db.add(project)
    db.flush() # Get project ID

    # 2. Create Itinerary
    itinerary = Itinerary(
        project_id=project.id,
        version=1,
        language=client["language"].lower()
    )
    db.add(itinerary)
    db.flush()

    # Augmented Itinerary with 11 Days
    full_itinerary = []
    
    # Days 1-3 from JSON
    full_itinerary.extend(itinerary_data[0:3])
    
    # Day 4: Fès Full Day (NEW)
    full_itinerary.append({
        "day": 4,
        "title": "Fès — The Intellectual & Spiritual Soul",
        "city": "Fès",
        "hotel": "Palais Medina Riad Resort",
        "category": "5*",
        "meal_plan": "BB",
        "activities": ["Mellah (Jewish Quarter)", "Royal Palace Golden Gates", "Fès el-Jdid exploration", "Artisanal workshops", "Free afternoon for leisure"],
        "description": "Dedicate a full day to the profound heritage of Fès. Beyond the medieval labyrinth, explore the Mellah's unique architecture and the bronze gates of the Royal Palace. The afternoon is yours to wander through the 'New' Fès or relax in the lush gardens of your resort, absorbing the timeless atmosphere of the world's most complete medieval city."
    })
    
    # Day 5: Fès -> Midelt (Original Day 4)
    d5 = itinerary_data[3].copy()
    d5["day"] = 5
    full_itinerary.append(d5)
    
    # Day 6: Midelt -> Merzouga (Original Day 5)
    d6 = itinerary_data[4].copy()
    d6["day"] = 6
    full_itinerary.append(d6)
    
    # Day 7: Sahara Discovery (NEW)
    full_itinerary.append({
        "day": 7,
        "title": "Sahara — Desert Discovery & Nomadic Life",
        "city": "Merzouga",
        "hotel": "Kasbah Tombouctou / Luxury Camp",
        "category": "4*",
        "meal_plan": "HB",
        "activities": ["4x4 tour of Erg Chebbi", "Gnaoua music in Khamlia village", "Tea with nomadic families", "Fossil beds exploration", "Stargazing session"],
        "description": "A day of pure leisure and discovery in the golden dunes. Circle the Erg Chebbi by 4x4, listening to the ancestral Gnaoua rhythms in Khamlia and sharing mint tea with nomadic families whose lives are entwined with the desert. As night falls, the Saharan sky unveils a celestial theater, a moment of profound peace under the stars."
    })
    
    # Day 8: Merzouga -> Ouarzazate (Original Day 6)
    d8 = itinerary_data[5].copy()
    d8["day"] = 8
    full_itinerary.append(d8)
    
    # Day 9: Ouarzazate -> Marrakech (Original Day 7)
    d9 = itinerary_data[6].copy()
    d9["day"] = 9
    full_itinerary.append(d9)
    
    # Day 10: Marrakech -> Essaouira (Original Day 8)
    d10 = itinerary_data[7].copy()
    d10["day"] = 10
    full_itinerary.append(d10)
    
    # Day 11: Marrakech Highlights & Departure (Original Day 9)
    d11 = itinerary_data[8].copy()
    d11["day"] = 11
    full_itinerary.append(d11)

    for day in full_itinerary:
        it_day = ItineraryDay(
            itinerary_id=itinerary.id,
            day_number=day["day"],
            title=day["title"],
            city=day["city"],
            hotel=day["hotel"],
            hotel_category=day["category"],
            meal_plan=day["meal_plan"],
            description=day["description"],
            activities=day["activities"]
        )
        db.add(it_day)

    # 3. Create Quotation
    quotation = Quotation(
        project_id=project.id,
        version=1,
        status=QuotationStatus.CALCULATED,
        currency=client["currency"],
        margin_pct=pricing_data["selected_scenario"]["margin_percentage"],
        total_cost=pricing_data["selected_scenario"]["cost_per_person"] * client["pax"],
        total_selling=pricing_data["selected_scenario"]["total_project_price_20pax"],
        price_per_pax=pricing_data["selected_scenario"]["selling_price_per_person"],
        single_supplement=pricing_data["selected_scenario"]["single_supplement"],
        pricing_grid=pricing_data["grid_per_person_twin_sharing"]
    )
    db.add(quotation)
    db.flush()

    # 4. Create Quotation Lines
    # Hotels
    for h in hotels_data:
        line = QuotationLine(
            quotation_id=quotation.id,
            category=LineCategory.HOTEL,
            label=h["name"],
            city=h["city"],
            unit_cost=h["estimated_price_per_night_twin"],
            quantity=h["nights"],
            unit="room",
            total_cost=h["estimated_price_per_night_twin"] * h["nights"],
            meta={"nights": h["nights"], "meal_plan": h["meal_plan"], "category": h["category"]}
        )
        db.add(line)

    # Activities
    for a in activities_data:
        line = QuotationLine(
            quotation_id=quotation.id,
            category=LineCategory.ACTIVITY if a["category"] != "culture" else LineCategory.MONUMENT,
            label=a["name"],
            city=a["city"],
            unit_cost=a["price_per_person"],
            quantity=1,
            unit="pax",
            total_cost=a["price_per_person"],
            meta={"activity_category": a["category"]}
        )
        db.add(line)

    # Transport
    main_v = transport_data["main_vehicle"]
    line = QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.TRANSPORT,
        label=main_v["type"],
        unit_cost=main_v["estimated_cost_per_day"],
        quantity=main_v["days"],
        unit="day",
        total_cost=main_v["total_cost"],
        meta={"model": main_v["model"], "equipment": main_v["equipment"]}
    )
    db.add(line)

    special_v = transport_data["special_transport"]
    line = QuotationLine(
        quotation_id=quotation.id,
        category=LineCategory.TRANSPORT,
        label=special_v["type"],
        unit_cost=special_v["cost_per_vehicle"],
        quantity=special_v["vehicles_needed_for_20pax"],
        unit="group",
        total_cost=special_v["total_cost"]
    )
    db.add(line)

    db.commit()
    print(f"Successfully seeded Model Circuit: {project.name}")
    db.close()

if __name__ == "__main__":
    seed()

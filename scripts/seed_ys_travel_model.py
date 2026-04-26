import sys
import os
import json
from pathlib import Path

# Add backend to path so we can import app
sys.path.append(str(Path(__file__).parent.parent / "backend"))

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
        name="Morocco 11D — YS Travel (Premium Discovery)",
        reference=client["reference"],
        client_name=client["client_name"],
        status=ProjectStatus.VALIDATED,
        project_type=ProjectType.LEISURE,
        destination=client["destination"],
        duration_days=client["duration_days"],
        duration_nights=client["duration_nights"],
        pax_count=client["pax"],
        travel_dates=client["dates"],
        language=client["language"].lower(),
        currency=client["currency"],
        highlights=data["competitive_positioning"]["stours_advantages"],
        inclusions=data["inclusions"],
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

    for day in itinerary_data:
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

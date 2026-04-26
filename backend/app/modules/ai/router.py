"""AI router — FastAPI endpoints for AI operations."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.modules.ai.schemas import AIGenerateRequest, AIGenerateResponse
from app.modules.ai.service import AIService
from app.shared.dependencies import require_auth

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(require_auth)])
_limiter = Limiter(key_func=get_remote_address)

class MagicBriefPayload(BaseModel):
    brief: str

@router.post("/generate", response_model=AIGenerateResponse)
@_limiter.limit("20/minute")
async def generate_content(request: Request, data: AIGenerateRequest, db: Session = Depends(get_db)):
    service = AIService(db)
    try:
        return await service.generate_content(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {str(e)}",
        )

@router.post("/magic-extract")
@_limiter.limit("10/minute")
async def extract_project(request: Request, payload: MagicBriefPayload, db: Session = Depends(get_db)):
    service = AIService(db)
    try:
        return await service.extract_project_from_brief(payload.brief)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI extraction error: {str(e)}",
        )

@router.get("/predictive-pricing/{project_id}")
async def predictive_pricing(
    project_id: str,
    market: str = "FR",
    db: Session = Depends(get_db)
):
    from fastapi.responses import JSONResponse
    service = AIService(db)
    result = await service.suggest_optimal_pricing(project_id, db, market)
    if "error" in result:
        return JSONResponse(status_code=502, content=result)
    return result


# ── AI Travel Designer — Circuit generation from brief ─────────────

class TravelDesignerRequest(BaseModel):
    """Generate a complete circuit from a client brief or parameters."""
    brief: Optional[str] = None
    duration_days: int = 8
    hotel_category: str = "5*"
    meal_plan: str = "HB"
    cities: Optional[list[str]] = None
    circuit_type: str = "leisure"     # leisure | mice | luxury | adventure | fit
    language: str = "fr"
    pax_ranges: Optional[list[dict]] = None   # [{"min":15,"max":20}, ...] for auto-pricing
    margin_pct: float = 18.0


@router.post("/travel-designer", summary="AI Travel Designer — Generate circuit from brief")
@_limiter.limit("10/minute")
async def travel_designer(request: Request, data: TravelDesignerRequest, db: Session = Depends(get_db)):
    """Generate a complete circuit with itinerary, services, and pricing.

    Uses a curated Morocco knowledge base with 12 cities, distance matrix,
    hotel database, and activity catalog. Falls back to template engine
    when no LLM API key is configured.

    Optionally auto-generates pricing for multiple pax ranges.
    """
    from app.modules.ai.travel_designer import generate_circuit
    from app.modules.quotations.pricing_engine import calculate_quotation

    circuit = generate_circuit(
        client_brief=data.brief or "",
        duration_days=data.duration_days,
        hotel_category=data.hotel_category,
        meal_plan=data.meal_plan,
        cities=data.cities,
        circuit_type=data.circuit_type,
        language=data.language,
    )

    result = circuit.to_dict()

    # Auto-pricing if pax_ranges provided
    if data.pax_ranges:
        pricing = calculate_quotation(
            ranges=data.pax_ranges,
            services=circuit.estimated_services,
            margin_pct=data.margin_pct,
            currency="EUR",
        )
        result["pricing"] = pricing

    return {"success": True, "data": result}


@router.get("/travel-designer/cities", summary="List available cities for circuit building")
async def list_cities():
    """Return the list of available cities with their metadata."""
    from app.modules.ai.travel_designer import CITIES
    return {
        "cities": {
            name: {
                "description": data["description"],
                "hotels": list(data["hotels"].keys()),
                "activities_count": len(data["activities"]),
                "has_airport": "airport" in data,
            }
            for name, data in CITIES.items()
        },
        "total": len(CITIES),
    }


@router.get("/travel-designer/circuits", summary="List popular circuit templates")
async def list_circuit_templates():
    """Return popular pre-built circuit templates."""
    from app.modules.ai.travel_designer import POPULAR_CIRCUITS, CITIES

    CIRCUIT_DESCRIPTIONS = {
        "imperial_cities": {
            "name_fr": "Villes Impériales",
            "description": "Les 4 capitales historiques du Maroc",
            "duration_recommended": 7,
            "best_season": "Oct-Mai",
            "highlight": "Architecture, histoire, artisanat",
        },
        "grand_tour": {
            "name_fr": "Grand Tour du Maroc",
            "description": "Le circuit le plus complet — villes, désert, montagnes",
            "duration_recommended": 10,
            "best_season": "Mars-Mai, Sep-Nov",
            "highlight": "Diversité paysages, expérience complète",
        },
        "south_desert": {
            "name_fr": "Sud & Désert",
            "description": "Kasbahs, gorges, dunes et bivouac sous les étoiles",
            "duration_recommended": 6,
            "best_season": "Oct-Avr",
            "highlight": "Aventure, nuit sous les étoiles",
        },
        "north_rif": {
            "name_fr": "Nord & Rif",
            "description": "Tanger, la perle bleue Chefchaouen, et les médinas",
            "duration_recommended": 6,
            "best_season": "Avr-Jun, Sep-Oct",
            "highlight": "Chefchaouen, authenticité",
        },
        "atlantic_coast": {
            "name_fr": "Côte Atlantique",
            "description": "De Rabat à Agadir en passant par Essaouira",
            "duration_recommended": 7,
            "best_season": "Mai-Oct",
            "highlight": "Plages, surf, fruits de mer",
        },
        "full_morocco": {
            "name_fr": "Maroc Complet",
            "description": "Le circuit ultime — tout le Maroc en un voyage",
            "duration_recommended": 14,
            "best_season": "Mars-Mai, Sep-Nov",
            "highlight": "Expérience totale",
        },
    }

    templates = {}
    for name, cities in POPULAR_CIRCUITS.items():
        desc = CIRCUIT_DESCRIPTIONS.get(name, {})
        templates[name] = {
            "cities": cities,
            "total_cities": len(cities),
            **desc,
        }

    return {"templates": templates}


# ── Email Parser — Extract brief from client emails ──────────────────

class EmailParseRequest(BaseModel):
    email_text: str
    auto_generate: bool = False  # If True, also generate circuit


@router.post("/parse-email", summary="Parse client email into structured brief")
async def parse_client_email(request: Request, data: EmailParseRequest, db: Session = Depends(get_db)):
    """Parse a natural language client email and extract travel brief parameters.

    Detects: cities, duration, pax, budget, hotel category, circuit type,
    special requests, dates, and language.

    If auto_generate=True, also generates the circuit and pricing.
    """
    from app.modules.ai.email_parser import parse_email
    from app.modules.ai.travel_designer import generate_circuit
    from app.modules.quotations.pricing_engine import calculate_quotation

    parsed = parse_email(data.email_text)

    result = {"parsed_brief": parsed}

    if data.auto_generate and parsed["confidence"] >= 0.3:
        circuit = generate_circuit(
            client_brief=data.email_text,
            duration_days=parsed["duration_days"] or 8,
            hotel_category=parsed["hotel_category"] or "5*",
            meal_plan=parsed["meal_plan"] or "HB",
            cities=parsed["cities"] if parsed["cities"] else None,
            circuit_type=parsed["circuit_type"],
            language=parsed["language"],
        )

        result["circuit"] = circuit.to_dict()

        # Auto-pricing with detected pax
        pax = parsed.get("pax_count", 20)
        pax_range = parsed.get("pax_range")
        if pax_range:
            ranges = [pax_range]
        else:
            ranges = [{"min": max(1, pax - 5), "max": pax + 5}]

        pricing = calculate_quotation(
            ranges=ranges,
            services=circuit.estimated_services,
            margin_pct=18.0,
            currency="EUR",
        )
        result["pricing"] = pricing

    return {"success": True, "data": result}

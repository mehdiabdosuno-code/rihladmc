"""Itinerary router — with AI day generation."""

from typing import Optional
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.shared.exceptions import NotFoundError
from app.shared.schemas import BaseResponse

from app.shared.dependencies import require_auth

router = APIRouter(prefix="/itineraries", tags=["itineraries"], dependencies=[Depends(require_auth)])


class DayCreate(BaseModel):
    day_number: int
    title: str
    subtitle: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    hotel: Optional[str] = None
    hotel_category: Optional[str] = None
    meal_plan: Optional[str] = None
    travel_time: Optional[str] = None
    distance_km: Optional[int] = None
    activities: Optional[list[str]] = None
    image_url: Optional[str] = None
    image_url_2: Optional[str] = None


class AIGenerateDayRequest(BaseModel):
    prompt: str
    language: str = "fr"
    tone: str = "premium"    # premium | family | adventure | luxury


class ItineraryCreate(BaseModel):
    project_id: str
    language: str = "fr"
    days: list[DayCreate] = []


class DayResponse(BaseResponse):
    itinerary_id: str
    day_number: int
    title: str
    subtitle: Optional[str]
    city: Optional[str]
    description: Optional[str]
    hotel: Optional[str]
    hotel_category: Optional[str]
    meal_plan: Optional[str]
    travel_time: Optional[str]
    distance_km: Optional[int]
    activities: Optional[list]
    image_url: Optional[str]
    image_url_2: Optional[str]
    ai_generated: bool


class ItineraryResponse(BaseResponse):
    project_id: str
    version: int
    language: str
    days: list[DayResponse] = []


@router.post("/", response_model=ItineraryResponse, status_code=201)
def create_itinerary(data: ItineraryCreate, db: Session = Depends(get_db)):
    itin = Itinerary(project_id=data.project_id, language=data.language)
    db.add(itin)
    db.flush()
    for d in data.days:
        day = ItineraryDay(itinerary_id=itin.id, **d.model_dump())
        db.add(day)
    db.commit()
    db.refresh(itin)
    return itin


@router.get("/project/{project_id}", response_model=list[ItineraryResponse])
def list_itineraries(project_id: str, db: Session = Depends(get_db)):
    # Eager-load days to avoid N+1 queries when serializing
    return db.execute(
        select(Itinerary)
        .where(Itinerary.project_id == project_id)
        .options(selectinload(Itinerary.days))
    ).scalars().all()


@router.get("/{itinerary_id}", response_model=ItineraryResponse)
def get_itinerary(itinerary_id: str, db: Session = Depends(get_db)):
    itin = db.execute(
        select(Itinerary)
        .where(Itinerary.id == itinerary_id)
        .options(selectinload(Itinerary.days))
    ).scalars().first()
    if not itin:
        raise NotFoundError(f"Itinerary {itinerary_id} not found")
    return itin


@router.post("/{itinerary_id}/days", response_model=DayResponse, status_code=201)
def add_day(itinerary_id: str, data: DayCreate, db: Session = Depends(get_db)):
    day = ItineraryDay(itinerary_id=itinerary_id, **data.model_dump())
    db.add(day)
    db.commit()
    db.refresh(day)
    return day


@router.put("/{itinerary_id}/days/{day_id}", response_model=DayResponse)
def update_day(itinerary_id: str, day_id: str, data: DayCreate, db: Session = Depends(get_db)):
    day = db.execute(select(ItineraryDay).where(ItineraryDay.id == day_id)).scalars().first()
    if not day:
        raise NotFoundError("Day not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(day, field, value)
    db.commit()
    db.refresh(day)
    return day


@router.post("/{itinerary_id}/days/{day_id}/generate-ai",
             response_model=DayResponse)
async def generate_day_description(
    itinerary_id: str,
    day_id: str,
    req: AIGenerateDayRequest,
    db: Session = Depends(get_db),
):
    """Generate a premium day description using Claude AI."""
    day = db.execute(select(ItineraryDay).where(ItineraryDay.id == day_id)).scalars().first()
    if not day:
        raise NotFoundError("Day not found")

    from app.core.config import settings
    import anthropic

    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY non configurée")

    # Fetch real inventory for this city to provide context to AI
    from app.modules.menus.models import Menu
    from app.modules.hotels.models import Hotel
    
    # Restaurants
    restaurants = []
    if day.city:
        restaurants = db.execute(
            select(Menu).where(Menu.city == day.city, Menu.category == "restaurant")
        ).scalars().all()
    
    # Hotels
    hotels = []
    if day.city:
        hotels = db.execute(
            select(Hotel).where(Hotel.city == day.city)
        ).scalars().all()
    
    restaurant_list = "\n".join([f"- {r.name} ({r.cuisine_type}): {r.description[:80]}..." for r in restaurants[:8]])
    hotel_list = "\n".join([f"- {h.name} ({h.category}): {h.base_rate} MAD" for h in hotels[:8]])
    
    inventory_context = ""
    if restaurants: inventory_context += f"\nRestaurants partenaires à {day.city}:\n{restaurant_list}"
    if hotels:      inventory_context += f"\nHôtels recommandés à {day.city}:\n{hotel_list}"

    # Build context from existing day data
    city_info    = f"Ville: {day.city}" if day.city else ""
    hotel_info   = f"Hébergement: {day.hotel} ({day.hotel_category or ''})" if day.hotel else ""
    meal_info    = f"Régime: {day.meal_plan}" if day.meal_plan else ""
    travel_info  = f"Temps de route: {day.travel_time}" if day.travel_time else ""
    acts_info    = f"Activités: {', '.join(day.activities or [])}" if day.activities else ""

    tone_prompts = {
        "premium":   "Ton: élégant, sophistiqué, vocabulaire haut de gamme. Évoque des expériences uniques.",
        "family":    "Ton: chaleureux, accessible, adapté aux familles. Souligne le côté découverte.",
        "adventure": "Ton: dynamique, enthousiaste, axé sur l'aventure et l'authenticité.",
        "luxury":    "Ton: ultra-premium, exclusif, comme un concierge 5★. Chaque mot doit respirer le luxe.",
    }

    lang_prompt = "Réponds UNIQUEMENT en français." if req.language == "fr" else \
                  "Reply ONLY in English." if req.language == "en" else \
                  "Réponds en français ET en anglais, séparés par '---'."

    system_prompt = f"""Tu es le rédacteur officiel de RIHLA Tourist Platform, expert en tourisme de luxe au Maroc.
Tu génères des descriptions de journées de circuits pour des propositions commerciales haut de gamme.
{inventory_context}
IMPORTANT: Tu DOIS intégrer un des partenaires (Hôtel ou Restaurant) listés ci-dessus de manière naturelle dans le texte.
Ne mentionne pas le prix, mais souligne le prestige du lieu.
{tone_prompts.get(req.tone, tone_prompts['premium'])}
{lang_prompt}
Format de sortie: une description de 120-180 mots, sans titre, sans puces. 
Commence directement par la description. Style: présent de narration touristique."""

    user_prompt = f"""Jour {day.day_number} — {req.prompt}

Informations disponibles:
{city_info}
{hotel_info}
{meal_info}
{travel_info}
{acts_info}

Génère une description commerciale captivante pour ce jour de circuit."""

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=600,
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
    )

    generated_text = response.content[0].text.strip()
    day.description  = generated_text
    day.ai_generated = True
    db.commit()
    db.refresh(day)
    return day


@router.delete("/{itinerary_id}/days/{day_id}", status_code=204)
def delete_day(itinerary_id: str, day_id: str, db: Session = Depends(get_db)):
    day = db.execute(select(ItineraryDay).where(ItineraryDay.id == day_id)).scalars().first()
    if day:
        db.delete(day)
        db.commit()


class DayReorderItem(BaseModel):
    id: str
    day_number: int


@router.patch("/{itinerary_id}/reorder", summary="Bulk update day numbers for reordering")
def reorder_days(itinerary_id: str, data: list[DayReorderItem], db: Session = Depends(get_db)):
    """Update day_number for multiple days in one transaction."""
    # Verify itinerary exists
    itin = db.get(Itinerary, itinerary_id)
    if not itin:
        raise NotFoundError("Itinerary not found")

    # Update each day
    for item in data:
        day = db.get(ItineraryDay, item.id)
        if day and day.itinerary_id == itinerary_id:
            day.day_number = item.day_number

    db.commit()
    return {"message": "Reorder successful"}


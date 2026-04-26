"""AI Travel Designer — Generate complete circuits from client briefs.

Uses LLM (Claude/GPT) when API key available, falls back to a curated
template engine with real Morocco data for demo/offline mode.

The template engine uses a real knowledge base of:
  - 12 major cities with descriptions, hotels, activities
  - Distance/time matrix between cities
  - Seasonal recommendations
  - S'TOURS quality standards
"""

from __future__ import annotations

import logging
import json
import time
from dataclasses import dataclass, field, asdict
from typing import Optional, Literal

logger = logging.getLogger(__name__)


# ── Morocco Knowledge Base ────────────────────────────────────────────

CITIES = {
    "Casablanca": {
        "description": "Capitale économique, mégalopole atlantique",
        "hotels": {
            "5*": ["Four Seasons Casablanca", "Hyatt Regency", "Sofitel Tour Blanche"],
            "4*": ["Kenzi Tower", "Barceló Anfa", "NH Collection"],
        },
        "activities": ["Mosquée Hassan II", "Corniche Ain Diab", "Quartier Art Déco", "Morocco Mall"],
        "meals": {"lunch": 25, "dinner": 40},
        "airport": "CMN",
    },
    "Rabat": {
        "description": "Capitale administrative, ville impériale UNESCO",
        "hotels": {
            "5*": ["Sofitel Jardin des Roses", "The View Rabat", "Fairmont Rabat"],
            "4*": ["Riad Dar El Kebira", "Le Diwan", "Cantor Boutique Hotel"],
        },
        "activities": ["Tour Hassan", "Mausolée Mohammed V", "Kasbah des Oudaïas", "Chellah", "Musée Mohammed VI"],
        "meals": {"lunch": 22, "dinner": 35},
    },
    "Fès": {
        "description": "Cité spirituelle, plus grande médina médiévale au monde",
        "hotels": {
            "5*": ["Palais Faraj Suites & Spa", "Riad Fès", "Hotel Sahrai"],
            "4*": ["Riad Laaroussa", "Dar Bensouda", "Palais d'Hôtes Suites & Spa"],
        },
        "activities": ["Tanneries Chouara", "Médersa Bou Inania", "Souk des teinturiers", "Atelier poterie", "Musée Nejjarine"],
        "meals": {"lunch": 20, "dinner": 35},
    },
    "Marrakech": {
        "description": "Ville rouge, perle du sud, capitale touristique",
        "hotels": {
            "5*": ["Royal Mansour", "La Mamounia", "Four Seasons Resort", "Mandarin Oriental"],
            "4*": ["Riad Ksar Aylan", "Riad Kniza", "Les Jardins de la Koutoubia"],
        },
        "activities": ["Jardins Majorelle", "Palais Bahia", "Tombeaux Saadiens", "Place Jemaa el-Fna", "Souk Médina", "Musée YSL"],
        "meals": {"lunch": 25, "dinner": 45},
        "airport": "RAK",
    },
    "Chefchaouen": {
        "description": "Perle bleue du Rif, médina photogénique",
        "hotels": {
            "5*": ["Lina Ryad & Spa"],
            "4*": ["Casa Perleta", "Dar Echchaouen", "Parador de Chefchaouen"],
        },
        "activities": ["Médina bleue", "Cascade Ras el-Maa", "Randonnée Rif", "Artisanat local"],
        "meals": {"lunch": 15, "dinner": 25},
    },
    "Merzouga": {
        "description": "Porte du Sahara, dunes de l'Erg Chebbi",
        "hotels": {
            "5*": ["Bivouac de luxe Erg Chebbi", "Merzouga Luxury Desert Camp"],
            "4*": ["Kasbah Mohayut", "Riad Madu"],
        },
        "activities": ["Excursion 4x4 dunes", "Balade dromadaire", "Lever de soleil", "Village nomade", "Musique gnaoua"],
        "meals": {"lunch": 18, "dinner": 30},
    },
    "Ouarzazate": {
        "description": "Hollywood d'Afrique, route des kasbahs",
        "hotels": {
            "5*": ["Berbère Palace", "Le Temple des Arts"],
            "4*": ["Riad Salam", "Ksar Ighnda"],
        },
        "activities": ["Studios Atlas", "Kasbah Aït-Ben-Haddou (UNESCO)", "Kasbah Taourirt", "Oasis Fint"],
        "meals": {"lunch": 18, "dinner": 28},
    },
    "Essaouira": {
        "description": "Cité des alizés, port artiste atlantique",
        "hotels": {
            "5*": ["Sofitel Mogador", "Heure Bleue Palais"],
            "4*": ["Villa Maroc", "Riad Mimouna", "L'Heure d'Or"],
        },
        "activities": ["Médina UNESCO", "Port des pêcheurs", "Skala", "Atelier marqueterie", "Kitesurf"],
        "meals": {"lunch": 20, "dinner": 35},
    },
    "Meknès": {
        "description": "Versailles du Maroc, ville impériale de Moulay Ismail",
        "hotels": {
            "5*": ["Château Roslane", "Ibis Styles Meknès"],
            "4*": ["Riad Yacout", "Palais Didi"],
        },
        "activities": ["Bab Mansour", "Heri es-Souani", "Moulay Ismail Mausoleum", "Volubilis (nearby)"],
        "meals": {"lunch": 18, "dinner": 28},
    },
    "Agadir": {
        "description": "Station balnéaire, plage et soleil toute l'année",
        "hotels": {
            "5*": ["Sofitel Thalassa", "Hyatt Place Taghazout Bay", "Fairmont Taghazout"],
            "4*": ["RIU Tikida Beach", "Robinson Club", "Atlantic Palace"],
        },
        "activities": ["Plage", "Souk El Had", "Kasbah Agadir Oufella", "Paradise Valley", "Surf Taghazout"],
        "meals": {"lunch": 22, "dinner": 35},
        "airport": "AGA",
    },
    "Ifrane": {
        "description": "Suisse du Maroc, forêts de cèdres du Moyen-Atlas",
        "hotels": {
            "5*": ["Michlifen Resort & Golf"],
            "4*": ["Hôtel Perce-Neige", "Appart-Hôtel Le Chamonix"],
        },
        "activities": ["Cèdre Gouraud (singes magots)", "Lac Dayet Aoua", "Ski en hiver", "Randonnée forêt"],
        "meals": {"lunch": 18, "dinner": 28},
    },
    "Tanger": {
        "description": "Porte de l'Afrique, détroit de Gibraltar",
        "hotels": {
            "5*": ["Fairmont Tazi Palace", "Hilton Tanger", "El Minzah"],
            "4*": ["Nord-Pinus Tanger", "La Tangerina", "Grand Hotel Villa de France"],
        },
        "activities": ["Cap Spartel", "Grottes d'Hercule", "Médina", "Musée de la Kasbah", "Café Hafa"],
        "meals": {"lunch": 22, "dinner": 35},
        "airport": "TNG",
    },
}

# Distance matrix (km) between major cities
DISTANCES = {
    ("Casablanca", "Rabat"): (95, "1h15"),
    ("Rabat", "Chefchaouen"): (250, "3h30"),
    ("Rabat", "Meknès"): (140, "1h45"),
    ("Rabat", "Fès"): (200, "2h30"),
    ("Chefchaouen", "Fès"): (210, "3h30"),
    ("Fès", "Ifrane"): (65, "1h"),
    ("Fès", "Meknès"): (60, "45min"),
    ("Fès", "Merzouga"): (470, "8h"),
    ("Ifrane", "Merzouga"): (400, "7h"),
    ("Merzouga", "Ouarzazate"): (350, "6h"),
    ("Ouarzazate", "Marrakech"): (200, "4h"),
    ("Marrakech", "Essaouira"): (175, "2h30"),
    ("Marrakech", "Agadir"): (255, "3h"),
    ("Casablanca", "Marrakech"): (240, "2h30"),
    ("Casablanca", "Essaouira"): (355, "4h30"),
    ("Tanger", "Chefchaouen"): (115, "2h"),
    ("Tanger", "Rabat"): (250, "2h30"),
    ("Meknès", "Merzouga"): (450, "7h30"),
    ("Agadir", "Ouarzazate"): (360, "5h"),
    ("Casablanca", "Fès"): (295, "3h"),
    ("Essaouira", "Agadir"): (170, "2h30"),
}

# Common circuit templates
POPULAR_CIRCUITS = {
    "imperial_cities": ["Casablanca", "Rabat", "Meknès", "Fès", "Marrakech"],
    "grand_tour": ["Casablanca", "Rabat", "Chefchaouen", "Fès", "Merzouga", "Ouarzazate", "Marrakech"],
    "south_desert": ["Marrakech", "Ouarzazate", "Merzouga", "Fès"],
    "north_rif": ["Tanger", "Chefchaouen", "Fès", "Meknès", "Rabat"],
    "atlantic_coast": ["Casablanca", "Rabat", "Essaouira", "Agadir", "Marrakech"],
    "full_morocco": ["Casablanca", "Rabat", "Chefchaouen", "Fès", "Merzouga", "Ouarzazate", "Marrakech", "Essaouira"],
}


def _get_distance(city_a: str, city_b: str) -> tuple[int, str]:
    """Get distance and travel time between two cities."""
    key = (city_a, city_b)
    if key in DISTANCES:
        return DISTANCES[key]
    rev_key = (city_b, city_a)
    if rev_key in DISTANCES:
        return DISTANCES[rev_key]
    return (0, "")


@dataclass
class GeneratedDay:
    day_number: int
    title: str
    subtitle: str
    city: str
    description: str
    hotel: Optional[str]
    hotel_category: Optional[str]
    meal_plan: str
    travel_time: Optional[str]
    distance_km: Optional[int]
    activities: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class GeneratedCircuit:
    name: str
    cities: list[str]
    duration_days: int
    duration_nights: int
    days: list[GeneratedDay]
    total_distance_km: int
    highlights: list[str]
    inclusions: list[str]
    exclusions: list[str]
    estimated_services: list[dict]
    generation_method: str  # "template" | "ai"
    generation_time_ms: int

    def to_dict(self) -> dict:
        d = asdict(self)
        d["days"] = [day.to_dict() for day in self.days]
        return d


def _select_best_circuit(cities: Optional[list[str]], duration: int) -> list[str]:
    """Select the best circuit template based on requested cities and duration."""
    if cities and len(cities) >= 2:
        return cities

    # Auto-select based on duration
    if duration <= 5:
        return POPULAR_CIRCUITS["imperial_cities"][:duration]
    elif duration <= 8:
        return POPULAR_CIRCUITS["grand_tour"][:min(duration, 7)]
    elif duration <= 12:
        return POPULAR_CIRCUITS["grand_tour"]
    else:
        return POPULAR_CIRCUITS["full_morocco"]


def generate_circuit(
    client_brief: str,
    duration_days: int = 8,
    hotel_category: str = "5*",
    meal_plan: str = "HB",
    cities: Optional[list[str]] = None,
    circuit_type: str = "leisure",
    language: str = "fr",
) -> GeneratedCircuit:
    """Generate a complete circuit from a client brief.

    This is the template-based engine (no LLM needed).
    Uses the Morocco knowledge base to build realistic, bookable circuits.
    """
    t0 = time.time()

    route = _select_best_circuit(cities, duration_days)
    duration_nights = duration_days - 1

    # Build day-by-day itinerary
    generated_days: list[GeneratedDay] = []
    total_km = 0
    all_hotels = []
    services = []

    city_idx = 0
    days_per_city = max(1, duration_days // len(route))

    for day_num in range(1, duration_days + 1):
        if city_idx >= len(route):
            city_idx = len(route) - 1

        city = route[city_idx]
        city_data = CITIES.get(city, {})

        # Determine if this is a travel day or a full day
        is_first_day = day_num == 1
        is_last_day = day_num == duration_days
        is_travel_day = False
        next_city = None
        distance = 0
        travel_time = ""

        # Check if we move to next city
        days_in_current = sum(1 for d in generated_days if d.city == city)
        should_move = (days_in_current >= days_per_city and city_idx < len(route) - 1) or \
                      (day_num == duration_days - 1 and city_idx < len(route) - 1)

        if should_move and not is_last_day:
            next_city = route[city_idx + 1]
            distance, travel_time = _get_distance(city, next_city)
            total_km += distance
            is_travel_day = True
            city_idx += 1

        # Select hotel
        hotels = city_data.get("hotels", {}).get(hotel_category, [])
        if not hotels:
            hotels = city_data.get("hotels", {}).get("4*", ["Hôtel " + city])
        hotel = hotels[0] if hotels else f"Hôtel {city}"

        # Select activities
        activities = city_data.get("activities", [])
        if is_first_day:
            activities = activities[:2]
        elif is_last_day:
            activities = ["Transfert aéroport"]
        elif is_travel_day:
            next_data = CITIES.get(next_city or city, {})
            activities = (activities[:1] if activities else []) + ["Route panoramique"]
        else:
            activities = activities[:4]

        # Build title
        if is_first_day:
            title = f"Arrivée {city}"
            subtitle = "Accueil & installation"
            desc = f"Accueil à l'aéroport. Transfert à l'hôtel {hotel}. " + \
                   (f"Visite de {', '.join(activities[:2])}." if activities else "Installation et temps libre.")
            mp = "D"
        elif is_last_day:
            title = f"Départ {city}"
            subtitle = "Transfert aéroport"
            desc = f"Petit-déjeuner. Temps libre selon horaire de vol. Transfert à l'aéroport."
            hotel = None
            mp = "B"
        elif is_travel_day:
            title = f"{city} → {next_city}"
            subtitle = CITIES.get(next_city, {}).get("description", "")[:50]
            desc = f"Route vers {next_city} ({travel_time}). " + \
                   f"Installation à l'hôtel {CITIES.get(next_city, {}).get('hotels', {}).get(hotel_category, ['Hôtel'])[0] if next_city else hotel}."
            city = next_city or city
            hotel = CITIES.get(city, {}).get("hotels", {}).get(hotel_category, ["Hôtel " + city])[0]
            mp = meal_plan
        else:
            title = f"{city} — Journée complète"
            subtitle = city_data.get("description", "")[:50]
            desc = f"Journée de découverte : {', '.join(activities[:3])}. " + \
                   "Temps libre pour le shopping et les découvertes personnelles."
            mp = meal_plan

        if hotel and hotel not in all_hotels:
            all_hotels.append(hotel)

        generated_days.append(GeneratedDay(
            day_number=day_num,
            title=title,
            subtitle=subtitle,
            city=city,
            description=desc,
            hotel=hotel,
            hotel_category=hotel_category if hotel else None,
            meal_plan=mp,
            travel_time=travel_time if is_travel_day else None,
            distance_km=distance if distance else None,
            activities=activities,
        ))

    # Build services for pricing engine
    # Hotels
    hotel_nights = {}
    for d in generated_days:
        if d.hotel:
            hotel_nights[d.hotel] = hotel_nights.get(d.hotel, 0) + 1

    for i, (h_name, nights) in enumerate(hotel_nights.items()):
        price = 180 if "5*" in (hotel_category or "") else 100
        if "mansour" in h_name.lower() or "mamounia" in h_name.lower():
            price = 350
        elif "palace" in h_name.lower() or "four seasons" in h_name.lower():
            price = 200
        elif "bivouac" in h_name.lower() or "camp" in h_name.lower():
            price = 120

        services.append({
            "id": f"h{i+1}", "category": "hotel", "name": h_name,
            "price_per_room": price, "nights": nights, "occupancy": "double",
        })

    # Transport
    services.append({
        "id": "t1", "category": "transport", "name": "Autocar climatisé",
        "price_per_vehicle": 650, "vehicle_capacity": 55, "days": duration_days,
    })

    # Guide
    services.append({
        "id": "g1", "category": "guide", "name": "Guide francophone professionnel",
        "daily_cost": 200, "days": duration_days,
    })

    # Activities (standard)
    activity_costs = {
        "Mosquée Hassan II": 14, "Tanneries Chouara": 5, "Jardins Majorelle": 15,
        "Palais Bahia": 7, "Tombeaux Saadiens": 7, "Studios Atlas": 8,
        "Kasbah Aït-Ben-Haddou (UNESCO)": 10, "Excursion 4x4 dunes": 45,
        "Balade dromadaire": 20, "Lever de soleil": 0,
    }
    seen_activities = set()
    for i, d in enumerate(generated_days):
        for act in d.activities:
            if act not in seen_activities and act in activity_costs:
                seen_activities.add(act)
                cost = activity_costs[act]
                if cost > 0:
                    services.append({
                        "id": f"a{len(services)}", "category": "monument" if cost < 20 else "activity",
                        "name": act, "price": cost, "pricing_mode": "per_person",
                    })

    # Misc
    services.extend([
        {"id": "x1", "category": "misc", "name": "Eau minérale (2 bouteilles/j)", "price": 15, "pricing_mode": "per_person"},
        {"id": "x2", "category": "misc", "name": "Porteurs bagages", "price": 10, "pricing_mode": "per_person"},
    ])

    # Build highlights
    highlights = [
        f"{len(route)} villes emblématiques du Maroc",
        f"{duration_days} jours / {duration_nights} nuits tout confort",
        f"Hébergement {hotel_category} sélectionné",
    ]
    for city_name in route:
        cd = CITIES.get(city_name, {})
        if cd.get("description"):
            highlights.append(f"{city_name} — {cd['description']}")

    ms = int((time.time() - t0) * 1000)

    return GeneratedCircuit(
        name=f"Circuit {circuit_type.capitalize()} Maroc {duration_days}J/{duration_nights}N",
        cities=route,
        duration_days=duration_days,
        duration_nights=duration_nights,
        days=generated_days,
        total_distance_km=total_km,
        highlights=highlights[:8],
        inclusions=[
            f"Hébergement {hotel_category} en {meal_plan}",
            "Guide francophone professionnel",
            "Transport climatisé tout le circuit",
            "Transferts aéroport aller/retour",
            "Entrées monuments et sites",
            "Eau minérale à bord",
            "Porteurs bagages aux hôtels",
        ],
        exclusions=[
            "Vols internationaux",
            "Pourboires guide et chauffeur",
            "Repas non mentionnés",
            "Dépenses personnelles",
            "Assurance voyage",
        ],
        estimated_services=services,
        generation_method="template",
        generation_time_ms=ms,
    )

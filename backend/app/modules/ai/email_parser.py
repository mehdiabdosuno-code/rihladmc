"""Email Parser — Extract circuit brief from client emails.

Parses natural language client emails to extract:
  - Destination preferences (cities)
  - Travel dates and duration
  - Group size (pax)
  - Budget range
  - Hotel category preference
  - Circuit type (MICE/leisure/incentive)
  - Special requirements (dietary, mobility, activities)

Returns a structured TravelDesignerRequest-compatible dict.
"""

import re
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


# ── City detection keywords ──────────────────────────────────────────

CITY_KEYWORDS = {
    "casablanca": "Casablanca", "casa": "Casablanca",
    "rabat": "Rabat",
    "fès": "Fès", "fes": "Fès", "fez": "Fès",
    "marrakech": "Marrakech", "marrakesh": "Marrakech",
    "chefchaouen": "Chefchaouen", "chaouen": "Chefchaouen",
    "merzouga": "Merzouga", "désert": "Merzouga", "desert": "Merzouga", "sahara": "Merzouga",
    "ouarzazate": "Ouarzazate",
    "essaouira": "Essaouira", "mogador": "Essaouira",
    "meknès": "Meknès", "meknes": "Meknès",
    "agadir": "Agadir",
    "ifrane": "Ifrane",
    "tanger": "Tanger", "tangier": "Tanger",
}

# ── Type detection ───────────────────────────────────────────────────

TYPE_KEYWORDS = {
    "mice": ["mice", "conférence", "conference", "séminaire", "seminaire",
             "réunion", "reunion", "team building", "team-building",
             "congrès", "congres", "convention"],
    "incentive": ["incentive", "motivation", "récompense", "reward",
                  "teambuilding", "incentivé"],
    "luxury": ["luxe", "luxury", "premium", "vip", "prestige",
               "5 étoiles", "5*", "palace", "haut de gamme"],
    "leisure": ["loisir", "leisure", "vacances", "holidays", "tourisme",
                "découverte", "culture", "culturel"],
    "fit": ["individuel", "fit", "sur mesure", "privé", "private"],
}

# ── Hotel category ───────────────────────────────────────────────────

HOTEL_KEYWORDS = {
    "5*": ["5*", "5 étoiles", "5 etoiles", "palace", "luxe", "luxury", "premium"],
    "4*": ["4*", "4 étoiles", "4 etoiles", "confort", "supérieur", "superieur"],
    "3*": ["3*", "3 étoiles", "3 etoiles", "standard", "économique"],
}

# ── Meal plan detection ──────────────────────────────────────────────

MEAL_KEYWORDS = {
    "FB": ["pension complète", "full board", "tout compris", "fb"],
    "HB": ["demi-pension", "half board", "demi pension", "hb"],
    "BB": ["petit-déjeuner", "bed and breakfast", "bb", "petit déjeuner"],
}


def parse_email(email_text: str) -> dict:
    """Parse a client email and extract a structured travel brief.

    Returns a dict compatible with TravelDesignerRequest fields.
    """
    text = email_text.lower().strip()

    result = {
        "parsed": True,
        "brief": email_text.strip(),
        "cities": [],
        "duration_days": None,
        "pax_count": None,
        "budget_range": None,
        "hotel_category": None,
        "meal_plan": None,
        "circuit_type": "leisure",
        "special_requests": [],
        "detected_dates": None,
        "language": "fr",
        "confidence": 0.0,
    }

    confidence_points = 0

    # ── Detect cities ────────────────────────────────────────────────
    found_cities = set()
    for keyword, city in CITY_KEYWORDS.items():
        if keyword in text:
            found_cities.add(city)

    # Also check for "villes impériales" pattern
    if any(w in text for w in ["villes impériales", "imperial cities", "villes imperiales"]):
        found_cities.update(["Casablanca", "Rabat", "Meknès", "Fès", "Marrakech"])

    if any(w in text for w in ["grand tour", "tour du maroc", "tout le maroc"]):
        found_cities.update(["Casablanca", "Rabat", "Chefchaouen", "Fès",
                             "Merzouga", "Ouarzazate", "Marrakech"])

    if found_cities:
        result["cities"] = sorted(found_cities)
        confidence_points += 2

    # ── Detect duration ──────────────────────────────────────────────
    duration_patterns = [
        r"(\d+)\s*jours?\s*/?\s*(\d+)?\s*nuits?",
        r"(\d+)\s*j\s*/?\s*(\d+)?\s*n",
        r"(\d+)\s*days?\s*/?\s*(\d+)?\s*nights?",
        r"durée\s*(?:de\s*)?\s*(\d+)\s*(?:jours?|j)",
        r"duration\s*(?:of\s*)?\s*(\d+)\s*(?:days?|d)",
        r"séjour\s*(?:de\s*)?\s*(\d+)\s*(?:jours?|j)",
    ]
    for pattern in duration_patterns:
        m = re.search(pattern, text)
        if m:
            result["duration_days"] = int(m.group(1))
            confidence_points += 2
            break

    # ── Detect pax count ─────────────────────────────────────────────
    pax_patterns = [
        r"(\d+)\s*(?:personnes?|pax|participants?|voyageurs?|persons?|people|guests?)",
        r"groupe\s*(?:de\s*)?\s*(\d+)",
        r"group\s*(?:of\s*)?\s*(\d+)",
        r"(\d+)\s*(?:à|a|to|-)\s*(\d+)\s*(?:pax|personnes?|participants?)",
    ]
    for pattern in pax_patterns:
        m = re.search(pattern, text)
        if m:
            if m.lastindex >= 2:
                # Range: take midpoint
                lo, hi = int(m.group(1)), int(m.group(2))
                result["pax_count"] = (lo + hi) // 2
                result["pax_range"] = {"min": lo, "max": hi}
            else:
                result["pax_count"] = int(m.group(1))
            confidence_points += 2
            break

    # ── Detect budget ────────────────────────────────────────────────
    budget_patterns = [
        r"budget\s*(?:de|:)?\s*(\d[\d\s]*)\s*(?:€|euros?|eur)\s*(?:à|a|-|to)\s*(\d[\d\s]*)\s*(?:€|euros?|eur)?",
        r"(\d[\d\s]*)\s*(?:€|euros?|eur)\s*(?:à|a|-|to)\s*(\d[\d\s]*)\s*(?:€|euros?|eur)",
        r"budget\s*(?:de|:)?\s*(\d[\d\s]*)\s*(?:€|euros?|eur|par\s*personne|/pax)",
        r"(\d{3,5})\s*(?:€|euros?)\s*(?:/|par)\s*(?:personne|pax)",
    ]
    for pattern in budget_patterns:
        m = re.search(pattern, text)
        if m:
            if m.lastindex >= 2:
                lo = int(m.group(1).replace(" ", ""))
                hi = int(m.group(2).replace(" ", ""))
                result["budget_range"] = {"min": lo, "max": hi, "currency": "EUR"}
            else:
                val = int(m.group(1).replace(" ", ""))
                result["budget_range"] = {"estimated": val, "currency": "EUR"}
            confidence_points += 1
            break

    # ── Detect circuit type ──────────────────────────────────────────
    for ctype, keywords in TYPE_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            result["circuit_type"] = ctype
            confidence_points += 1
            break

    # ── Detect hotel category ────────────────────────────────────────
    for cat, keywords in HOTEL_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            result["hotel_category"] = cat
            confidence_points += 1
            break

    # ── Detect meal plan ─────────────────────────────────────────────
    for plan, keywords in MEAL_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            result["meal_plan"] = plan
            confidence_points += 1
            break

    # ── Detect dates ─────────────────────────────────────────────────
    date_patterns = [
        r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})",
        r"(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})?",
        r"(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})?",
    ]
    for pattern in date_patterns:
        m = re.search(pattern, text)
        if m:
            result["detected_dates"] = m.group(0)
            confidence_points += 1
            break

    # ── Detect special requests ──────────────────────────────────────
    special_keywords = {
        "végétarien": "Régime végétarien",
        "vegetarien": "Régime végétarien",
        "vegan": "Régime végan",
        "halal": "Repas halal",
        "accessible": "Accessibilité PMR",
        "pmr": "Accessibilité PMR",
        "handicap": "Accessibilité PMR",
        "anniversaire": "Anniversaire à célébrer",
        "spa": "Spa / bien-être souhaité",
        "golf": "Golf",
        "trekking": "Randonnée / trekking",
        "trek": "Randonnée / trekking",
        "4x4": "Excursion 4x4",
        "quad": "Excursion quad",
        "dromadaire": "Balade en dromadaire",
        "chameau": "Balade en dromadaire",
        "cooking": "Atelier cuisine marocaine",
        "cuisine": "Atelier cuisine marocaine",
        "wine": "Dégustation vin",
    }
    for kw, label in special_keywords.items():
        if kw in text:
            result["special_requests"].append(label)

    # ── Language detection ───────────────────────────────────────────
    english_words = ["dear", "hello", "we are looking", "please", "would like",
                     "group of", "interested in", "trip to morocco"]
    if any(w in text for w in english_words):
        result["language"] = "en"

    # ── Confidence score ─────────────────────────────────────────────
    max_points = 10
    result["confidence"] = round(min(confidence_points / max_points, 1.0), 2)

    # ── Defaults ─────────────────────────────────────────────────────
    if not result["duration_days"]:
        result["duration_days"] = 8  # Default 8J/7N
    if not result["hotel_category"]:
        result["hotel_category"] = "4*" if result["circuit_type"] == "leisure" else "5*"
    if not result["meal_plan"]:
        result["meal_plan"] = "HB"

    return result

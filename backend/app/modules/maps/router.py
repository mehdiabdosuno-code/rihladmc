"""Interactive Map Generator — Leaflet-based circuit visualization.

Endpoints:
  GET  /maps/circuit/{project_id}  → Full HTML page with interactive Leaflet map
  POST /maps/preview               → Map from raw city list (no project needed)
  GET  /maps/geocode               → City coordinates lookup
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.projects.models import Project
from app.shared.dependencies import require_auth

router = APIRouter(prefix="/maps", tags=["maps"])


# ── Morocco city coordinates ─────────────────────────────────────────

CITY_COORDS = {
    "Casablanca":   (33.5731, -7.5898),
    "Rabat":        (34.0209, -6.8416),
    "Fès":          (34.0331, -5.0003),
    "Fez":          (34.0331, -5.0003),
    "Marrakech":    (31.6295, -7.9811),
    "Chefchaouen":  (35.1688, -5.2636),
    "Merzouga":     (31.0801, -4.0134),
    "Ouarzazate":   (30.9189, -6.8936),
    "Essaouira":    (31.5085, -9.7595),
    "Agadir":       (30.4278, -9.5981),
    "Tanger":       (35.7595, -5.8340),
    "Tangier":      (35.7595, -5.8340),
    "Meknès":       (33.8935, -5.5473),
    "Meknes":       (33.8935, -5.5473),
    "Ifrane":       (33.5228, -5.1107),
    "Errachidia":   (31.9314, -4.4288),
    "Tinghir":      (31.5145, -5.5327),
    "Todgha":       (31.5883, -5.5953),
    "Beni Mellal":  (32.3373, -6.3498),
    "Aït-Ben-Haddou": (31.0470, -7.1319),
    "Dakhla":       (23.6848, -15.9580),
    "Taroudant":    (30.4727, -8.8748),
    "Tetouan":      (35.5785, -5.3684),
    "Al Hoceima":   (35.2517, -3.9372),
    "Midelt":       (32.6808, -4.7449),
}

# Map styling
MARKER_COLORS = {
    0: "#1B2A4A",     # First city (arrival) — navy
    -1: "#C5943A",    # Last city (departure) — gold
    "default": "#E53E3E",  # Regular stops — red
}


def _get_coords(city: str) -> Optional[tuple[float, float]]:
    """Lookup coordinates for a city name (fuzzy match)."""
    if city in CITY_COORDS:
        return CITY_COORDS[city]
    # Fuzzy match
    city_lower = city.lower().strip()
    for name, coords in CITY_COORDS.items():
        if name.lower() in city_lower or city_lower in name.lower():
            return coords
    return None


# ── HTML Map Template ─────────────────────────────────────────────────

MAP_HTML = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ title }} — Carte interactive</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #F7F8FA; }
  #map { width: 100%; height: 100vh; }

  .map-header {
    position: absolute; top: 12px; left: 60px; z-index: 1000;
    background: rgba(255, 255, 255, 0.95); color: #1B2A4A;
    padding: 14px 22px; border-radius: 12px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    max-width: 400px;
    border: 1px solid #E2E8F0;
  }
  .map-header h2 { font-size: 16px; font-weight: 700; color: #1B2A4A; margin-bottom: 4px; }
  .map-header p { font-size: 12px; color: #718096; }

  .legend {
    position: absolute; bottom: 30px; right: 12px; z-index: 1000;
    background: rgba(255, 255, 255, 0.95); color: #2D3748;
    padding: 14px 18px; border-radius: 10px;
    font-size: 12px; line-height: 1.8;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    border: 1px solid #E2E8F0;
  }
  .legend-item { display: flex; align-items: center; gap: 8px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #CBD5E0; }

  .day-popup h3 { font-size: 14px; color: #1B2A4A; margin-bottom: 4px; }
  .day-popup .city { color: #C5943A; font-weight: 600; font-size: 13px; }
  .day-popup .desc { font-size: 12px; color: #4A5568; margin: 6px 0; line-height: 1.4; }
  .day-popup .meta { font-size: 11px; color: #718096; }
  .day-popup .hotel { color: #2D3748; font-weight: 500; }
</style>
</head>
<body>

<div id="map"></div>

<div class="map-header">
  <h2>{{ title }}</h2>
  <p>{{ subtitle }}</p>
</div>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:#2B6CB0;"></div> Arrivée</div>
  <div class="legend-item"><div class="legend-dot" style="background:#E53E3E;"></div> Étape</div>
  <div class="legend-item"><div class="legend-dot" style="background:#C5943A;"></div> Départ</div>
  <div class="legend-item" style="margin-top:6px;">
    <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#1B2A4A" stroke-width="3" stroke-dasharray="5,3"/></svg>
    Itinéraire
  </div>
  <div id="total-km" style="margin-top:8px; font-weight:600; color:#1B2A4A;">{{ total_km }} km total</div>
</div>

<script>
const stops = {{ stops_json }};
const route = {{ route_json }};

// Initialize map centered on Morocco
const map = L.map('map', {
  zoomControl: true,
  scrollWheelZoom: true,
}).setView([32.5, -6.5], 6);

// Light tile layer — Voyager (colorful, clean, labels)
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

// ── Real road routing via OSRM ──────────────────────────────────
// Fetches actual driving routes between consecutive city pairs
// Falls back to straight lines if OSRM is unreachable

const routeLayer = L.layerGroup().addTo(map);
let totalRealKm = 0;

async function fetchRoadRoute(from, to) {
  // OSRM expects [lng, lat] — Leaflet uses [lat, lng]
  const url = `https://router.project-osrm.org/route/v1/driving/`
    + `${from[1]},${from[0]};${to[1]},${to[0]}`
    + `?overview=full&geometries=geojson`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      const distKm = Math.round(data.routes[0].distance / 1000);
      return { coords, distKm };
    }
  } catch (e) {
    console.warn('OSRM fetch failed, using straight line:', e);
  }
  return null;
}

async function drawRealRoute() {
  if (route.length < 2) return;

  const allCoords = [];
  let usedOSRM = false;

  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    const result = await fetchRoadRoute(from, to);

    if (result) {
      // Draw this segment with real road geometry
      L.polyline(result.coords, {
        color: '#1B2A4A',
        weight: 4,
        opacity: 0.75,
        smoothFactor: 1,
      }).addTo(routeLayer);
      allCoords.push(...result.coords);
      totalRealKm += result.distKm;
      usedOSRM = true;
    } else {
      // Fallback: straight line
      L.polyline([from, to], {
        color: '#1B2A4A',
        weight: 3,
        opacity: 0.5,
        dashArray: '10, 8',
      }).addTo(routeLayer);
      allCoords.push(from, to);
    }
  }

  // Update distance in legend
  if (totalRealKm > 0) {
    const kmEl = document.getElementById('total-km');
    if (kmEl) kmEl.textContent = totalRealKm + ' km total';
  }

  // Fit bounds to actual road path
  if (allCoords.length > 0) {
    map.fitBounds(allCoords, { padding: [60, 60] });
  }
}

drawRealRoute();

// ── Fallback: if no route points, fit to markers ────────────────
if (route.length <= 1 && route.length > 0) {
  map.fitBounds(route, { padding: [60, 60] });
}

// Add markers (on top of route)
stops.forEach((stop, i) => {
  const isFirst = i === 0;
  const isLast = i === stops.length - 1;
  const color = isFirst ? '#2B6CB0' : isLast ? '#C5943A' : '#E53E3E';
  const size = isFirst || isLast ? 14 : 10;

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:${size*2}px; height:${size*2}px; border-radius:50%;
      background:${color}; border:3px solid white;
      display:flex; align-items:center; justify-content:center;
      color:white; font-weight:700; font-size:${size-2}px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      font-family: system-ui;
    ">${stop.day}</div>`,
    iconSize: [size*2, size*2],
    iconAnchor: [size, size],
  });

  const marker = L.marker(stop.latlng, { icon, zIndexOffset: 1000 }).addTo(map);

  // Popup with day details
  const popup = `
    <div class="day-popup" style="min-width:200px;">
      <h3>Jour ${stop.day} — ${stop.title}</h3>
      <div class="city">${stop.city}</div>
      ${stop.description ? '<div class="desc">' + stop.description.substring(0, 150) + '</div>' : ''}
      ${stop.hotel ? '<div class="meta hotel">🏨 ' + stop.hotel + '</div>' : ''}
      ${stop.distance ? '<div class="meta">📍 ' + stop.distance + ' km</div>' : ''}
    </div>
  `;
  marker.bindPopup(popup, { maxWidth: 300 });

  // Open first marker popup by default
  if (isFirst) marker.openPopup();
});
</script>
</body>
</html>"""


# ── Schemas ───────────────────────────────────────────────────────────

class MapPreviewRequest(BaseModel):
    cities: list[str]
    title: Optional[str] = "Circuit Maroc"


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/circuit/{project_id}", response_class=HTMLResponse,
            dependencies=[Depends(require_auth)])
def circuit_map(project_id: str, db: Session = Depends(get_db)):
    """Generate an interactive Leaflet map for a project's itinerary."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == project_id)
    ).scalars().first()
    if not itin:
        raise HTTPException(404, "No itinerary found for this project")

    days = db.execute(
        select(ItineraryDay)
        .where(ItineraryDay.itinerary_id == itin.id)
        .order_by(ItineraryDay.day_number)
    ).scalars().all()

    if not days:
        raise HTTPException(404, "Itinerary has no days")

    # Build stops and route
    stops = []
    route = []
    total_km = 0
    seen_cities = set()

    for d in days:
        coords = _get_coords(d.city or "")
        if not coords:
            continue

        # Avoid duplicate markers for same city consecutive days
        if d.city not in seen_cities or d.city != (days[d.day_number - 2].city if d.day_number > 1 else ""):
            stops.append({
                "day": d.day_number,
                "city": d.city or "",
                "title": d.title or "",
                "description": d.description or "",
                "hotel": d.hotel or "",
                "distance": d.distance_km or 0,
                "latlng": list(coords),
            })
            route.append(list(coords))
            seen_cities.add(d.city)

        if d.distance_km:
            total_km += d.distance_km

    import json
    from jinja2 import Template

    template = Template(MAP_HTML)
    html = template.render(
        title=project.name or "Circuit Maroc",
        subtitle=f"{project.duration_days or len(days)}J/{project.duration_nights or len(days)-1}N — {project.destination or 'Maroc'}",
        stops_json=json.dumps(stops),
        route_json=json.dumps(route),
        total_km=total_km,
    )

    return HTMLResponse(content=html)


@router.post("/preview", response_class=HTMLResponse)
def preview_map(data: MapPreviewRequest):
    """Generate a quick map preview from a list of cities (no auth required for demos)."""
    import json
    from jinja2 import Template

    stops = []
    route = []
    total_km = 0

    for i, city in enumerate(data.cities):
        coords = _get_coords(city)
        if not coords:
            continue
        stops.append({
            "day": i + 1,
            "city": city,
            "title": city,
            "description": "",
            "hotel": "",
            "distance": 0,
            "latlng": list(coords),
        })
        route.append(list(coords))

    template = Template(MAP_HTML)
    html = template.render(
        title=data.title,
        subtitle=f"{len(data.cities)} villes",
        stops_json=json.dumps(stops),
        route_json=json.dumps(route),
        total_km=total_km,
    )

    return HTMLResponse(content=html)


@router.get("/geocode")
def geocode(city: str = Query(..., description="City name to geocode")):
    """Look up coordinates for a Moroccan city."""
    coords = _get_coords(city)
    if not coords:
        raise HTTPException(404, f"City '{city}' not found in database")
    return {"city": city, "lat": coords[0], "lng": coords[1]}

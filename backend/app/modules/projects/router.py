"""Projects router — Central entity CRUD."""

from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, func, case
from pydantic import BaseModel

from app.core.database import get_db
from app.modules.projects.models import Project, ProjectStatus, ProjectType
from app.shared.exceptions import NotFoundError
from app.shared.schemas import BaseResponse
from app.shared.dependencies import require_auth
from app.shared.audit import log_action

router = APIRouter(prefix="/projects", tags=["projects"], dependencies=[Depends(require_auth)])


class ProjectCreate(BaseModel):
    name: str
    reference: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    status: ProjectStatus = ProjectStatus.DRAFT
    project_type: Optional[ProjectType] = None
    destination: Optional[str] = None
    duration_days: Optional[int] = None
    duration_nights: Optional[int] = None
    pax_count: Optional[int] = None
    travel_dates: Optional[str] = None
    language: str = "fr"
    currency: str = "EUR"
    notes: Optional[str] = None
    highlights: Optional[list[str]] = None
    inclusions: Optional[list[str]] = None
    exclusions: Optional[list[str]] = None


class ProjectUpdate(ProjectCreate):
    name: Optional[str] = None


class ProjectResponse(BaseResponse):
    name: str
    reference: Optional[str]
    client_name: Optional[str]
    client_email: Optional[str]
    status: ProjectStatus
    project_type: Optional[ProjectType]
    destination: Optional[str]
    duration_days: Optional[int]
    duration_nights: Optional[int]
    pax_count: Optional[int]
    travel_dates: Optional[str]
    language: str
    currency: str
    notes: Optional[str]
    cover_image_url: Optional[str]
    map_image_url: Optional[str]
    highlights: Optional[list]
    inclusions: Optional[list]
    exclusions: Optional[list]


class ProjectSummary(BaseModel):
    id: str
    name: str
    reference: Optional[str]
    client_name: Optional[str]
    status: ProjectStatus
    project_type: Optional[ProjectType]
    destination: Optional[str]
    duration_days: Optional[int]
    pax_count: Optional[int]
    currency: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class PaginatedProjects(BaseModel):
    items: list[ProjectResponse]
    total: int
    limit: int
    offset: int
    has_more: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=PaginatedProjects)
def list_projects(
    status: Optional[ProjectStatus] = None,
    search: Optional[str] = None,
    project_type: Optional[ProjectType] = None,
    sort: str = Query(default="updated_at", pattern="^(updated_at|created_at|name|client_name)$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    base = select(Project).where(Project.active == True)
    if status:
        base = base.where(Project.status == status)
    if project_type:
        base = base.where(Project.project_type == project_type)
    if search:
        base = base.where(or_(
            Project.name.ilike(f"%{search}%"),
            Project.client_name.ilike(f"%{search}%"),
            Project.reference.ilike(f"%{search}%"),
            Project.destination.ilike(f"%{search}%"),
        ))

    # Total count (sans limit/offset)
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()

    # Tri dynamique
    sort_col = getattr(Project, sort, Project.updated_at)
    ordered = base.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    items = db.execute(ordered.limit(limit).offset(offset)).scalars().all()

    return PaginatedProjects(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=(offset + limit) < total,
    )


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db),
                   current_user: dict = Depends(require_auth)):
    project = Project(**data.model_dump())
    db.add(project)
    db.flush()
    log_action(db, "project", project.id, "create", current_user,
               changes={"name": {"before": None, "after": data.name}})
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.execute(select(Project).where(Project.id == project_id)).scalars().first()
    if not p:
        raise NotFoundError(f"Project {project_id} not found")
    return p


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, data: ProjectUpdate, db: Session = Depends(get_db),
                   current_user: dict = Depends(require_auth)):
    p = db.execute(select(Project).where(Project.id == project_id)).scalars().first()
    if not p:
        raise NotFoundError(f"Project {project_id} not found")
    updates = data.model_dump(exclude_none=True)
    before = {k: getattr(p, k, None) for k in updates}
    for field, value in updates.items():
        setattr(p, field, value)
    log_action(db, "project", project_id, "update", current_user,
               changes={k: {"before": before[k], "after": updates[k]} for k in updates if before[k] != updates[k]})
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{project_id}/status")
def update_status(project_id: str, new_status: ProjectStatus, db: Session = Depends(get_db),
                  current_user: dict = Depends(require_auth)):
    p = db.execute(select(Project).where(Project.id == project_id)).scalars().first()
    if not p:
        raise NotFoundError()
    old_status = p.status
    p.status = new_status
    log_action(db, "project", project_id, "status_change", current_user,
               changes={"status": {"before": old_status, "after": new_status}})
    db.commit()
    # Invalider le cache KPI après changement de statut
    try:
        from app.core.redis import get_redis_sync
        get_redis_sync().delete(_KPI_CACHE_KEY)
    except Exception:
        pass
    return {"id": project_id, "status": new_status}


@router.get("/{project_id}/audit")
def get_project_audit(project_id: str, db: Session = Depends(get_db)):
    from app.modules.admin.models import AuditLog
    logs = db.execute(
        select(AuditLog)
        .where(AuditLog.entity_id == project_id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    ).scalars().all()
    return logs


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    p = db.execute(select(Project).where(Project.id == project_id)).scalars().first()
    if not p:
        raise NotFoundError()
    p.active = False  # soft delete
    db.commit()


_KPI_CACHE_KEY = "rihla:kpis:dashboard"
_KPI_TTL = 300  # 5 minutes


@router.get("/stats/kpis", summary="Dashboard KPIs — real project statistics")
def get_kpis(db: Session = Depends(get_db)):
    """Return real KPIs, cached in Redis for 5 minutes."""
    from app.core.cache import redis_get_json, redis_set_json
    from app.core.redis import get_redis_sync

    redis = get_redis_sync()
    cached = redis_get_json(redis, _KPI_CACHE_KEY)
    if cached:
        cached["cached"] = True
        return cached

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    total = db.execute(
        select(func.count(Project.id)).where(Project.active == True)
    ).scalar_one()

    status_counts = db.execute(
        select(Project.status, func.count(Project.id))
        .where(Project.active == True)
        .group_by(Project.status)
    ).all()
    by_status = {str(row[0]): row[1] for row in status_counts}

    recent_count = db.execute(
        select(func.count(Project.id)).where(
            Project.active == True,
            Project.created_at >= thirty_days_ago
        )
    ).scalar_one()

    active_count = (
        by_status.get("in_progress", 0) +
        by_status.get("validated", 0) +
        by_status.get("sent", 0)
    )

    top_dest_row = db.execute(
        select(Project.destination, func.count(Project.id).label("cnt"))
        .where(Project.active == True, Project.destination != None)
        .group_by(Project.destination)
        .order_by(func.count(Project.id).desc())
        .limit(1)
    ).first()
    top_destination = top_dest_row[0] if top_dest_row else None

    # Conversion funnel: taux draft→sent→won
    total_nonzero = max(total, 1)
    funnel = {
        "draft_to_sent_pct": round(
            (by_status.get("sent", 0) + by_status.get("won", 0)) / total_nonzero * 100, 1
        ),
        "sent_to_won_pct": round(
            by_status.get("won", 0) / max(by_status.get("sent", 0) + by_status.get("won", 0), 1) * 100, 1
        ),
    }

    result = {
        "total_projects": total,
        "active_projects": active_count,
        "recent_projects_30d": recent_count,
        "by_status": by_status,
        "top_destination": top_destination,
        "funnel": funnel,
        "generated_at": now.isoformat(),
        "cached": False,
    }

    redis_set_json(redis, _KPI_CACHE_KEY, result, _KPI_TTL)
    return result


@router.post("/stats/kpis/invalidate", summary="Force KPI cache refresh")
def invalidate_kpi_cache():
    """Invalide le cache KPI (appelé après mutations critiques)."""
    from app.core.redis import get_redis_sync
    redis = get_redis_sync()
    redis.delete(_KPI_CACHE_KEY)
    return {"invalidated": True}


# ════════════════════════════════════════════════════════════════════════════
# INTERACTIVE MAP — destination aggregation
# ════════════════════════════════════════════════════════════════════════════

# Real geo coordinates for Moroccan destinations (lat, lng)
_DESTINATIONS: list[dict] = [
    {"id": "rak", "name": "Marrakech",   "lat": 31.6295, "lng": -7.9811, "tier": "hub",     "tags": ["culture", "imperiale"]},
    {"id": "cas", "name": "Casablanca",  "lat": 33.5731, "lng": -7.5898, "tier": "hub",     "tags": ["business", "cote"]},
    {"id": "fes", "name": "Fès",         "lat": 34.0181, "lng": -5.0078, "tier": "hub",     "tags": ["culture", "imperiale"]},
    {"id": "rab", "name": "Rabat",       "lat": 34.0209, "lng": -6.8417, "tier": "city",    "tags": ["culture", "imperiale", "cote"]},
    {"id": "tan", "name": "Tanger",      "lat": 35.7595, "lng": -5.8340, "tier": "city",    "tags": ["cote", "nord"]},
    {"id": "che", "name": "Chefchaouen", "lat": 35.1688, "lng": -5.2636, "tier": "etape",   "tags": ["culture", "nord", "montagne"]},
    {"id": "mek", "name": "Meknès",      "lat": 33.8935, "lng": -5.5547, "tier": "etape",   "tags": ["culture", "imperiale"]},
    {"id": "ouz", "name": "Ouarzazate",  "lat": 30.9189, "lng": -6.8934, "tier": "etape",   "tags": ["desert", "cinema"]},
    {"id": "mer", "name": "Merzouga",    "lat": 31.0998, "lng": -4.0125, "tier": "etape",   "tags": ["desert", "sahara"]},
    {"id": "ess", "name": "Essaouira",   "lat": 31.5085, "lng": -9.7595, "tier": "etape",   "tags": ["cote", "atlantique"]},
    {"id": "aga", "name": "Agadir",      "lat": 30.4278, "lng": -9.5981, "tier": "city",    "tags": ["cote", "atlantique"]},
    {"id": "tet", "name": "Tétouan",     "lat": 35.5786, "lng": -5.3684, "tier": "etape",   "tags": ["nord", "cote"]},
    {"id": "erf", "name": "Erfoud",      "lat": 31.4293, "lng": -4.2299, "tier": "etape",   "tags": ["desert"]},
    {"id": "daa", "name": "Dakhla",      "lat": 23.6848, "lng": -15.9579, "tier": "etape",  "tags": ["sahara", "cote"]},
]

# Common DMC circuits — used to draw animated routes between cities
_CIRCUITS: list[dict] = [
    {"id": "imperiale", "label": "Cités Impériales",     "cities": ["rab", "mek", "fes", "rak"], "color": "#22d3ee"},
    {"id": "sahara",    "label": "Marrakech → Sahara",   "cities": ["rak", "ouz", "mer"],         "color": "#f59e0b"},
    {"id": "atlantique","label": "Côte Atlantique",      "cities": ["cas", "rab", "ess", "aga"],  "color": "#10b981"},
    {"id": "nord",      "label": "Tanger – Chefchaouen", "cities": ["tan", "tet", "che", "fes"],  "color": "#a78bfa"},
]


def _match_destination(project_destination: str | None, dest_name: str) -> bool:
    if not project_destination:
        return False
    p = project_destination.lower()
    n = dest_name.lower()
    if n in p:
        return True
    # fuzzy aliases
    aliases = {
        "fès": ["fez", "fes"],
        "tanger": ["tangier"],
        "tétouan": ["tetouan"],
        "casablanca": ["casa"],
        "ouarzazate": ["ouz"],
    }
    for canon, alts in aliases.items():
        if n == canon and any(a in p for a in alts):
            return True
    return False


@router.get("/stats/destinations", summary="Per-destination KPIs for the interactive Morocco map")
def get_destination_stats(db: Session = Depends(get_db)):
    """Return aggregated KPIs per Moroccan destination + common circuits.

    Used by the dashboard interactive map (Leaflet) to render markers, popups
    and animated route polylines.
    """
    rows = db.execute(
        select(Project.destination, Project.status, Project.pax_count, Project.duration_days)
        .where(Project.active == True)
    ).all()

    destinations = []
    for d in _DESTINATIONS:
        matched = [r for r in rows if _match_destination(r[0], d["name"])]
        active = sum(
            1 for r in matched
            if str(r[1]).split(".")[-1].lower() in ("in_progress", "validated", "sent")
        )
        won = sum(1 for r in matched if str(r[1]).split(".")[-1].lower() == "won")
        total_pax = sum((r[2] or 0) for r in matched)
        total_nights = sum((r[3] or 0) for r in matched)
        destinations.append({
            **d,
            "projects_total": len(matched),
            "projects_active": active,
            "projects_won": won,
            "total_pax": total_pax,
            "total_nights": total_nights,
        })

    # Sort by activity to compute "top" status badges
    sorted_dests = sorted(destinations, key=lambda x: x["projects_total"], reverse=True)
    top_id = sorted_dests[0]["id"] if sorted_dests and sorted_dests[0]["projects_total"] > 0 else None

    return {
        "destinations": destinations,
        "circuits": _CIRCUITS,
        "top_destination_id": top_id,
        "bounds": {
            "north": 35.95,
            "south": 27.5,
            "east":  -1.0,
            "west":  -13.5,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ════════════════════════════════════════════════════════════════════════════
# GROUP ITINERARIES — animated route map
# ════════════════════════════════════════════════════════════════════════════

# Color palette for groups on the map — high-contrast, accessible
_GROUP_COLORS: list[str] = [
    "#C0392B", "#22d3ee", "#f59e0b", "#10b981", "#a78bfa",
    "#ec4899", "#0ea5e9", "#84cc16", "#f97316", "#8b5cf6",
    "#14b8a6", "#eab308",
]


def _resolve_city(name: str) -> dict | None:
    """Find a destination dict from a free-text city token (case/accent insensitive)."""
    if not name:
        return None
    norm = name.strip().lower()
    norm = norm.replace("é", "e").replace("è", "e").replace("ï", "i").replace("ô", "o")
    for d in _DESTINATIONS:
        cand = d["name"].lower().replace("é", "e").replace("è", "e").replace("ô", "o")
        if cand == norm or cand in norm or norm in cand:
            return d
    aliases = {
        "fes": "fes", "fez": "fes",
        "tangier": "tan",
        "casa": "cas",
        "ouz": "ouz", "ouarz": "ouz",
        "merz": "mer",
    }
    for alias, did in aliases.items():
        if alias in norm:
            for d in _DESTINATIONS:
                if d["id"] == did:
                    return d
    return None


def _parse_route(destination: str | None) -> list[dict]:
    """Parse 'Marrakech → Ouarzazate → Merzouga' into ordered list of dest dicts."""
    if not destination:
        return []
    # Normalise common separators
    raw = destination.replace("→", ",").replace("->", ",").replace("·", ",").replace("/", ",")
    tokens = [t.strip() for t in raw.split(",") if t.strip()]
    out: list[dict] = []
    seen: set[str] = set()
    for t in tokens:
        d = _resolve_city(t)
        if d and d["id"] not in seen:
            out.append(d)
            seen.add(d["id"])
    return out


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    import math
    R = 6371.0
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


@router.get("/stats/groups-map", summary="All group itineraries for the animated route map")
def get_groups_itinerary_map(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return all active groups (projects) as itineraries with positioned days.

    Each group is a coloured route the front-end can animate (a moving traveler
    marker) and a timeline of day-stops the user can scrub through.
    """
    q = select(Project).where(Project.active == True)
    if status_filter:
        wanted = [s.strip().lower() for s in status_filter.split(",")]
        q = q.where(func.lower(Project.status).in_(wanted))
    projects = db.execute(q).scalars().all()

    # Optional: itinerary days per project (preferred over parsed destination string)
    from app.modules.itineraries.models import Itinerary, ItineraryDay

    groups: list[dict] = []
    for idx, p in enumerate(projects):
        # Try real itinerary days first
        days_payload: list[dict] = []
        cities_in_order: list[dict] = []

        itin = db.execute(
            select(Itinerary).where(Itinerary.project_id == p.id).limit(1)
        ).scalar_one_or_none()

        if itin and itin.days:
            for day in itin.days:
                d = _resolve_city(day.city) if day.city else None
                if not d:
                    continue
                if not cities_in_order or cities_in_order[-1]["id"] != d["id"]:
                    cities_in_order.append(d)
                days_payload.append({
                    "day_number": day.day_number,
                    "title":      day.title,
                    "city_id":    d["id"],
                    "city_name":  d["name"],
                    "lat":        d["lat"],
                    "lng":        d["lng"],
                    "hotel":      day.hotel,
                    "hotel_category": day.hotel_category,
                    "meal_plan":  day.meal_plan,
                    "distance_km": day.distance_km,
                    "image_url":  day.image_url,
                })
        else:
            # Fallback: parse destination string and distribute days evenly
            cities_in_order = _parse_route(p.destination)
            n_days = p.duration_days or max(len(cities_in_order), 1)
            n_stops = max(len(cities_in_order), 1)
            # distribute days across stops (e.g. 8 days, 3 cities → 3,3,2)
            base = n_days // n_stops
            extra = n_days % n_stops
            day_idx = 1
            for i, c in enumerate(cities_in_order):
                nights_here = base + (1 if i < extra else 0)
                for k in range(nights_here):
                    days_payload.append({
                        "day_number": day_idx,
                        "title":      f"{c['name']} — Jour {day_idx}",
                        "city_id":    c["id"],
                        "city_name":  c["name"],
                        "lat":        c["lat"],
                        "lng":        c["lng"],
                        "hotel":      None,
                        "hotel_category": None,
                        "meal_plan":  None,
                        "distance_km": None,
                        "image_url":  None,
                    })
                    day_idx += 1

        if not cities_in_order:
            continue  # skip projects we cannot localise

        # Cumulative distance along the route
        total_km = 0.0
        for i in range(1, len(cities_in_order)):
            total_km += _haversine_km(
                (cities_in_order[i - 1]["lat"], cities_in_order[i - 1]["lng"]),
                (cities_in_order[i]["lat"],     cities_in_order[i]["lng"]),
            )

        status = str(p.status).split(".")[-1].lower()
        groups.append({
            "id":            p.id,
            "name":          p.name,
            "reference":     p.reference,
            "status":        status,
            "color":         _GROUP_COLORS[idx % len(_GROUP_COLORS)],
            "pax":           p.pax_count or 0,
            "duration_days": p.duration_days or len(days_payload),
            "duration_nights": p.duration_nights or 0,
            "destination":   p.destination,
            "client_name":   p.client_name,
            "total_km":      round(total_km, 1),
            "route":         [
                {"id": c["id"], "name": c["name"], "lat": c["lat"], "lng": c["lng"], "tier": c["tier"]}
                for c in cities_in_order
            ],
            "days":          days_payload,
        })

    return {
        "groups":      groups,
        "bounds":      {"north": 35.95, "south": 27.5, "east": -1.0, "west": -13.5},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Clone / Duplicate project ────────────────────────────────────────

class CloneRequest(BaseModel):
    new_name: Optional[str] = None
    new_client_name: Optional[str] = None
    new_client_email: Optional[str] = None
    clone_itinerary: bool = True
    clone_quotation: bool = True


@router.post("/{project_id}/clone", summary="Clone / duplicate a project")
def clone_project(
    project_id: str,
    data: CloneRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    """Clone an existing project with its itinerary and quotation.

    Creates a new project in DRAFT status, copying all details.
    Useful for adapting a similar circuit for a new client.
    """
    import uuid as uuid_mod
    from app.modules.itineraries.models import Itinerary, ItineraryDay
    from app.modules.quotations.models import Quotation, QuotationLine

    source = db.get(Project, project_id)
    if not source:
        raise NotFoundError("Project not found")

    # Create new project
    new_id = str(uuid_mod.uuid4())
    clone_name = data.new_name or f"{source.name} (copie)"

    # Use raw SQL insert to avoid FK resolution issues with unmapped tables
    from sqlalchemy import text
    import json as json_mod
    from datetime import datetime as dt, timezone as tz

    now = dt.now(tz.utc).isoformat()
    db.execute(text("""
        INSERT INTO projects (id, name, client_name, client_email, status, project_type,
            destination, duration_days, duration_nights, pax_count, language, currency,
            notes, highlights, inclusions, exclusions, guide_rules, water_policy,
            km_total, bus_rate_per_km, is_signed, payment_status, active, created_at, updated_at)
        VALUES (:id, :name, :client_name, :client_email, :status, :project_type,
            :destination, :duration_days, :duration_nights, :pax_count, :language, :currency,
            :notes, :highlights, :inclusions, :exclusions, :guide_rules, :water_policy,
            :km_total, :bus_rate_per_km, false, 'pending', true, :created_at, :updated_at)
    """), {
        "id": new_id,
        "name": clone_name,
        "client_name": data.new_client_name or source.client_name,
        "client_email": data.new_client_email or source.client_email,
        "status": "draft",
        "project_type": str(source.project_type) if source.project_type else None,
        "destination": source.destination,
        "duration_days": source.duration_days,
        "duration_nights": source.duration_nights,
        "pax_count": source.pax_count,
        "language": source.language or "fr",
        "currency": source.currency or "EUR",
        "notes": f"Cloné depuis: {source.name} ({source.reference or project_id[:8]})",
        "highlights": json_mod.dumps(source.highlights) if source.highlights else None,
        "inclusions": json_mod.dumps(source.inclusions) if source.inclusions else None,
        "exclusions": json_mod.dumps(source.exclusions) if source.exclusions else None,
        "guide_rules": json_mod.dumps(source.guide_rules) if source.guide_rules else None,
        "water_policy": json_mod.dumps(source.water_policy) if source.water_policy else None,
        "km_total": source.km_total,
        "bus_rate_per_km": float(source.bus_rate_per_km) if source.bus_rate_per_km else None,
        "created_at": now,
        "updated_at": now,
    })

    cloned_items = {"itinerary_days": 0, "quotation_lines": 0}

    # Clone itinerary via raw SQL
    if data.clone_itinerary:
        itin_rows = db.execute(text(
            "SELECT id FROM itineraries WHERE project_id = :pid LIMIT 1"
        ), {"pid": project_id}).fetchone()

        if itin_rows:
            src_itin_id = itin_rows[0]
            new_itin_id = str(uuid_mod.uuid4())
            db.execute(text("""
                INSERT INTO itineraries (id, project_id, version, language, active, created_at, updated_at)
                VALUES (:id, :pid, 1, 'fr', true, :now, :now)
            """), {"id": new_itin_id, "pid": new_id, "now": now})

            day_rows = db.execute(text("""
                SELECT day_number, city, title, description, hotel, distance_km
                FROM itinerary_days WHERE itinerary_id = :iid ORDER BY day_number
            """), {"iid": src_itin_id}).fetchall()

            for d in day_rows:
                db.execute(text("""
                    INSERT INTO itinerary_days (id, itinerary_id, day_number, city, title,
                        description, hotel, distance_km, ai_generated, active, created_at, updated_at)
                    VALUES (:id, :iid, :dn, :city, :title, :desc, :hotel, :dist, false, true, :now, :now)
                """), {
                    "id": str(uuid_mod.uuid4()), "iid": new_itin_id,
                    "dn": d[0], "city": d[1], "title": d[2] or f"Jour {d[0]}",
                    "desc": d[3], "hotel": d[4], "dist": d[5], "now": now,
                })
                cloned_items["itinerary_days"] += 1

    # Clone quotation via raw SQL
    if data.clone_quotation:
        quot_row = db.execute(text("""
            SELECT id, currency, margin_pct, total_cost, total_selling,
                   price_per_pax, single_supplement, foc_count
            FROM quotations WHERE project_id = :pid LIMIT 1
        """), {"pid": project_id}).fetchone()

        if quot_row:
            src_quot_id = quot_row[0]
            new_quot_id = str(uuid_mod.uuid4())
            db.execute(text("""
                INSERT INTO quotations (id, project_id, version, status, currency,
                    margin_pct, total_cost, total_selling, price_per_pax,
                    single_supplement, foc_count, active, created_at, updated_at)
                VALUES (:id, :pid, 1, 'draft', :currency, :margin, :tc, :ts,
                    :ppp, :ss, :foc, true, :now, :now)
            """), {
                "id": new_quot_id, "pid": new_id,
                "currency": quot_row[1], "margin": quot_row[2],
                "tc": quot_row[3], "ts": quot_row[4],
                "ppp": quot_row[5], "ss": quot_row[6], "foc": quot_row[7],
                "now": now,
            })

            line_rows = db.execute(text("""
                SELECT day_number, sort_order, category, label, city, supplier,
                       unit_cost, quantity, unit, total_cost, is_included, notes
                FROM quotation_lines WHERE quotation_id = :qid
                ORDER BY day_number, sort_order
            """), {"qid": src_quot_id}).fetchall()

            for l in line_rows:
                db.execute(text("""
                    INSERT INTO quotation_lines (id, quotation_id, day_number, sort_order,
                        category, label, city, supplier, unit_cost, quantity, unit,
                        total_cost, is_included, notes, active, created_at, updated_at)
                    VALUES (:id, :qid, :dn, :so, :cat, :label, :city, :supp,
                        :uc, :qty, :unit, :tc, :inc, :notes, true, :now, :now)
                """), {
                    "id": str(uuid_mod.uuid4()), "qid": new_quot_id,
                    "dn": l[0], "so": l[1], "cat": l[2], "label": l[3],
                    "city": l[4], "supp": l[5], "uc": l[6], "qty": l[7],
                    "unit": l[8], "tc": l[9], "inc": l[10], "notes": l[11],
                    "now": now,
                })
                cloned_items["quotation_lines"] += 1

    db.commit()

    return {
        "success": True,
        "original_project_id": project_id,
        "cloned_project": {
            "id": new_id,
            "name": clone_name,
            "status": "draft",
            "client_name": data.new_client_name or source.client_name,
        },
        "cloned_items": cloned_items,
    }


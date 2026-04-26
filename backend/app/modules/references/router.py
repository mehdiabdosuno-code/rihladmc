"""References router — Générateur de références S'TOURS.

POST /api/references/generate  → génère et persiste une nouvelle référence
GET  /api/references/           → historique paginé
GET  /api/references/airports   → liste des 16 aéroports
GET  /api/references/departments→ liste des 5 départements
GET  /api/references/preview    → prévisualise sans persister
DELETE /api/references/{id}     → suppression
"""

from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.modules.references.models import (
    ReferenceCounter, GeneratedReference,
    AIRPORTS, DEPARTMENTS,
)
from app.shared.exceptions import NotFoundError

from app.shared.dependencies import require_auth

router = APIRouter(prefix="/references", tags=["references"], dependencies=[Depends(require_auth)])


# ── Schemas ───────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    group_name:   str = Field(..., min_length=1, max_length=200,
                              description="Nom du groupe ou du dossier")
    airport_code: str = Field(..., min_length=3, max_length=3,
                              description="Code IATA (ex: CMN)")
    dept_code:    str = Field(..., min_length=2, max_length=2,
                              description="Code département (ME/DL/DI/BT/MS)")
    date_str:     Optional[str] = Field(None, pattern=r"^\d{6}$",
                              description="Date AAMMJJ — défaut = aujourd'hui")
    project_id:   Optional[str] = None
    notes:        Optional[str] = None


class PreviewRequest(BaseModel):
    group_name:   str
    airport_code: str
    dept_code:    str
    date_str:     Optional[str] = None


class ReferenceResponse(BaseModel):
    id:             str
    group_name:     str
    airport_city:   str
    airport_code:   str
    dept_code:      str
    dept_label:     str
    date_str:       str
    seq_number:     int
    full_reference: str
    project_id:     Optional[str]
    notes:          Optional[str]
    created_at:     datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────

def _today() -> str:
    """Returns today as AAMMJJ."""
    d = date.today()
    return f"{str(d.year)[2:]}{d.month:02d}{d.day:02d}"


def _airport_city(code: str) -> str:
    for a in AIRPORTS:
        if a["code"].upper() == code.upper():
            return a["city"]
    raise HTTPException(400, f"Code aéroport inconnu : {code}. "
                        f"Codes valides : {', '.join(a['code'] for a in AIRPORTS)}")


def _dept_label(code: str) -> str:
    for d in DEPARTMENTS:
        if d["code"].upper() == code.upper():
            return d["label"]
    valid = ", ".join(d["code"] for d in DEPARTMENTS)
    raise HTTPException(400, f"Code département inconnu : {code}. Valides : {valid}")


def _build_reference(group_name: str, airport_city: str, airport_code: str,
                     dept_code: str, date_str: str, seq: int) -> str:
    """Assemble la référence complète."""
    return f"{group_name.strip().upper()} {airport_city} {airport_code.upper()} {dept_code.upper()} {date_str} {seq:04d}"


def _next_seq(db: Session, dept_code: str, date_str: str) -> int:
    """Atomically increment and return the next sequence number."""
    counter = db.execute(
        select(ReferenceCounter).where(
            ReferenceCounter.dept_code == dept_code.upper(),
            ReferenceCounter.date_str  == date_str,
        )
    ).scalars().first()

    if counter is None:
        counter = ReferenceCounter(
            dept_code=dept_code.upper(),
            date_str=date_str,
            last_num=1,
        )
        db.add(counter)
        db.flush()
        return 1
    else:
        counter.last_num += 1
        db.flush()
        return counter.last_num


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/airports")
def list_airports():
    """Liste des 16 aéroports marocains."""
    return AIRPORTS


@router.get("/departments")
def list_departments():
    """Liste des 5 codes de département S'TOURS."""
    return DEPARTMENTS


@router.get("/preview")
def preview_reference(
    group_name:   str = Query(...),
    airport_code: str = Query(...),
    dept_code:    str = Query(...),
    date_str:     Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Prévisualise la prochaine référence sans la persister."""
    ds   = date_str or _today()
    city = _airport_city(airport_code)
    _dept_label(dept_code)  # validate

    # Peek next seq without incrementing
    counter = db.execute(
        select(ReferenceCounter).where(
            ReferenceCounter.dept_code == dept_code.upper(),
            ReferenceCounter.date_str  == ds,
        )
    ).scalars().first()
    next_seq = (counter.last_num + 1) if counter else 1

    return {
        "preview": _build_reference(group_name, city, airport_code, dept_code, ds, next_seq),
        "seq_number": next_seq,
        "date_str": ds,
        "airport_city": city,
        "dept_label": _dept_label(dept_code),
    }


@router.post("/generate", response_model=ReferenceResponse, status_code=201)
def generate_reference(data: GenerateRequest, db: Session = Depends(get_db)):
    """Génère, persiste et retourne une nouvelle référence unique."""
    ds        = data.date_str or _today()
    city      = _airport_city(data.airport_code)
    dept_lbl  = _dept_label(data.dept_code)

    seq = _next_seq(db, data.dept_code, ds)
    full_ref = _build_reference(
        data.group_name, city, data.airport_code,
        data.dept_code, ds, seq,
    )

    ref = GeneratedReference(
        group_name    = data.group_name.strip().upper(),
        airport_city  = city,
        airport_code  = data.airport_code.upper(),
        dept_code     = data.dept_code.upper(),
        date_str      = ds,
        seq_number    = seq,
        full_reference= full_ref,
        project_id    = data.project_id,
        notes         = data.notes,
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)

    return ReferenceResponse(
        id            = ref.id,
        group_name    = ref.group_name,
        airport_city  = ref.airport_city,
        airport_code  = ref.airport_code,
        dept_code     = ref.dept_code,
        dept_label    = dept_lbl,
        date_str      = ref.date_str,
        seq_number    = ref.seq_number,
        full_reference= ref.full_reference,
        project_id    = ref.project_id,
        notes         = ref.notes,
        created_at    = ref.created_at,
    )


@router.get("/", response_model=list[ReferenceResponse])
def list_references(
    dept_code:    Optional[str] = None,
    date_str:     Optional[str] = None,
    search:       Optional[str] = None,
    limit:  int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Historique des références générées."""
    dept_map = {d["code"]: d["label"] for d in DEPARTMENTS}

    q = select(GeneratedReference).where(GeneratedReference.active == True)
    if dept_code: q = q.where(GeneratedReference.dept_code == dept_code.upper())
    if date_str:  q = q.where(GeneratedReference.date_str  == date_str)
    if search:    q = q.where(GeneratedReference.full_reference.ilike(f"%{search}%"))
    q = q.order_by(GeneratedReference.created_at.desc()).limit(limit).offset(offset)

    refs = db.execute(q).scalars().all()
    return [
        ReferenceResponse(
            id            = r.id,
            group_name    = r.group_name,
            airport_city  = r.airport_city,
            airport_code  = r.airport_code,
            dept_code     = r.dept_code,
            dept_label    = dept_map.get(r.dept_code, r.dept_code),
            date_str      = r.date_str,
            seq_number    = r.seq_number,
            full_reference= r.full_reference,
            project_id    = r.project_id,
            notes         = r.notes,
            created_at    = r.created_at,
        )
        for r in refs
    ]


@router.get("/{ref_id}", response_model=ReferenceResponse)
def get_reference(ref_id: str, db: Session = Depends(get_db)):
    r = db.execute(
        select(GeneratedReference).where(GeneratedReference.id == ref_id)
    ).scalars().first()
    if not r:
        raise NotFoundError("Référence introuvable")
    dept_map = {d["code"]: d["label"] for d in DEPARTMENTS}
    return ReferenceResponse(
        id=r.id, group_name=r.group_name, airport_city=r.airport_city,
        airport_code=r.airport_code, dept_code=r.dept_code,
        dept_label=dept_map.get(r.dept_code, r.dept_code),
        date_str=r.date_str, seq_number=r.seq_number,
        full_reference=r.full_reference, project_id=r.project_id,
        notes=r.notes, created_at=r.created_at,
    )


@router.delete("/{ref_id}", status_code=204)
def delete_reference(ref_id: str, db: Session = Depends(get_db)):
    r = db.execute(
        select(GeneratedReference).where(GeneratedReference.id == ref_id)
    ).scalars().first()
    if not r:
        raise NotFoundError("Référence introuvable")
    r.active = False
    db.commit()

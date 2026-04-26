from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.guides.schemas import GuideResponse, GuideCreate, GuideUpdate
from app.modules.guides.service import GuideService

from app.shared.dependencies import require_auth

router = APIRouter(prefix="/guides", tags=["guides"], dependencies=[Depends(require_auth)])

@router.get("/", response_model=List[GuideResponse])
def list_guides(
    city: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return GuideService(db).list(city=city)

@router.get("/{guide_id}", response_model=GuideResponse)
def get_guide(guide_id: str, db: Session = Depends(get_db)):
    guide = GuideService(db).get(guide_id)
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    return guide

@router.post("/", response_model=GuideResponse, status_code=201)
def create_guide(data: GuideCreate, db: Session = Depends(get_db)):
    return GuideService(db).create(data)

@router.put("/{guide_id}", response_model=GuideResponse)
def update_guide(guide_id: str, data: GuideUpdate, db: Session = Depends(get_db)):
    guide = GuideService(db).update(guide_id, data)
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    return guide

@router.delete("/{guide_id}", status_code=204)
def delete_guide(guide_id: str, db: Session = Depends(get_db)):
    if not GuideService(db).delete(guide_id):
        raise HTTPException(status_code=404, detail="Guide not found")

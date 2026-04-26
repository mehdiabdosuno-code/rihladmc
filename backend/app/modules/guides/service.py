from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.modules.guides.models import Guide
from app.modules.guides.schemas import GuideCreate, GuideUpdate

class GuideService:
    def __init__(self, db: Session):
        self.db = db

    def list(self, city: Optional[str] = None) -> List[Guide]:
        query = select(Guide).where(Guide.active == True)
        if city:
            query = query.where(Guide.city == city)
        return self.db.execute(query).scalars().all()

    def get(self, guide_id: str) -> Optional[Guide]:
        return self.db.get(Guide, guide_id)

    def create(self, data: GuideCreate) -> Guide:
        guide = Guide(**data.model_dump())
        self.db.add(guide)
        self.db.commit()
        self.db.refresh(guide)
        return guide

    def update(self, guide_id: str, data: GuideUpdate) -> Optional[Guide]:
        guide = self.get(guide_id)
        if not guide:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(guide, key, value)
            
        self.db.commit()
        self.db.refresh(guide)
        return guide

    def delete(self, guide_id: str) -> bool:
        guide = self.get(guide_id)
        if not guide:
            return False
        guide.active = False
        self.db.commit()
        return True

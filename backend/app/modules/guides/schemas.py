from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from app.shared.schemas import BaseResponse

class GuideBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    city: str
    languages: List[str] = []
    specialty: Optional[str] = None
    rating: float = 5.0
    status: str = "Available"
    daily_rate: float = 0.0
    seniority: Optional[str] = None
    image_url: Optional[str] = None
    is_certified: bool = True

class GuideCreate(GuideBase):
    pass

class GuideUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    languages: Optional[List[str]] = None
    specialty: Optional[str] = None
    rating: Optional[float] = None
    status: Optional[str] = None
    daily_rate: Optional[float] = None
    seniority: Optional[str] = None
    image_url: Optional[str] = None
    is_certified: Optional[bool] = None

class GuideResponse(GuideBase, BaseResponse):
    pass

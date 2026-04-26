"""Gamification Router — /api/gamification."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.modules.gamification.service import GamificationService

router = APIRouter(prefix="/gamification", tags=["Gamification"])

@router.get("/leaderboard")
def get_leaderboard(role: str = "travel_designer", db: Session = Depends(get_db)):
    """Get the performance rankings."""
    return GamificationService(db).get_leaderboard(role)

@router.get("/my-stats/{user_id}")
def get_user_stats(user_id: str, db: Session = Depends(get_db)):
    """Get personal badges and level."""
    from app.modules.gamification.models import UserStats
    from sqlalchemy import select
    return db.execute(select(UserStats).where(UserStats.user_id == user_id)).scalar_one_or_none()

"""Gamification Service — Logic for points, badges, and rankings."""

from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from typing import List, Dict
from app.modules.gamification.models import UserStats
from app.modules.auth.models import User

class GamificationService:
    def __init__(self, db: Session):
        self.db = db

    def get_leaderboard(self, role: str = "travel_designer") -> List[Dict]:
        """Fetch the top performing staff for a specific role."""
        # In a real scenario, we'd join with the User table to filter by role
        query = select(UserStats, User.full_name, User.avatar_url)\
            .join(User, User.id == UserStats.user_id)\
            .order_by(desc(UserStats.points))\
            .limit(10)
        
        results = self.db.execute(query).all()
        
        leaderboard = []
        for row in results:
            stats, name, avatar = row
            leaderboard.append({
                "user_id": stats.user_id,
                "name": name,
                "avatar": avatar,
                "points": stats.points,
                "level": stats.level,
                "badges": stats.badges,
                "dossiers_won": stats.dossiers_won,
                "revenue": stats.total_revenue_generated
            })
        
        return leaderboard

    def award_points(self, user_id: str, amount: int, reason: str):
        """Award points to a user and check for level up."""
        stats = self.db.execute(select(UserStats).where(UserStats.user_id == user_id)).scalar_one_or_none()
        if not stats:
            stats = UserStats(user_id=user_id)
            self.db.add(stats)
            self.db.flush()

        stats.points += amount
        stats.xp += amount

        # Basic level up logic: every 1000 points
        new_level = (stats.xp // 1000) + 1
        if new_level > stats.level:
            stats.level = new_level
            # Logic for auto-awarding "Level Up" badge could go here
        
        self.db.commit()
        return stats

    def sync_stats_from_projects(self, user_id: str):
        """Recalculate stats based on actual project performance."""
        # Mocking the sync for the demo
        pass

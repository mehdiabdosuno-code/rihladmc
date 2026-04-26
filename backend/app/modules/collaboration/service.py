"""Collaboration Service — Handling real-time presence and project locking."""

import time
from typing import List, Dict, Optional
from redis import Redis
from app.core.redis import get_redis_sync

class CollaborationService:
    def __init__(self):
        self.redis = get_redis_sync()
        self.presence_ttl = 30 # 30 seconds before considered offline

    def report_presence(self, project_id: str, user_id: str, user_name: str):
        """User reports they are active on a project."""
        key = f"presence:{project_id}:{user_id}"
        data = f"{user_name}:{time.time()}"
        self.redis.setex(key, self.presence_ttl, data)

    def get_active_users(self, project_id: str) -> List[Dict]:
        """Get all users currently active on a specific project."""
        cursor = 0
        active_users = []
        pattern = f"presence:{project_id}:*"
        
        while True:
            cursor, keys = self.redis.scan(cursor, match=pattern)
            for key in keys:
                data = self.redis.get(key)
                if data:
                    name, ts = data.decode('utf-8').split(':')
                    active_users.append({
                        "user_id": key.decode('utf-8').split(':')[-1],
                        "name": name,
                        "last_seen": float(ts)
                    })
            if cursor == 0:
                break
        
        return active_users

    def acquire_lock(self, resource_id: str, user_id: str, duration: int = 60) -> bool:
        """Try to lock a resource (e.g., a quotation line)."""
        lock_key = f"lock:{resource_id}"
        return self.redis.set(lock_key, user_id, ex=duration, nx=True)

    def release_lock(self, resource_id: str, user_id: str):
        """Release a lock if owned by the user."""
        lock_key = f"lock:{resource_id}"
        current_owner = self.redis.get(lock_key)
        if current_owner and current_owner.decode('utf-8') == user_id:
            self.redis.delete(lock_key)

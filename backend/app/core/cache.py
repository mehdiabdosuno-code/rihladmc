"""Lightweight caching utilities for RIHLA.

Provides both Redis-backed (distributed) and in-memory (process-local) caching.
The in-memory LRU is useful for pure-function results like pricing calculations.

Usage:
    from app.core.cache import cached_redis, lru_cache_ttl

    # Redis-backed cache (for shared state across workers)
    @cached_redis("quotation:{quotation_id}:grid", ttl=300)
    def get_pricing_grid(quotation_id: str, db: Session): ...

    # In-memory TTL cache (for pure functions)
    @lru_cache_ttl(maxsize=256, ttl_seconds=120)
    def compute_heavy_thing(param_hash: str): ...
"""

import functools
import hashlib
import json
import logging
import time
from typing import Any, Callable, Optional

logger = logging.getLogger("rihla.cache")


# ═══════════════════════════════════════════════════════════════════
# In-memory LRU cache with TTL expiry
# ═══════════════════════════════════════════════════════════════════

def lru_cache_ttl(maxsize: int = 128, ttl_seconds: int = 120):
    """Decorator: functools.lru_cache with automatic TTL expiration.

    Works only with hashable arguments (strings, ints, tuples).
    For dict/list args, serialize them first or use a hash key.
    """
    def decorator(func: Callable):
        @functools.lru_cache(maxsize=maxsize)
        def _cached(*args, _ttl_round: int = 0, **kwargs):
            return func(*args, **kwargs)

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Round current time to TTL bucket → cache expires automatically
            ttl_round = int(time.time()) // ttl_seconds
            return _cached(*args, _ttl_round=ttl_round, **kwargs)

        wrapper.cache_clear = _cached.cache_clear
        wrapper.cache_info = _cached.cache_info
        return wrapper
    return decorator


# ═══════════════════════════════════════════════════════════════════
# Redis-backed cache helper
# ═══════════════════════════════════════════════════════════════════

def cache_key(*parts: str) -> str:
    """Build a namespaced cache key."""
    return "rihla:" + ":".join(str(p) for p in parts)


def hash_dict(d: dict) -> str:
    """Create a stable hash for a dict (useful as cache key component)."""
    raw = json.dumps(d, sort_keys=True, default=str)
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def redis_get_json(redis_client, key: str) -> Optional[Any]:
    """Get and parse JSON from Redis. Returns None on miss or error."""
    if not redis_client:
        return None
    try:
        raw = redis_client.get(key)
        if raw is None:
            return None
        return json.loads(raw if isinstance(raw, str) else raw.decode())
    except Exception as e:
        logger.debug("Redis GET %s failed: %s", key, e)
        return None


def redis_set_json(redis_client, key: str, value: Any, ttl: int = 300) -> bool:
    """Serialize value as JSON and store in Redis with TTL."""
    if not redis_client:
        return False
    try:
        raw = json.dumps(value, default=str)
        redis_client.setex(key, ttl, raw)
        return True
    except Exception as e:
        logger.debug("Redis SET %s failed: %s", key, e)
        return False


def redis_invalidate(redis_client, *keys: str) -> int:
    """Delete one or more cache keys from Redis."""
    if not redis_client:
        return 0
    try:
        return redis_client.delete(*keys)
    except Exception:
        return 0

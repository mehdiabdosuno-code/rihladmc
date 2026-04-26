"""Redis async client — with graceful fallback when Redis is unavailable."""

import logging
from typing import Any, Optional

logger = logging.getLogger("rihla.redis")

try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

_client: Optional[Any] = None


async def get_redis():
    """Return a connected Redis client, or None if Redis is unavailable."""
    global _client
    if not _REDIS_AVAILABLE:
        return None
    if _client is not None:
        return _client
    try:
        from app.core.config import settings
        _client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await _client.ping()
        logger.info("Redis connected at %s", settings.REDIS_URL)
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — falling back to in-memory queues", exc)
        _client = None
    return _client


def get_redis_sync():
    """Return a synchronous Redis client or a no-op stub when Redis is unavailable."""
    if not _REDIS_AVAILABLE:
        return _RedisStub()
    try:
        import redis as redis_sync
        from app.core.config import settings
        client = redis_sync.from_url(settings.REDIS_URL, decode_responses=False,
                                      socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        return client
    except Exception as exc:
        logger.warning("Redis (sync) unavailable (%s) — using stub", exc)
        return _RedisStub()


class _RedisStub:
    """No-op Redis stub used when Redis is unavailable."""
    def setex(self, *a, **kw): pass
    def get(self, *a, **kw): return None
    def delete(self, *a, **kw): pass
    def set(self, *a, **kw): return False
    def scan(self, cursor=0, match=None, count=None): return (0, [])


async def close_redis() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None

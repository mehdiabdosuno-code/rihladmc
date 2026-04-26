"""Performance monitoring utilities.

Provides:
  - Endpoint timing histogram (in-memory, exposed via /metrics endpoint)
  - Slow query detection decorator
  - Connection pool stats
"""

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("rihla.perf")


@dataclass
class EndpointStats:
    """Aggregated stats for a single endpoint."""
    count: int = 0
    total_ms: float = 0
    max_ms: float = 0
    errors: int = 0
    p95_ms: float = 0
    _recent_times: list = field(default_factory=list)

    def record(self, ms: float, is_error: bool = False):
        self.count += 1
        self.total_ms += ms
        if ms > self.max_ms:
            self.max_ms = ms
        if is_error:
            self.errors += 1
        # Keep last 100 for P95 approximation
        self._recent_times.append(ms)
        if len(self._recent_times) > 100:
            self._recent_times.pop(0)
        # Compute P95
        if len(self._recent_times) >= 5:
            sorted_times = sorted(self._recent_times)
            idx = int(len(sorted_times) * 0.95)
            self.p95_ms = sorted_times[min(idx, len(sorted_times) - 1)]

    @property
    def avg_ms(self) -> float:
        return self.total_ms / max(self.count, 1)

    def to_dict(self) -> dict:
        return {
            "count": self.count,
            "avg_ms": round(self.avg_ms, 1),
            "max_ms": round(self.max_ms, 1),
            "p95_ms": round(self.p95_ms, 1),
            "errors": self.errors,
        }


class PerformanceMonitor:
    """Process-local performance monitor."""

    def __init__(self):
        self._endpoints: dict[str, EndpointStats] = defaultdict(EndpointStats)
        self._slow_threshold_ms: float = 500

    def record(self, path: str, method: str, status_code: int, duration_ms: float):
        key = f"{method} {path}"
        is_error = status_code >= 500
        self._endpoints[key].record(duration_ms, is_error)
        if duration_ms > self._slow_threshold_ms:
            logger.warning("SLOW %s: %dms (status=%d)", key, duration_ms, status_code)

    def get_stats(self) -> dict[str, Any]:
        """Return stats for all endpoints, sorted by avg latency."""
        stats = {k: v.to_dict() for k, v in self._endpoints.items() if v.count > 0}
        sorted_stats = dict(sorted(stats.items(), key=lambda x: x[1]["avg_ms"], reverse=True))
        return {
            "endpoints": sorted_stats,
            "total_requests": sum(v.count for v in self._endpoints.values()),
            "global_avg_ms": round(
                sum(v.total_ms for v in self._endpoints.values()) /
                max(sum(v.count for v in self._endpoints.values()), 1), 1
            ),
        }

    def get_slow_endpoints(self, threshold_ms: float = 200) -> list[dict]:
        """Return endpoints with avg latency above threshold."""
        return [
            {"endpoint": k, **v.to_dict()}
            for k, v in self._endpoints.items()
            if v.avg_ms > threshold_ms and v.count >= 3
        ]


# Singleton
perf_monitor = PerformanceMonitor()


def get_pool_stats(engine) -> dict:
    """Get SQLAlchemy connection pool statistics."""
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "invalid": pool.status(),
    }

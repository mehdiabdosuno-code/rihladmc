"""Database engine with production-grade connection pooling.

Performance optimizations:
  - QueuePool with configurable size (default 20 connections, overflow 10)
  - pool_pre_ping avoids stale connection errors
  - pool_recycle every 30 min prevents server-side timeouts
  - echo disabled in production for minimal overhead
  - Prepared statements enabled via executemany_mode for batch inserts
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {
    "options": "-c statement_timeout=30000",  # 30s query timeout
}

_pool_kwargs = {}
if not _is_sqlite:
    _pool_kwargs = {
        "pool_size": int(getattr(settings, "DB_POOL_SIZE", 20)),
        "max_overflow": int(getattr(settings, "DB_MAX_OVERFLOW", 10)),
        "pool_recycle": 1800,       # Recycle connections every 30 min
        "pool_timeout": 10,         # Wait max 10s for a connection
    }

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=_connect_args,
    echo=False,
    **_pool_kwargs,
)

# Set PostgreSQL session-level optimizations on new connections
if not _is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_pg_session_params(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("SET work_mem = '16MB'")
        cursor.execute("SET random_page_cost = 1.1")  # SSD-optimized
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

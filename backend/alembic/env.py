"""Alembic environment configuration for STOURS Studio."""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
from pathlib import Path

# Add parent directory to path so we can import app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.shared.models import Base

# Import all models so Alembic's autogenerate detects every table
from app.modules.auth.models import User, Role, Permission          # noqa: F401
from app.modules.projects.models import Project                     # noqa: F401
from app.modules.quotations.models import Quotation, QuotationLine  # noqa: F401
from app.modules.transports.models import Transport                  # noqa: F401
from app.modules.menus.models import Menu                            # noqa: F401
from app.modules.references.models import (                          # noqa: F401
    ReferenceCounter, GeneratedReference
)
try:
    from app.modules.invoices.models import Invoice                  # noqa: F401
except ImportError:
    pass
try:
    from app.modules.guides.models import Guide                      # noqa: F401
except ImportError:
    pass

# This is the Alembic Config object
config = context.config

# Set SQLAlchemy URL from app settings
if config.get_section_option("alembic", "sqlalchemy.url") == "driver://user:pass@localhost/dbname":
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Configure logging from ini file
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target_metadata for auto-generating migrations
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""

    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

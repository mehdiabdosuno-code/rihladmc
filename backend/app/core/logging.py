import json
import logging
import logging.config
from typing import Any

from app.core.config import settings


def setup_logging() -> None:
    """Configure structured JSON logging for production and development."""

    log_level = logging.INFO if settings.ENVIRONMENT == "production" else logging.DEBUG

    config: dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(timestamp)s %(name)s %(levelname)s %(message)s",
            },
            "standard": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "json" if settings.ENVIRONMENT == "production" else "standard",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
            "app": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
        },
        "root": {
            "level": log_level,
            "handlers": ["console"],
        },
    }

    logging.config.dictConfig(config)
    logger = logging.getLogger("app")
    logger.info(f"Logging configured for {settings.ENVIRONMENT} environment")

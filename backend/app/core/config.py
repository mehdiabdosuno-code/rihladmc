from pydantic_settings import BaseSettings
from pydantic import model_validator

_INSECURE_DEFAULTS = {
    "change-me-in-production",
    "change-me-in-production-use-env",
}


class Settings(BaseSettings):
    APP_NAME: str = "STOURS Studio"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    JWT_SECRET_KEY: str = "change-me-in-production-use-env"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 1
    DATABASE_URL: str = "postgresql://rihla:rihla_secret_change_me@localhost:5432/rihla_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    # Stripe (B5)
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_PUBLISHABLE_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    # CMI Maroc (B5)
    CMI_MERCHANT_ID: str | None = None
    CMI_STORE_KEY: str | None = None
    CMI_GATEWAY_URL: str = "https://payment.cmi.co.ma/fim/est3Dgate"
    # Microsoft Outlook (B7)
    MS_CLIENT_ID: str | None = None
    MS_CLIENT_SECRET: str | None = None
    MS_TENANT_ID: str = "common"
    # M365 expanded (Mail + SharePoint + Teams)
    MS_REDIRECT_URI: str = "http://localhost:8000/api/m365/oauth/callback"
    MS_SHAREPOINT_SITE: str | None = None  # e.g. contoso.sharepoint.com:/sites/RIHLA
    TEAMS_WEBHOOK_URL: str | None = None
    APP_BASE_URL: str = "http://localhost:5173"
    SENTRY_DSN: str | None = None
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    DEFAULT_CURRENCY: str = "EUR"
    DEFAULT_LOCALE: str = "fr"
    LOG_LEVEL: str = "INFO"
    # Database pool tuning
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10

    @model_validator(mode="after")
    def _reject_insecure_defaults_in_production(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            if self.SECRET_KEY in _INSECURE_DEFAULTS:
                raise ValueError("SECRET_KEY must be set via environment variable in production.")
            if self.JWT_SECRET_KEY in _INSECURE_DEFAULTS:
                raise ValueError("JWT_SECRET_KEY must be set via environment variable in production.")
            if "rihla_secret_change_me" in self.DATABASE_URL:
                raise ValueError("DATABASE_URL contains default password — set it via environment variable.")
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"   # Ignore unknown .env fields (admin_email, app_version, etc.)


settings = Settings()

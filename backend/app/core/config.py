"""Central application configuration. Secrets come from environment only."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./nest.db"
    SECRET_KEY: str = "change-me-to-a-long-random-secret-min-32-chars"
    ACCESS_TOKEN_MINUTES: int = 30
    REFRESH_TOKEN_DAYS: int = 7
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173"
    )
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    BUSINESS_TIMEZONE_DEFAULT: str = "Asia/Kolkata"
    # Public website intake: tenant is ALWAYS resolved server-side from these
    # IDs. The browser's businessId field is ignored, so a forged value can
    # never route a website lead into another tenant.
    PUBLIC_NEST_BUSINESS_ID: str = "nest-library-001"
    PUBLIC_PRIME_BUSINESS_ID: str = "prime-fitness-001"
    PUBLIC_RATE_LIMIT: int = 10
    PUBLIC_RATE_WINDOW_S: int = 600
    PUBLIC_MAX_BODY_BYTES: int = 16 * 1024
    WHATSAPP_PROVIDER: str = "log"
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_ENABLED: bool = False
    SEED_DEMO_PASSWORD: str = "Nest@123"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""Application configuration, loaded from environment variables.

All settings have sensible defaults for local development so the app runs
out of the box. Override via a `.env` file or real env vars in production.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "Signal Clone API"
    debug: bool = True

    # Database — SQLite file in the backend directory by default.
    database_url: str = "sqlite:///./signal_clone.db"

    # Auth (mocked). JWT signing secret + the fixed OTP used for verification.
    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # one week
    mock_otp: str = "123456"

    # Seed demo data on startup if the database is empty (useful on hosts with
    # an ephemeral disk). Safe to leave on — it is a no-op once data exists.
    seed_on_startup: bool = True

    # CORS — comma-separated list of allowed frontend origins, plus an optional
    # regex (e.g. to allow Vercel preview deployments).
    cors_origins: str = "http://localhost:3000"
    cors_origin_regex: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

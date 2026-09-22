from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"
    LOG_LEVEL: str = "INFO"
    API_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "SLAB"
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    MAPS_USER_AGENT: str = "SLAB/0.2 contact@example.com"
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    BACKEND_BASE_URL: str = "http://localhost:8000"
    DATABASE_URL: str = "sqlite:///./slab_local_v2.db"


    JWT_SECRET: str = "local-development-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    PAYMENT_MODE: str = "mock"
    PRESENTATION_MODE: bool = True
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.1.4:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://192.168.1.4:5174",
    ])

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            missing = [
                key
                for key in (
                    "DATABASE_URL",
                    "JWT_SECRET",
                    "STRIPE_SECRET_KEY",
                    "STRIPE_PUBLISHABLE_KEY",
                    "STRIPE_WEBHOOK_SECRET",
                )
                if not getattr(self, key)
            ]
            if missing:
                joined = ", ".join(missing)
                raise ValueError(f"Missing required production configuration: {joined}")

            if "*" in self.CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS cannot contain '*' in production.")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

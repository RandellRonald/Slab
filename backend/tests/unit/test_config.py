import pytest

from app.core.config import Settings


def test_development_uses_local_database_defaults() -> None:
    settings = Settings(ENVIRONMENT="development")

    assert settings.DATABASE_URL


def test_production_requires_jwt_values() -> None:
    with pytest.raises(ValueError, match="Missing required production configuration"):
        Settings(ENVIRONMENT="production")


def test_cors_origins_parse_comma_separated_values() -> None:
    settings = Settings(CORS_ORIGINS="http://localhost:5173, https://slab.example")

    assert settings.CORS_ORIGINS == ["http://localhost:5173", "https://slab.example"]

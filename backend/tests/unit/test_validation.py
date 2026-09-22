import pytest
from pydantic import ValidationError

from app.auth.schemas import RegisterRequest
from app.schemas.profile import ProfileUpdateRequest


def test_register_requires_valid_role() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(email="user@example.com", password="password123", full_name="User", role="owner")


def test_register_requires_strong_minimum_password_length() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(email="user@example.com", password="short", full_name="User", role="customer")


def test_profile_update_allows_partial_payload() -> None:
    payload = ProfileUpdateRequest(full_name="Avery Builder")

    assert payload.model_dump(exclude_unset=True) == {"full_name": "Avery Builder"}

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.provider import AvailabilityBlockCreate, PinVerificationRequest
from app.services.matching_service import distance_km


def test_availability_block_requires_valid_range() -> None:
    now = datetime.now(UTC)

    with pytest.raises(ValidationError):
        AvailabilityBlockCreate(starts_at=now, ends_at=now - timedelta(hours=1))


def test_pin_requires_six_digits() -> None:
    with pytest.raises(ValidationError):
        PinVerificationRequest(pin="12345a")


def test_matching_distance_is_reasonable() -> None:
    distance = distance_km(40.7128, -74.006, 40.7306, -73.9352)

    assert 6 <= distance <= 7

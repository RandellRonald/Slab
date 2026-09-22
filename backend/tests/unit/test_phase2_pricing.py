from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.booking import BookingCreateRequest, BookingEstimateRequest, BookingItemRequest
from app.schemas.customer import Address
from app.services.phase2_service import PricingService


def test_pricing_uses_quantity_duration_operator_and_distance() -> None:
    estimate = PricingService().estimate(
        BookingEstimateRequest(
            distance_km=10,
            items=[
                BookingItemRequest(equipment_type="excavator", quantity=2, duration_hours=8, operator_required=True),
                BookingItemRequest(equipment_type="crane", quantity=1, duration_hours=4, operator_required=False),
            ],
        )
    )

    assert estimate["equipment_subtotal"] == 35360.0
    assert estimate["travel_charge"] == 32.5
    assert estimate["estimated_total"] == 38223.9


def test_booking_rejects_invalid_date_range() -> None:
    now = datetime.now(UTC) + timedelta(days=1)

    with pytest.raises(ValidationError):
        BookingCreateRequest(
            starts_at=now,
            ends_at=now - timedelta(hours=1),
            distance_km=0,
            site_location=Address(line1="100 Site Road", latitude=40, longitude=-74),
            items=[BookingItemRequest(equipment_type="jcb", quantity=1, duration_hours=8, operator_required=True)],
        )

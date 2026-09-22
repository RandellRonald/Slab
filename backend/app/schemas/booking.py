from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.customer import Address

BookingStatus = Literal[
    "pending",
    "payment_pending",
    "confirmed",
    "matching",
    "assigned",
    "provider_en_route",
    "provider_arrived",
    "in_progress",
    "completed",
    "cancelled",
    "disputed",
]


class BookingItemRequest(BaseModel):
    equipment_type: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=1, le=20)
    duration_hours: float = Field(gt=0, le=744)
    operator_required: bool = True


class BookingEstimateRequest(BaseModel):
    items: list[BookingItemRequest] = Field(min_length=1, max_length=10)
    distance_km: float = Field(default=0, ge=0, le=2000)
    site_location: Address | None = None
    is_emergency: bool = False


class BookingCreateRequest(BookingEstimateRequest):
    company_id: UUID | None = None
    project_id: UUID | None = None
    site_location: Address
    starts_at: datetime
    ends_at: datetime
    requirements: str | None = Field(default=None, max_length=3000)
    notes: str | None = Field(default=None, max_length=2000)
    photo_urls: list[str] = Field(default_factory=list, max_length=12)

    @model_validator(mode="after")
    def validate_time_range(self) -> "BookingCreateRequest":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class BookingCancelRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class CustomerPinVerificationRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

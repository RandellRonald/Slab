from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.customer import Address

DocumentStatus = Literal["pending", "approved", "rejected"]
AvailabilityStatus = Literal["available", "unavailable", "maintenance"]


class ProviderStatusUpdate(BaseModel):
    is_online: bool


class ProviderVerificationSubmit(BaseModel):
    personal_details: dict = Field(default_factory=dict)
    contact_details: dict = Field(default_factory=dict)
    address: Address
    equipment_summary: dict = Field(default_factory=dict)


class ProviderDocumentCreate(BaseModel):
    document_type: Literal["rc", "driving_licence", "insurance", "profile_photo", "equipment_photo", "other"]
    storage_path: str = Field(min_length=3, max_length=700)
    storage_bucket: str = Field(default="provider-documents", max_length=80)
    expiry_date: date | None = None
    equipment_id: UUID | None = None


class ProviderDocumentReview(BaseModel):
    status: DocumentStatus
    rejection_reason: str | None = Field(default=None, max_length=1000)


class ProviderEquipmentUpsert(BaseModel):
    equipment_type_slug: str = Field(min_length=2, max_length=80)
    display_name: str = Field(min_length=2, max_length=160)
    registration_number: str | None = Field(default=None, max_length=80)
    identification_number: str | None = Field(default=None, max_length=120)
    status: AvailabilityStatus = "available"
    hourly_rate: float | None = Field(default=None, ge=0)
    daily_rate: float | None = Field(default=None, ge=0)
    monthly_rate: float | None = Field(default=None, ge=0)
    operating_address: Address | None = None
    operating_latitude: float | None = Field(default=None, ge=-90, le=90)
    operating_longitude: float | None = Field(default=None, ge=-180, le=180)
    operating_radius_km: float = Field(default=50, gt=0, le=500)
    photo_urls: list[str] = Field(default_factory=list, max_length=12)
    document_urls: list[str] = Field(default_factory=list, max_length=12)


class AvailabilityBlockCreate(BaseModel):
    equipment_id: UUID | None = None
    starts_at: datetime
    ends_at: datetime
    reason: str | None = Field(default=None, max_length=240)

    @model_validator(mode="after")
    def validate_range(self) -> "AvailabilityBlockCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class ProviderRequestResponse(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class ProviderCustomerMessage(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ProviderLocationUpdate(BaseModel):
    booking_id: UUID | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_meters: float | None = Field(default=None, ge=0)


class PinVerificationRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

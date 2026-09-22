from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class Address(BaseModel):
    label: str | None = Field(default=None, max_length=120)
    line1: str = Field(min_length=1, max_length=240)
    area: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, max_length=6)
    country: str | None = Field(default=None, max_length=80)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("postal_code")
    @classmethod
    def validate_indian_pin(cls, value: str | None) -> str | None:
        if value is not None and not __import__("re").fullmatch(r"[1-9][0-9]{5}", value):
            raise ValueError("PIN Code must be exactly 6 digits and cannot start with 0")
        return value


class SavedLocationCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    address: Address
    is_default: bool = False


class CompanyCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=180)
    business_email: str | None = Field(default=None, max_length=180)
    business_phone: str | None = Field(default=None, max_length=32)
    address: Address | None = None


class ProjectCreate(BaseModel):
    company_id: UUID | None = None
    project_name: str = Field(min_length=1, max_length=180)
    address: Address
    site_contact_name: str | None = Field(default=None, max_length=120)
    site_contact_phone: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    requirements: str | None = Field(default=None, max_length=3000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ProjectUpdate(BaseModel):
    project_name: str | None = Field(default=None, min_length=1, max_length=180)
    address: Address | None = None
    site_contact_name: str | None = Field(default=None, max_length=120)
    site_contact_phone: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    requirements: str | None = Field(default=None, max_length=3000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class ProjectNoteCreate(BaseModel):
    note: str = Field(min_length=3, max_length=2000)
    note_type: Literal["note", "issue", "delay", "danger"] = "note"


class BookingHistoryFilter(BaseModel):
    status: Literal["active", "upcoming", "completed", "all"] = "all"

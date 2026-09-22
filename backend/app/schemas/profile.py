from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    avatar_url: str | None = Field(default=None, max_length=500)


class ProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    role: Literal["customer", "provider", "admin"]
    full_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    avatar_url: str | None = None
    is_active: bool

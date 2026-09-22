from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

AppRole = Literal["customer", "provider", "admin"]


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)
    role: AppRole = "customer"
    phone: str | None = Field(default=None, max_length=32)

    @field_validator("email")
    @classmethod
    def validate_email_shape(cls, value: str) -> str:
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address.")
        return value.strip().lower()


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    expected_role: Literal["customer", "provider", "admin"] | None = None

    @field_validator("email")
    @classmethod
    def validate_email_shape(cls, value: str) -> str:
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address.")
        return value.strip().lower()


class PresentationLoginRequest(BaseModel):
    role: AppRole


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=16)


class LogoutRequest(BaseModel):
    access_token: str | None = None


class AuthenticatedUser(BaseModel):
    user_id: UUID
    profile_id: UUID
    email: str | None = None
    role: AppRole
    full_name: str | None = None
    is_active: bool = True
    joined_at: str | None = None


class AuthSessionResponse(BaseModel):
    user: AuthenticatedUser
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None

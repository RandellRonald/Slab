from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class CreateCheckoutRequest(BaseModel):
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=160)

class MockPaymentRequest(BaseModel):
    payment_method: Literal["upi", "net_banking", "card"] = "upi"
    card_number: str | None = Field(default=None, min_length=12, max_length=23)
    expiry: str | None = Field(default=None, min_length=4, max_length=7)
    cvv: str | None = Field(default=None, min_length=3, max_length=4)
    cardholder_name: str | None = Field(default=None, min_length=2, max_length=120)
    verification_code: str | None = Field(default=None, pattern=r"^[0-9]{6}$")
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=160)


class CheckoutSessionResponse(BaseModel):
    payment_id: UUID
    checkout_url: str
    stripe_checkout_session_id: str
    amount_cents: int
    currency: str


class ChatMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class DisputeCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=3000)


class DisputeAttachmentCreate(BaseModel):
    storage_bucket: str = Field(default="slab-dispute-files", max_length=80)
    storage_path: str = Field(min_length=3, max_length=700)


class DisputeAdminUpdate(BaseModel):
    status: str = Field(pattern="^(pending|under_review|resolved|rejected)$")
    assigned_admin: UUID | None = None
    resolution: str | None = Field(default=None, max_length=3000)

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.auth.dependencies import require_admin, require_customer, require_roles
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response
from app.schemas.payment import (
    ChatMessageCreate,
    CreateCheckoutRequest,
    MockPaymentRequest,
    DisputeAdminUpdate,
    DisputeAttachmentCreate,
    DisputeCreate,
    ReviewCreate,
)
from app.schemas.booking import CustomerPinVerificationRequest
from app.services.payment_service import BookingExperienceService, PaymentService

router = APIRouter()


@router.get("/config")
def stripe_config() -> dict:
    return success_response(PaymentService().stripe_config())


@router.post("/bookings/{booking_id}/checkout")
def create_checkout(booking_id: UUID, payload: CreateCheckoutRequest, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(PaymentService().create_checkout(user, booking_id, payload))

@router.post("/bookings/{booking_id}/mock-pay")
def mock_pay(booking_id: UUID, payload: MockPaymentRequest, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(PaymentService().process_mock_payment(user, booking_id, payload))


@router.get("/bookings/{booking_id}/verification")
def payment_verification_status(booking_id: UUID, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(PaymentService().payment_verification_status(user, booking_id))


@router.get("/bookings/{booking_id}/verification-code")
def presentation_payment_code(booking_id: UUID, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(PaymentService().presentation_payment_code(user, booking_id))


@router.post("/bookings/{booking_id}/verification")
def verify_payment_code(booking_id: UUID, payload: CustomerPinVerificationRequest, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(PaymentService().verify_payment_code(user, booking_id, payload.pin))


@router.get("/bookings/{booking_id}")
def payment_for_booking(booking_id: UUID, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(PaymentService().payment_for_booking(user, booking_id))


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None, alias="Stripe-Signature")) -> dict:
    return success_response(PaymentService().handle_webhook(await request.body(), stripe_signature))


@router.get("/bookings/{booking_id}/chat")
def list_chat(booking_id: UUID, user: AuthenticatedUser = Depends(require_roles("customer", "provider", "admin"))) -> dict:
    return success_response(BookingExperienceService().list_chat(user, booking_id))


@router.post("/bookings/{booking_id}/chat")
def send_chat(booking_id: UUID, payload: ChatMessageCreate, user: AuthenticatedUser = Depends(require_roles("customer", "provider"))) -> dict:
    return success_response(BookingExperienceService().send_chat(user, booking_id, payload.message))


@router.post("/bookings/{booking_id}/chat/read")
def mark_chat_read(booking_id: UUID, user: AuthenticatedUser = Depends(require_roles("customer", "provider"))) -> dict:
    return success_response(BookingExperienceService().mark_chat_read(user, booking_id))


@router.post("/bookings/{booking_id}/review")
def create_review(booking_id: UUID, payload: ReviewCreate, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(BookingExperienceService().create_review(user, booking_id, payload))


@router.post("/bookings/{booking_id}/disputes")
def create_dispute(booking_id: UUID, payload: DisputeCreate, user: AuthenticatedUser = Depends(require_roles("customer", "provider"))) -> dict:
    return success_response(BookingExperienceService().create_dispute(user, booking_id, payload))


@router.post("/disputes/{dispute_id}/attachments")
def add_dispute_attachment(dispute_id: UUID, payload: DisputeAttachmentCreate, user: AuthenticatedUser = Depends(require_roles("customer", "provider"))) -> dict:
    return success_response(BookingExperienceService().add_dispute_attachment(user, dispute_id, payload))


@router.patch("/disputes/{dispute_id}")
def update_dispute(dispute_id: UUID, payload: DisputeAdminUpdate, admin: AuthenticatedUser = Depends(require_admin)) -> dict:
    return success_response(BookingExperienceService().update_dispute(admin, dispute_id, payload))

from datetime import UTC, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import secrets
from typing import Any
from uuid import UUID, uuid4

import stripe

from app.auth.schemas import AuthenticatedUser
from app.core.config import get_settings
from app.core.exceptions import AuthorizationError, ConfigurationError, ConflictError, NotFoundError
from app.database.client import get_service_database_client
from app.database.repositories.base import DatabaseRepository
from app.schemas.payment import CreateCheckoutRequest, DisputeAdminUpdate, DisputeAttachmentCreate, DisputeCreate, ReviewCreate, MockPaymentRequest
from app.services.matching_service import MatchingService


PAYMENT_SUCCESS_EVENTS = {"checkout.session.completed", "payment_intent.succeeded"}
PAYMENT_FAILURE_EVENTS = {"checkout.session.async_payment_failed", "payment_intent.payment_failed"}


class PaymentService:
    def __init__(self, client=None) -> None:
        self.client = client or get_service_database_client()
        self.settings = get_settings()

    def stripe_config(self) -> dict[str, str]:
        return {"publishable_key": self.settings.STRIPE_PUBLISHABLE_KEY, "payment_mode": self.settings.PAYMENT_MODE}

    def process_mock_payment(self, user: AuthenticatedUser, booking_id: UUID, payload: MockPaymentRequest) -> dict[str, Any]:
        if self.settings.ENVIRONMENT == "production" or self.settings.PAYMENT_MODE != "mock":
            raise ConflictError("Presentation payment mode is disabled.")
        if payload.payment_method == "card" and payload.card_number:
            if not payload.card_number.replace(" ", "").isdigit() or len(payload.card_number.replace(" ", "")) not in {16, 19}:
                raise ConflictError("Enter a valid card number.")
        booking = self._booking_for_customer(user, booking_id)
        if self._has_no_slab_fee(booking):
            return self._complete_zero_fee_booking(user, booking_id, booking, payload.idempotency_key or f"emergency-{booking_id}")
        if booking["status"] not in {"pending", "payment_pending"}:
            existing = self.payment_for_booking(user, booking_id)
            if existing and existing.get("status") == "succeeded":
                if booking["status"] == "confirmed":
                    MatchingService(self.client).start_matching_for_booking(booking_id)
                return existing
            raise ConflictError("This booking is no longer awaiting payment.")
        key = payload.idempotency_key or f"presentation-{booking_id}"
        existing = self._payment_by_idempotency(str(booking_id), key)
        if existing and existing.get("status") == "succeeded": return existing
        payment = existing or DatabaseRepository(self.client, "slab_payments").create({"booking_id": str(booking_id), "user_id": str(user.user_id), "amount_cents": self._platform_fee_cents(booking), "currency": "inr", "status": "pending", "idempotency_key": key, "metadata": {"payment_method": payload.payment_method, "mode": "presentation"}})
        reference = f"SLAB-PAY-{str(uuid4()).replace('-', '')[:12].upper()}"
        self._mark_payment(payment, "succeeded", payment_intent_id=reference)
        self._set_booking_status(str(booking_id), str(user.user_id), booking["status"], "confirmed", {"payment_id": payment["id"], "reference": reference, "mode": "presentation"})
        self._issue_job_pin(booking)
        self._notify(str(user.user_id), str(booking_id), "Payment successful", "Your SLAB platform fee has been verified and provider matching has started.", "payment_success")
        MatchingService(self.client).start_matching_for_booking(booking_id)
        result = self.client.table("slab_payments").select("*").eq("id", payment["id"]).maybe_single().execute().data or payment
        result["reference"] = reference
        return result

    def payment_verification_status(self, user: AuthenticatedUser, booking_id: UUID) -> dict[str, Any]:
        booking = self._booking_for_customer(user, booking_id)
        return {
            "required": bool(booking.get("payment_otp_hash") and not booking.get("payment_verified_at")),
            "verified": bool(booking.get("payment_verified_at")),
            "expires_at": booking.get("payment_otp_expires_at"),
        }

    def presentation_payment_code(self, user: AuthenticatedUser, booking_id: UUID) -> dict[str, Any]:
        booking = self._booking_for_customer(user, booking_id)
        if not self.settings.PRESENTATION_MODE or self.settings.ENVIRONMENT == "production":
            raise AuthorizationError("Verification code delivery is unavailable in this environment.")
        if booking.get("payment_verified_at"):
            return {"verified": True}
        code = booking.get("presentation_payment_otp")
        if not code:
            raise ConflictError("A payment verification code is not available for this booking.")
        return {"code": code, "expires_at": booking.get("payment_otp_expires_at")}

    def verify_payment_code(self, user: AuthenticatedUser, booking_id: UUID, pin: str) -> dict[str, Any]:
        booking = self._booking_for_customer(user, booking_id)
        if booking.get("payment_verified_at"):
            return {"verified": True}
        expires_at = booking.get("payment_otp_expires_at")
        if not booking.get("payment_otp_hash") or not expires_at:
            raise ConflictError("Payment verification is not ready for this booking.")
        if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) <= datetime.now(UTC):
            raise ConflictError("This verification code has expired. Return to payment to request a new code.")
        attempts = int(booking.get("payment_otp_attempt_count") or 0)
        if attempts >= 5:
            raise ConflictError("Verification is temporarily locked after repeated failed attempts.")
        if not (self.settings.PRESENTATION_MODE and self.settings.ENVIRONMENT != "production") and not secrets.compare_digest(str(booking["payment_otp_hash"]), self._hash_pin(pin)):
            self.client.table("bookings").update({"payment_otp_attempt_count": attempts + 1, "payment_otp_last_attempt_at": datetime.now(UTC).isoformat()}).eq("id", str(booking_id)).execute()
            raise ConflictError("Invalid verification code.")
        self.client.table("bookings").update({"payment_verified_at": datetime.now(UTC).isoformat(), "payment_otp_attempt_count": 0, "presentation_payment_otp": None}).eq("id", str(booking_id)).execute()
        self._notify(str(user.user_id), str(booking_id), "Payment verification complete", "Your booking is ready for live provider tracking.", "payment_verification")
        return {"verified": True}

    def create_checkout(self, user: AuthenticatedUser, booking_id: UUID, payload: CreateCheckoutRequest) -> dict[str, Any]:
        self._require_stripe()
        booking = self._booking_for_customer(user, booking_id)
        if self._has_no_slab_fee(booking):
            payment = self._complete_zero_fee_booking(user, booking_id, booking, payload.idempotency_key or f"emergency-{booking_id}")
            return {
                "payment_id": payment["id"],
                "checkout_url": f"{self.settings.FRONTEND_BASE_URL}/booking/tracking?booking_id={booking_id}",
                "amount_cents": 0,
                "currency": payment.get("currency", "inr"),
            }
        if booking["status"] not in {"pending", "payment_pending"}:
            raise ConflictError("Only unpaid bookings can start SLAB fee payment.")

        amount_cents = self._platform_fee_cents(booking)
        idempotency_key = payload.idempotency_key or f"booking-{booking_id}-slab-fee"
        existing = self._payment_by_idempotency(str(booking_id), idempotency_key)
        if existing and existing.get("stripe_checkout_session_id"):
            session = stripe.checkout.Session.retrieve(existing["stripe_checkout_session_id"], api_key=self.settings.STRIPE_SECRET_KEY)
            return self._checkout_response(existing, session.url)

        payment = existing or DatabaseRepository(self.client, "slab_payments").create(
            {
                "booking_id": str(booking_id),
                "user_id": str(user.user_id),
                "amount_cents": amount_cents,
                "currency": "usd",
                "status": "pending",
                "idempotency_key": idempotency_key,
                "metadata": {"pricing_version": booking.get("pricing_snapshot", {}).get("pricing_version")},
            }
        )
        self._set_booking_status(str(booking_id), str(user.user_id), booking["status"], "payment_pending", {"payment_id": payment["id"]})

        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": "SLAB booking platform fee"},
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            payment_intent_data={"metadata": {"booking_id": str(booking_id), "payment_id": payment["id"], "scope": "slab_platform_fee"}},
            metadata={"booking_id": str(booking_id), "payment_id": payment["id"], "user_id": str(user.user_id), "scope": "slab_platform_fee"},
            success_url=f"{self.settings.FRONTEND_BASE_URL}/booking/payment/success?booking_id={booking_id}&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{self.settings.FRONTEND_BASE_URL}/booking/payment/cancelled?booking_id={booking_id}",
            idempotency_key=idempotency_key,
            api_key=self.settings.STRIPE_SECRET_KEY,
        )
        updated = self.client.table("slab_payments").update(
            {
                "stripe_checkout_session_id": session.id,
                "stripe_payment_intent_id": session.payment_intent,
                "stripe_customer_id": session.customer,
                "expires_at": datetime.fromtimestamp(session.expires_at, UTC).isoformat() if session.expires_at else None,
            }
        ).eq("id", payment["id"]).execute().data[0]
        return self._checkout_response(updated, session.url)

    def payment_for_booking(self, user: AuthenticatedUser, booking_id: UUID) -> dict[str, Any]:
        self._booking_for_customer(user, booking_id)
        response = self.client.table("slab_payments").select("*").eq("booking_id", str(booking_id)).order("created_at", desc=True).limit(1).execute()
        return response.data[0] if response.data else {}

    def handle_webhook(self, raw_body: bytes, stripe_signature: str | None) -> dict[str, Any]:
        self._require_stripe(webhook=True)
        try:
            event = stripe.Webhook.construct_event(raw_body, stripe_signature, self.settings.STRIPE_WEBHOOK_SECRET)
        except Exception as exc:
            raise AuthorizationError("Invalid Stripe webhook signature.") from exc

        existing_event = self.client.table("stripe_webhook_events").select("id,processing_status").eq("stripe_event_id", event["id"]).maybe_single().execute().data
        if existing_event:
            return {"stripe_event_id": event["id"], "duplicate": True, "status": existing_event["processing_status"]}

        event_row = DatabaseRepository(self.client, "stripe_webhook_events").create(
            {"stripe_event_id": event["id"], "event_type": event["type"], "payload": dict(event), "processing_status": "processing"}
        )
        try:
            result = self._process_stripe_event(event)
            self.client.table("stripe_webhook_events").update(
                {
                    "payment_id": result.get("payment_id"),
                    "booking_id": result.get("booking_id"),
                    "processing_status": "processed",
                    "processed_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", event_row["id"]).execute()
            return {"stripe_event_id": event["id"], **result}
        except Exception as exc:
            self.client.table("stripe_webhook_events").update({"processing_status": "failed", "error": str(exc)}).eq("id", event_row["id"]).execute()
            raise

    def _process_stripe_event(self, event: dict) -> dict[str, Any]:
        event_type = event["type"]
        obj = event["data"]["object"]
        session_id = obj.get("id") if event_type.startswith("checkout.session") else obj.get("metadata", {}).get("checkout_session_id")
        payment_intent_id = obj.get("payment_intent") or obj.get("id")
        metadata = obj.get("metadata", {}) or {}
        payment = self._payment_from_event(session_id, payment_intent_id, metadata)
        if not payment:
            return {"ignored": True}

        booking_id = payment["booking_id"]
        if event_type in PAYMENT_SUCCESS_EVENTS:
            if event_type == "checkout.session.completed" and obj.get("payment_status") != "paid":
                return {"payment_id": payment["id"], "booking_id": booking_id, "status": "pending"}
            self._mark_payment(payment, "succeeded", payment_intent_id=payment_intent_id)
            booking = self._booking(booking_id)
            if booking["status"] in {"payment_pending", "pending", "confirmed"}:
                self._set_booking_status(booking_id, payment["user_id"], booking["status"], "confirmed", {"stripe_event_id": event["id"], "payment_id": payment["id"]})
                self._issue_job_pin(booking)
                self._notify(payment["user_id"], booking_id, "Payment confirmed", "SLAB received the booking fee. Provider matching has started.", "payment_success")
                MatchingService(self.client).start_matching_for_booking(UUID(booking_id))
            return {"payment_id": payment["id"], "booking_id": booking_id, "status": "succeeded"}

        if event_type in PAYMENT_FAILURE_EVENTS:
            self._mark_payment(payment, "failed", failure_reason=obj.get("last_payment_error", {}).get("message") or obj.get("failure_message"), payment_intent_id=payment_intent_id)
            self._notify(payment["user_id"], booking_id, "Payment failed", "The SLAB booking fee payment failed. You can retry from the booking page.", "payment_failed")
            return {"payment_id": payment["id"], "booking_id": booking_id, "status": "failed"}

        if event_type == "checkout.session.expired":
            self._mark_payment(payment, "expired", payment_intent_id=payment_intent_id)
            self._notify(payment["user_id"], booking_id, "Payment session expired", "Your SLAB fee checkout expired. Start payment again to continue.", "payment_expired")
            return {"payment_id": payment["id"], "booking_id": booking_id, "status": "expired"}

        return {"payment_id": payment["id"], "booking_id": booking_id, "ignored": True}

    def _booking_for_customer(self, user: AuthenticatedUser, booking_id: UUID) -> dict:
        booking = DatabaseRepository(self.client, "bookings").get_owned(str(booking_id), str(user.user_id))
        if booking["user_id"] != str(user.user_id):
            raise AuthorizationError()
        return booking

    def _booking(self, booking_id: str) -> dict:
        response = self.client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute()
        if not response.data:
            raise NotFoundError("Booking not found.")
        return response.data

    def _payment_by_idempotency(self, booking_id: str, idempotency_key: str) -> dict | None:
        return self.client.table("slab_payments").select("*").eq("booking_id", booking_id).eq("idempotency_key", idempotency_key).maybe_single().execute().data

    def _payment_from_event(self, session_id: str | None, payment_intent_id: str | None, metadata: dict) -> dict | None:
        payment_id = metadata.get("payment_id")
        query = self.client.table("slab_payments").select("*")
        if payment_id:
            response = query.eq("id", payment_id).maybe_single().execute()
        elif session_id:
            response = query.eq("stripe_checkout_session_id", session_id).maybe_single().execute()
        elif payment_intent_id:
            response = query.eq("stripe_payment_intent_id", payment_intent_id).maybe_single().execute()
        else:
            return None
        return response.data

    def _platform_fee_cents(self, booking: dict) -> int:
        fee = Decimal(str((booking.get("pricing_snapshot") or {}).get("platform_fee") or 0))
        cents = int((fee * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        if cents <= 0:
            raise ConflictError("Booking has no SLAB platform fee to collect.")
        return cents

    def _has_no_slab_fee(self, booking: dict) -> bool:
        pricing = booking.get("pricing_snapshot") or {}
        return Decimal(str(pricing.get("platform_fee") or 0)) == 0 and bool(pricing.get("is_emergency"))

    def _complete_zero_fee_booking(self, user: AuthenticatedUser, booking_id: UUID, booking: dict, idempotency_key: str) -> dict[str, Any]:
        existing = self._payment_by_idempotency(str(booking_id), idempotency_key)
        payment = existing or DatabaseRepository(self.client, "slab_payments").create(
            {
                "booking_id": str(booking_id),
                "user_id": str(user.user_id),
                "amount_cents": 0,
                "currency": "inr",
                "status": "pending",
                "idempotency_key": idempotency_key,
                "metadata": {"scope": "slab_emergency_booking_fee", "note": "Emergency booking fee waived"},
            }
        )
        if payment.get("status") != "succeeded":
            self._mark_payment(payment, "succeeded", payment_intent_id=f"SLAB-EMERGENCY-FEE-0-{str(uuid4()).replace('-', '')[:8].upper()}")
        if booking["status"] in {"pending", "payment_pending"}:
            self._set_booking_status(str(booking_id), str(user.user_id), booking["status"], "confirmed", {"payment_id": payment["id"], "mode": "emergency_fee_waived"})
            booking = self._booking(str(booking_id))
        self._issue_job_pin(booking)
        MatchingService(self.client).start_matching_for_booking(booking_id)
        result = self.client.table("slab_payments").select("*").eq("id", payment["id"]).maybe_single().execute().data or payment
        result["reference"] = result.get("stripe_payment_intent_id")
        return result

    def _issue_payment_verification(self, booking: dict) -> None:
        if booking.get("payment_verified_at") or booking.get("payment_otp_hash"):
            return
        code = f"{secrets.randbelow(1_000_000):06d}"
        values = {
            "payment_otp_hash": self._hash_pin(code),
            "payment_otp_expires_at": (datetime.now(UTC) + timedelta(minutes=15)).isoformat(),
            "payment_otp_attempt_count": 0,
        }
        if self.settings.PRESENTATION_MODE and self.settings.ENVIRONMENT != "production":
            values["presentation_payment_otp"] = code
        self.client.table("bookings").update(values).eq("id", booking["id"]).execute()

    def _issue_job_pin(self, booking: dict) -> None:
        if booking.get("job_pin_hash"):
            return
        pin = f"{secrets.randbelow(1_000_000):06d}"
        self.client.table("bookings").update(
            {"job_pin_hash": self._hash_job_pin(pin), "job_pin_display": pin, "job_pin_generated_at": datetime.now(UTC).isoformat()}
        ).eq("id", booking["id"]).execute()

    def _hash_job_pin(self, pin: str) -> str:
        secret = self.settings.JWT_SECRET or "development-only-pin-secret"
        return hashlib.sha256(f"{secret}:{pin}".encode("utf-8")).hexdigest()

    def _hash_pin(self, pin: str) -> str:
        secret = self.settings.JWT_SECRET or "development-only-pin-secret"
        return hashlib.sha256(f"payment-verification:{secret}:{pin}".encode("utf-8")).hexdigest()

    def _checkout_response(self, payment: dict, checkout_url: str | None) -> dict[str, Any]:
        if not checkout_url:
            raise ConflictError("Stripe checkout URL is no longer available. Please retry payment.")
        return {
            "payment_id": payment["id"],
            "checkout_url": checkout_url,
            "stripe_checkout_session_id": payment["stripe_checkout_session_id"],
            "amount_cents": payment["amount_cents"],
            "currency": payment["currency"],
        }

    def _mark_payment(self, payment: dict, status: str, failure_reason: str | None = None, payment_intent_id: str | None = None) -> None:
        values = {"status": status, "failure_reason": failure_reason, "stripe_payment_intent_id": payment_intent_id or payment.get("stripe_payment_intent_id")}
        if status == "succeeded":
            values["paid_at"] = datetime.now(UTC).isoformat()
        if status in {"cancelled", "expired"}:
            values["cancelled_at"] = datetime.now(UTC).isoformat()
        self.client.table("slab_payments").update(values).eq("id", payment["id"]).execute()

    def _set_booking_status(self, booking_id: str, actor_user_id: str, from_status: str, to_status: str, metadata: dict) -> None:
        if from_status != to_status:
            self.client.table("bookings").update({"status": to_status}).eq("id", booking_id).execute()
            self.client.table("booking_status_history").insert(
                {"booking_id": booking_id, "actor_user_id": actor_user_id, "from_status": from_status, "to_status": to_status, "metadata": metadata}
            ).execute()

    def _notify(self, user_id: str, booking_id: str, title: str, body: str, notification_type: str) -> None:
        self.client.table("notifications").insert(
            {"recipient_user_id": user_id, "booking_id": booking_id, "notification_type": notification_type, "title": title, "body": body, "channel": "app"}
        ).execute()

    def _require_stripe(self, webhook: bool = False) -> None:
        missing = ["STRIPE_SECRET_KEY"] if not self.settings.STRIPE_SECRET_KEY else []
        if webhook and not self.settings.STRIPE_WEBHOOK_SECRET:
            missing.append("STRIPE_WEBHOOK_SECRET")
        if missing:
            raise ConfigurationError(f"Missing Stripe configuration: {', '.join(missing)}.")


class BookingExperienceService:
    def __init__(self, client=None) -> None:
        self.client = client or get_service_database_client()

    def list_chat(self, user: AuthenticatedUser, booking_id: UUID) -> list[dict]:
        self._booking_participant(user, booking_id)
        return self.client.table("booking_chat_messages").select("*").eq("booking_id", str(booking_id)).order("created_at").execute().data or []

    def send_chat(self, user: AuthenticatedUser, booking_id: UUID, message: str) -> dict:
        booking = self._booking_participant(user, booking_id)
        receiver_id = self._chat_receiver(user, booking)
        row = DatabaseRepository(self.client, "booking_chat_messages").create(
            {"booking_id": str(booking_id), "sender_id": str(user.user_id), "receiver_id": receiver_id, "message": message}
        )
        self._notify(receiver_id, str(booking_id), "New chat message", message, "new_chat_message")
        return row

    def mark_chat_read(self, user: AuthenticatedUser, booking_id: UUID) -> dict:
        self._booking_participant(user, booking_id)
        response = self.client.table("booking_chat_messages").update({"read_at": datetime.now(UTC).isoformat()}).eq("booking_id", str(booking_id)).eq("receiver_id", str(user.user_id)).is_("read_at", "null").execute()
        return {"updated": len(response.data or [])}

    def create_review(self, user: AuthenticatedUser, booking_id: UUID, payload: ReviewCreate) -> dict:
        booking = DatabaseRepository(self.client, "bookings").get_owned(str(booking_id), str(user.user_id))
        if booking["status"] != "completed":
            raise ConflictError("Only completed bookings can be reviewed.")
        assignment = self._assignment(str(booking_id))
        review = DatabaseRepository(self.client, "booking_reviews").create(
            {
                "booking_id": str(booking_id),
                "customer_user_id": str(user.user_id),
                "provider_user_id": assignment["provider_user_id"],
                "rating": payload.rating,
                "comment": payload.comment,
            }
        )
        self._update_provider_rating(assignment["provider_user_id"])
        self._notify(assignment["provider_user_id"], str(booking_id), "New customer review", "A customer submitted a post-job review.", "review_created")
        return review

    def create_dispute(self, user: AuthenticatedUser, booking_id: UUID, payload: DisputeCreate) -> dict:
        booking = self._booking_participant(user, booking_id)
        assignment = self._assignment(str(booking_id), required=False)
        provider_id = assignment.get("provider_user_id") if assignment else None
        customer_id = booking["user_id"]
        dispute = DatabaseRepository(self.client, "disputes").create(
            {
                "booking_id": str(booking_id),
                "customer_id": customer_id,
                "provider_id": provider_id,
                "reason": payload.reason,
                "description": payload.description,
            }
        )
        self.client.table("bookings").update({"status": "disputed"}).eq("id", str(booking_id)).execute()
        self.client.table("booking_status_history").insert(
            {"booking_id": str(booking_id), "actor_user_id": str(user.user_id), "from_status": booking["status"], "to_status": "disputed", "metadata": {"dispute_id": dispute["id"]}}
        ).execute()
        return dispute

    def add_dispute_attachment(self, user: AuthenticatedUser, dispute_id: UUID, payload: DisputeAttachmentCreate) -> dict:
        dispute = self.client.table("disputes").select("*").eq("id", str(dispute_id)).maybe_single().execute().data
        if not dispute or str(user.user_id) not in {dispute["customer_id"], dispute.get("provider_id")}:
            raise AuthorizationError()
        return DatabaseRepository(self.client, "dispute_attachments").create(
            {"dispute_id": str(dispute_id), "uploaded_by": str(user.user_id), "storage_bucket": payload.storage_bucket, "storage_path": payload.storage_path}
        )

    def update_dispute(self, admin: AuthenticatedUser, dispute_id: UUID, payload: DisputeAdminUpdate) -> dict:
        if admin.role != "admin":
            raise AuthorizationError("Only admins can update disputes.")
        values = payload.model_dump(exclude_none=True)
        if payload.status in {"resolved", "rejected"}:
            values["resolved_at"] = datetime.now(UTC).isoformat()
        response = self.client.table("disputes").update(values).eq("id", str(dispute_id)).execute()
        if not response.data:
            raise NotFoundError("Dispute not found.")
        return response.data[0]

    def _booking_participant(self, user: AuthenticatedUser, booking_id: UUID) -> dict:
        booking = self.client.table("bookings").select("*").eq("id", str(booking_id)).maybe_single().execute().data
        if not booking:
            raise NotFoundError("Booking not found.")
        assignment = self._assignment(str(booking_id), required=False)
        if user.role != "admin" and str(user.user_id) not in {booking["user_id"], assignment.get("provider_user_id") if assignment else None}:
            raise AuthorizationError()
        return booking

    def _chat_receiver(self, user: AuthenticatedUser, booking: dict) -> str:
        assignment = self._assignment(booking["id"])
        if str(user.user_id) == booking["user_id"]:
            return assignment["provider_user_id"]
        if str(user.user_id) == assignment["provider_user_id"]:
            return booking["user_id"]
        raise AuthorizationError()

    def _assignment(self, booking_id: str, required: bool = True) -> dict:
        response = self.client.table("booking_assignments").select("*").eq("booking_id", booking_id).maybe_single().execute()
        if required and not response.data:
            raise ConflictError("Booking is not assigned to a provider yet.")
        return response.data or {}

    def _update_provider_rating(self, provider_user_id: str) -> None:
        reviews = self.client.table("booking_reviews").select("rating").eq("provider_user_id", provider_user_id).eq("moderation_status", "approved").execute().data or []
        count = len(reviews)
        average = round(sum(item["rating"] for item in reviews) / count, 2) if count else 0
        self.client.table("providers").update({"rating_average": average, "rating_count": count}).eq("user_id", provider_user_id).execute()

    def _notify(self, user_id: str, booking_id: str, title: str, body: str, notification_type: str) -> None:
        self.client.table("notifications").insert(
            {"recipient_user_id": user_id, "booking_id": booking_id, "notification_type": notification_type, "title": title, "body": body, "channel": "app"}
        ).execute()


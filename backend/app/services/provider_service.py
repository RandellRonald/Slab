import hashlib
import secrets
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.auth.schemas import AuthenticatedUser
from app.core.config import get_settings
from app.core.exceptions import AuthorizationError, ConflictError, NotFoundError
from app.database.client import get_service_database_client
from app.database.local import SessionLocal, get_user_by_id
from app.database.repositories.base import DatabaseRepository
from app.schemas.provider import (
    AvailabilityBlockCreate,
    PinVerificationRequest,
    ProviderCustomerMessage,
    ProviderDocumentCreate,
    ProviderDocumentReview,
    ProviderEquipmentUpsert,
    ProviderLocationUpdate,
    ProviderRequestResponse,
    ProviderStatusUpdate,
    ProviderVerificationSubmit,
)


ACTIVE_STATUSES = {"assigned", "provider_en_route", "provider_arrived", "in_progress", "on_break"}
COMPLETED_STATUSES = {"completed", "cancelled", "disputed"}


class ProviderService:
    def __init__(self, client=None) -> None:
        self.client = client or get_service_database_client()

    def dashboard(self, user: AuthenticatedUser) -> dict[str, Any]:
        provider = self._provider_row(str(user.user_id))
        verification = self._maybe_one("provider_verifications", "provider_user_id", str(user.user_id))
        equipment = DatabaseRepository(self.client, "provider_equipment").list_for_user(str(user.user_id), "provider_user_id")
        requests = DatabaseRepository(self.client, "provider_booking_requests").list_for_user(str(user.user_id), "provider_user_id")
        assignments = DatabaseRepository(self.client, "booking_assignments").list_for_user(str(user.user_id), "provider_user_id")
        notifications = DatabaseRepository(self.client, "notifications").list_for_user(str(user.user_id), "recipient_user_id")

        pending = [self._request_view(item) for item in requests if item.get("status") == "pending"]
        instant_requests = [item for item in pending if not self._is_scheduled(item.get("booking"))]
        scheduled_requests = [item for item in pending if self._is_scheduled(item.get("booking"))]
        scheduled_work = [self._job_view(item) for item in assignments if self._is_scheduled_assignment(item)]
        self._queue_scheduled_reminders(user, scheduled_work)
        return {
            "provider": provider,
            "verification": verification,
            "primary_equipment": equipment[0] if equipment else None,
            "equipment_count": 1 if equipment else 0,
            "pending_requests": pending,
            "instant_requests": instant_requests,
            "scheduled_requests": scheduled_requests,
            "scheduled_work": scheduled_work,
            "active_jobs": [self._job_view(item) for item in assignments if self._booking_status(item.get("booking_id")) in ACTIVE_STATUSES],
            "completed_jobs": [self._job_view(item) for item in assignments if self._booking_status(item.get("booking_id")) in COMPLETED_STATUSES],
            "earnings": self._earnings(assignments),
            "notifications": notifications[:20],
        }

    def update_online_status(self, user: AuthenticatedUser, payload: ProviderStatusUpdate) -> dict:
        response = self.client.table("providers").update({"is_online": payload.is_online}).eq("user_id", str(user.user_id)).execute()
        if not response.data:
            raise NotFoundError("Provider profile not found.")
        return response.data[0]

    def submit_verification(self, user: AuthenticatedUser, payload: ProviderVerificationSubmit) -> dict:
        existing = self._maybe_one("provider_verifications", "provider_user_id", str(user.user_id))
        values = {
            "provider_user_id": str(user.user_id),
            "provider_profile_id": str(user.profile_id),
            "status": "pending",
            "personal_details": payload.personal_details,
            "contact_details": payload.contact_details,
            "address": payload.address.model_dump(),
            "equipment_summary": payload.equipment_summary,
            "rejection_reason": None,
            "submitted_at": datetime.now(UTC).isoformat(),
        }
        if existing:
            return DatabaseRepository(self.client, "provider_verifications").update_owned(existing["id"], str(user.user_id), values, "provider_user_id")
        return DatabaseRepository(self.client, "provider_verifications").create(values)

    def create_document(self, user: AuthenticatedUser, payload: ProviderDocumentCreate) -> dict:
        if payload.equipment_id:
            DatabaseRepository(self.client, "provider_equipment").get_owned(str(payload.equipment_id), str(user.user_id), "provider_user_id")
        verification = self._maybe_one("provider_verifications", "provider_user_id", str(user.user_id))
        return DatabaseRepository(self.client, "provider_documents").create(
            {
                "provider_user_id": str(user.user_id),
                "verification_id": verification["id"] if verification else None,
                "equipment_id": str(payload.equipment_id) if payload.equipment_id else None,
                "document_type": payload.document_type,
                "storage_bucket": payload.storage_bucket,
                "storage_path": payload.storage_path,
                "expiry_date": payload.expiry_date.isoformat() if payload.expiry_date else None,
                "status": "pending",
                "rejection_reason": None,
            }
        )

    def list_documents(self, user: AuthenticatedUser) -> list[dict]:
        return DatabaseRepository(self.client, "provider_documents").list_for_user(str(user.user_id), "provider_user_id")

    def review_document(self, admin: AuthenticatedUser, document_id: UUID, payload: ProviderDocumentReview) -> dict:
        if admin.role != "admin":
            raise AuthorizationError("Only admins can review provider documents.")
        response = self.client.table("provider_documents").update(
            {
                "status": payload.status,
                "rejection_reason": payload.rejection_reason if payload.status == "rejected" else None,
                "reviewed_by": str(admin.user_id),
                "reviewed_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", str(document_id)).execute()
        if not response.data:
            raise NotFoundError("Provider document not found.")
        return response.data[0]

    def list_equipment(self, user: AuthenticatedUser) -> list[dict]:
        return DatabaseRepository(self.client, "provider_equipment").list_for_user(str(user.user_id), "provider_user_id")

    def create_equipment(self, user: AuthenticatedUser, payload: ProviderEquipmentUpsert) -> dict:
        if DatabaseRepository(self.client, "provider_equipment").list_for_user(str(user.user_id), "provider_user_id"):
            raise ConflictError("A provider can manage one primary equipment profile.")
        return DatabaseRepository(self.client, "provider_equipment").create({"provider_user_id": str(user.user_id), **self._equipment_values(payload)})

    def update_equipment(self, user: AuthenticatedUser, equipment_id: UUID, payload: ProviderEquipmentUpsert) -> dict:
        return DatabaseRepository(self.client, "provider_equipment").update_owned(
            str(equipment_id),
            str(user.user_id),
            self._equipment_values(payload),
            "provider_user_id",
        )

    def remove_equipment(self, user: AuthenticatedUser, equipment_id: UUID) -> dict:
        return DatabaseRepository(self.client, "provider_equipment").update_owned(
            str(equipment_id),
            str(user.user_id),
            {"is_active": False, "status": "unavailable"},
            "provider_user_id",
        )

    def list_availability(self, user: AuthenticatedUser) -> list[dict]:
        return DatabaseRepository(self.client, "provider_availability_blocks").list_for_user(str(user.user_id), "provider_user_id")

    def block_availability(self, user: AuthenticatedUser, payload: AvailabilityBlockCreate) -> dict:
        if payload.equipment_id:
            DatabaseRepository(self.client, "provider_equipment").get_owned(str(payload.equipment_id), str(user.user_id), "provider_user_id")
        return DatabaseRepository(self.client, "provider_availability_blocks").create(
            {
                "provider_user_id": str(user.user_id),
                "equipment_id": str(payload.equipment_id) if payload.equipment_id else None,
                "starts_at": payload.starts_at.isoformat(),
                "ends_at": payload.ends_at.isoformat(),
                "reason": payload.reason,
            }
        )

    def list_requests(self, user: AuthenticatedUser) -> list[dict]:
        requests = DatabaseRepository(self.client, "provider_booking_requests").list_for_user(str(user.user_id), "provider_user_id")
        return [self._request_view(item) for item in requests]

    def accept_request(self, user: AuthenticatedUser, request_id: UUID) -> dict:
        self._ensure_verified_provider(user)
        request = DatabaseRepository(self.client, "provider_booking_requests").get_owned(str(request_id), str(user.user_id), "provider_user_id")
        if request["status"] != "pending":
            raise ConflictError("Only pending requests can be accepted.")
        booking = self.client.table("bookings").select("*").eq("id", request["booking_id"]).maybe_single().execute().data
        if not booking:
            raise NotFoundError("Booking not found.")
        if booking["status"] not in {"matching", "confirmed"}:
            raise ConflictError("This booking is no longer available for assignment.")
        existing_assignment = self.client.table("booking_assignments").select("*").eq("booking_id", request["booking_id"]).maybe_single().execute().data
        if existing_assignment:
            raise ConflictError("Another provider has already accepted this booking.")
        DatabaseRepository(self.client, "provider_booking_requests").update_owned(
            str(request_id),
            str(user.user_id),
            {"status": "accepted", "responded_at": datetime.now(UTC).isoformat()},
            "provider_user_id",
        )
        assignment = DatabaseRepository(self.client, "booking_assignments").create(
            {
                "booking_id": request["booking_id"],
                "provider_user_id": str(user.user_id),
                "equipment_id": request.get("equipment_id"),
                "status": "assigned",
                "estimated_amount": request.get("estimated_amount"),
                "distance_km": request.get("distance_km"),
                "eta_minutes": request.get("eta_minutes"),
                "assigned_at": datetime.now(UTC).isoformat(),
            }
        )
        self._update_booking_status(request["booking_id"], str(user.user_id), booking["status"], "assigned", {"provider_request_id": str(request_id), "assignment_id": assignment["id"]})
        for competing in self.client.table("provider_booking_requests").select("*").eq("booking_id", request["booking_id"]).eq("status", "pending").execute().data or []:
            if competing["id"] != str(request_id):
                self.client.table("provider_booking_requests").update({"status": "expired", "responded_at": datetime.now(UTC).isoformat()}).eq("id", competing["id"]).execute()
        pin_hash = booking.get("job_pin_hash")
        if not pin_hash:
            pin = self._generate_pin()
            pin_hash = self._hash_pin(pin)
            self.client.table("bookings").update({"job_pin_hash": pin_hash, "job_pin_display": pin, "job_pin_generated_at": datetime.now(UTC).isoformat()}).eq("id", booking["id"]).execute()
        assignment = self.client.table("booking_assignments").update({"customer_pin_hash": pin_hash}).eq("id", assignment["id"]).execute().data[0]
        if booking:
            self.client.table("notifications").insert(
                {
                    "recipient_user_id": booking["user_id"],
                    "booking_id": assignment["booking_id"],
                    "title": "Provider assigned",
                    "body": "Your SLAB job PIN is available in live tracking. Share it only after the provider arrives.",
                    "channel": "app",
                    "metadata": {"type": "customer_pin"},
                }
            ).execute()
        return assignment

    def reject_request(self, user: AuthenticatedUser, request_id: UUID, payload: ProviderRequestResponse) -> dict:
        request = DatabaseRepository(self.client, "provider_booking_requests").get_owned(str(request_id), str(user.user_id), "provider_user_id")
        if request["status"] != "pending":
            raise ConflictError("Only pending requests can be rejected.")
        return DatabaseRepository(self.client, "provider_booking_requests").update_owned(
            str(request_id),
            str(user.user_id),
            {"status": "rejected", "responded_at": datetime.now(UTC).isoformat(), "response_reason": payload.reason},
            "provider_user_id",
        )

    def list_jobs(self, user: AuthenticatedUser) -> dict:
        assignments = DatabaseRepository(self.client, "booking_assignments").list_for_user(str(user.user_id), "provider_user_id")
        return {
            "active": [self._job_view(item) for item in assignments if self._booking_status(item.get("booking_id")) in ACTIVE_STATUSES],
            "upcoming": [self._job_view(item) for item in assignments if self._booking_status(item.get("booking_id")) in {"assigned", "provider_en_route"}],
            "completed": [self._job_view(item) for item in assignments if self._booking_status(item.get("booking_id")) in COMPLETED_STATUSES],
        }

    def job_detail(self, user: AuthenticatedUser, booking_id: UUID) -> dict:
        assignment = self._assignment_for_booking(user, booking_id)
        return self._job_view(assignment)

    def transition_job(self, user: AuthenticatedUser, booking_id: UUID, action: str, payload: PinVerificationRequest | None = None) -> dict:
        assignment = self._assignment_for_booking(user, booking_id)
        current_status = self._booking_status(str(booking_id))
        transitions = {
            "en-route": ("assigned", "provider_en_route", "en_route_at"),
            "arrived": ("provider_en_route", "provider_arrived", "arrived_at"),
            "start": ("provider_arrived", "in_progress", "started_at"),
            "complete": ("in_progress", "completed", "completed_at"),
            "break": ("in_progress", "on_break", "break_started_at"),
            "resume": ("on_break", "in_progress", "resumed_at"),
        }
        if action == "verify-pin":
            if not payload or not assignment.get("customer_pin_hash"):
                raise AuthorizationError("Invalid customer PIN.")
            if int(assignment.get("pin_attempt_count") or 0) >= 5:
                raise ConflictError("PIN verification is temporarily locked after repeated failed attempts.")
            presentation = get_settings().PRESENTATION_MODE and get_settings().ENVIRONMENT != "production"
            if not presentation and not secrets.compare_digest(assignment["customer_pin_hash"], self._hash_pin(payload.pin)):
                self.client.table("booking_assignments").update(
                    {
                        "pin_attempt_count": int(assignment.get("pin_attempt_count") or 0) + 1,
                        "last_pin_attempt_at": datetime.now(UTC).isoformat(),
                    }
                ).eq("id", assignment["id"]).execute()
                raise AuthorizationError("Invalid customer PIN.")
            return DatabaseRepository(self.client, "booking_assignments").update_owned(
                assignment["id"],
                str(user.user_id),
                {"pin_verified_at": datetime.now(UTC).isoformat(), "pin_attempt_count": 0, "last_pin_attempt_at": datetime.now(UTC).isoformat()},
                "provider_user_id",
            )

        expected, next_status, assignment_field = transitions[action]
        if current_status != expected:
            raise ConflictError(f"Booking must be {expected} before {action}.")
        if action == "start" and not assignment.get("pin_verified_at"):
            raise ConflictError("Customer PIN must be verified before starting the job.")

        self._update_booking_status(str(booking_id), str(user.user_id), current_status, next_status, {"action": action})
        updated = DatabaseRepository(self.client, "booking_assignments").update_owned(
            assignment["id"],
            str(user.user_id),
            {assignment_field: datetime.now(UTC).isoformat()},
            "provider_user_id",
        )
        if action == "complete":
            booking = self.client.table("bookings").select("user_id").eq("id", str(booking_id)).maybe_single().execute().data
            if booking:
                self.client.table("job_completion_records").upsert(
                    {
                        "booking_id": str(booking_id),
                        "provider_user_id": str(user.user_id),
                        "customer_user_id": booking["user_id"],
                        "metadata": {"assignment_id": assignment["id"]},
                    },
                    on_conflict="booking_id",
                ).execute()
                self._notify(booking["user_id"], str(booking_id), "Job completed", "Your provider marked the SLAB job complete.", "job_completed")
                self._notify(str(user.user_id), str(booking_id), "Job completed", "The booking has been completed and recorded.", "job_completed")
        return updated

    def update_location(self, user: AuthenticatedUser, payload: ProviderLocationUpdate) -> dict:
        return DatabaseRepository(self.client, "provider_locations").create(
            {
                "provider_user_id": str(user.user_id),
                "booking_id": str(payload.booking_id) if payload.booking_id else None,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "accuracy_meters": payload.accuracy_meters,
                "recorded_at": datetime.now(UTC).isoformat(),
            }
        )

    def message_customer(self, user: AuthenticatedUser, booking_id: UUID, payload: ProviderCustomerMessage) -> dict:
        self._assignment_for_booking(user, booking_id)
        booking = self.client.table("bookings").select("user_id").eq("id", str(booking_id)).maybe_single().execute().data
        if not booking:
            raise NotFoundError("Booking not found.")
        return DatabaseRepository(self.client, "notifications").create(
            {
                "recipient_user_id": booking["user_id"],
                "booking_id": str(booking_id),
                "title": "Message from your provider",
                "body": payload.message,
                "channel": "app",
                "metadata": {"type": "provider_message", "provider_user_id": str(user.user_id)},
            }
        )

    def notifications(self, user: AuthenticatedUser) -> list[dict]:
        return DatabaseRepository(self.client, "notifications").list_for_user(str(user.user_id), "recipient_user_id")

    def admin_review_queue(self, admin: AuthenticatedUser) -> dict:
        if admin.role != "admin":
            raise AuthorizationError("Only admins can review providers.")
        verifications = self.client.table("provider_verifications").select("*").eq("status", "pending").execute().data or []
        documents = self.client.table("provider_documents").select("*").eq("status", "pending").execute().data or []
        return {"verifications": verifications, "documents": documents}

    def review_verification(self, admin: AuthenticatedUser, verification_id: UUID, payload: ProviderDocumentReview) -> dict:
        if admin.role != "admin":
            raise AuthorizationError("Only admins can review providers.")
        response = self.client.table("provider_verifications").update(
            {
                "status": payload.status,
                "rejection_reason": payload.rejection_reason if payload.status == "rejected" else None,
                "reviewed_by": str(admin.user_id),
                "reviewed_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", str(verification_id)).execute()
        if not response.data:
            raise NotFoundError("Provider verification not found.")
        verification = response.data[0]
        if payload.status == "approved":
            self.client.table("providers").update({"verification_status": "approved"}).eq("user_id", verification["provider_user_id"]).execute()
        return verification

    def _ensure_verified_provider(self, user: AuthenticatedUser) -> None:
        verification = self._maybe_one("provider_verifications", "provider_user_id", str(user.user_id))
        provider = self._provider_row(str(user.user_id))
        if not verification or verification.get("status") != "approved" or provider.get("verification_status") != "approved":
            raise AuthorizationError("Provider must be approved before receiving or managing jobs.")

    def _equipment_values(self, payload: ProviderEquipmentUpsert) -> dict:
        values = payload.model_dump(exclude_none=True)
        if payload.operating_address:
            values["operating_address"] = payload.operating_address.model_dump()
        return values

    def _provider_row(self, user_id: str) -> dict:
        provider = self._maybe_one("providers", "user_id", user_id)
        if not provider:
            raise NotFoundError("Provider profile not found.")
        return provider

    def _generate_pin(self) -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    def _hash_pin(self, pin: str) -> str:
        secret = get_settings().JWT_SECRET or "development-only-pin-secret"
        return hashlib.sha256(f"{secret}:{pin}".encode("utf-8")).hexdigest()

    def _maybe_one(self, table: str, column: str, value: str) -> dict | None:
        response = self.client.table(table).select("*").eq(column, value).maybe_single().execute()
        return response.data

    def _booking_status(self, booking_id: str | None) -> str | None:
        if not booking_id:
            return None
        response = self.client.table("bookings").select("status").eq("id", booking_id).maybe_single().execute()
        return response.data.get("status") if response.data else None

    def _job_view(self, assignment: dict) -> dict:
        booking_id = assignment.get("booking_id")
        booking = self.client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute().data if booking_id else None
        items = self.client.table("booking_items").select("*").eq("booking_id", booking_id).execute().data if booking_id else []
        customer = self._maybe_one("customers", "user_id", booking["user_id"]) if booking else None
        profile = self._maybe_one("profiles", "user_id", booking["user_id"]) if booking else None
        if profile:
            customer = {
                **(customer or {}),
                "full_name": profile.get("full_name"),
                "email": profile.get("email"),
                "phone": (customer or {}).get("phone") or profile.get("phone"),
            }
        if booking:
            with SessionLocal() as session:
                auth_user = get_user_by_id(session, booking["user_id"])
            if auth_user:
                customer = {**(customer or {}), "full_name": auth_user.full_name, "email": auth_user.email}
        return {
            **assignment,
            "booking": self._provider_booking_view(booking),
            "items": items or [],
            "customer": customer,
        }

    def _request_view(self, request: dict) -> dict:
        booking = self.client.table("bookings").select("*").eq("id", request["booking_id"]).maybe_single().execute().data
        profile = self._maybe_one("profiles", "user_id", booking["user_id"]) if booking else None
        items = self.client.table("booking_items").select("*").eq("booking_id", request["booking_id"]).execute().data or []
        equipment = self.client.table("provider_equipment").select("*").eq("id", request.get("equipment_id")).maybe_single().execute().data if request.get("equipment_id") else None
        return {
            **request,
            "booking": self._provider_booking_view(booking),
            "customer": {"full_name": profile.get("full_name"), "email": profile.get("email")} if profile else None,
            "items": items,
            "equipment": equipment,
        }

    def _is_scheduled(self, booking: dict | None) -> bool:
        if not booking or not booking.get("starts_at"):
            return False
        try:
            return datetime.fromisoformat(str(booking["starts_at"]).replace("Z", "+00:00")) > datetime.now(UTC)
        except ValueError:
            return False

    @staticmethod
    def _provider_booking_view(booking: dict | None) -> dict | None:
        if not booking:
            return booking
        hidden = {"job_pin_display", "job_pin_hash", "payment_otp_hash", "presentation_payment_otp"}
        return {key: value for key, value in booking.items() if key not in hidden}

    def _is_scheduled_assignment(self, assignment: dict) -> bool:
        booking = self.client.table("bookings").select("*").eq("id", assignment.get("booking_id")).maybe_single().execute().data
        return bool(booking and booking.get("status") in {"assigned", "provider_en_route"} and self._is_scheduled(booking))

    def _queue_scheduled_reminders(self, user: AuthenticatedUser, scheduled_jobs: list[dict]) -> None:
        for job in scheduled_jobs:
            starts_at = job.get("booking", {}).get("starts_at")
            if not starts_at:
                continue
            try:
                minutes = (datetime.fromisoformat(str(starts_at).replace("Z", "+00:00")) - datetime.now(UTC)).total_seconds() / 60
            except ValueError:
                continue
            if 0 < minutes <= 60 and not job.get("reminder_sent_at"):
                self._notify(str(user.user_id), job["booking_id"], "Scheduled work reminder", f"Your job starts at {datetime.fromisoformat(str(starts_at)).strftime('%I:%M %p')}. Be ready to reach the customer site.", "scheduled_reminder")
                self.client.table("booking_assignments").update({"reminder_sent_at": datetime.now(UTC).isoformat()}).eq("id", job["id"]).execute()

    def _assignment_for_booking(self, user: AuthenticatedUser, booking_id: UUID) -> dict:
        response = (
            self.client.table("booking_assignments")
            .select("*")
            .eq("booking_id", str(booking_id))
            .eq("provider_user_id", str(user.user_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise NotFoundError("Assigned job not found.")
        return response.data

    def _update_booking_status(self, booking_id: str, actor_user_id: str, from_status: str, to_status: str, metadata: dict) -> None:
        self.client.table("bookings").update({"status": to_status}).eq("id", booking_id).execute()
        self.client.table("booking_status_history").insert(
            {
                "booking_id": booking_id,
                "actor_user_id": actor_user_id,
                "from_status": from_status,
                "to_status": to_status,
                "metadata": metadata,
            }
        ).execute()

    def _notify(self, user_id: str, booking_id: str, title: str, body: str, notification_type: str) -> None:
        self.client.table("notifications").insert(
            {"recipient_user_id": user_id, "booking_id": booking_id, "notification_type": notification_type, "title": title, "body": body, "channel": "app"}
        ).execute()

    def _earnings(self, assignments: list[dict]) -> dict:
        completed = [item for item in assignments if self._booking_status(item.get("booking_id")) == "completed"]
        total = sum(Decimal(str(item.get("estimated_amount") or 0)) for item in completed)
        return {"currency": "INR", "completed_jobs": len(completed), "estimated_total": int(total)}


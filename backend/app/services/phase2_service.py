from datetime import UTC, datetime
from decimal import Decimal
import hashlib
import secrets
from uuid import UUID

from app.auth.schemas import AuthenticatedUser
from app.core.config import get_settings
from app.core.exceptions import ConflictError
from app.database.client import get_service_database_client
from app.database.repositories.base import DatabaseRepository
from app.schemas.booking import BookingCancelRequest, BookingCreateRequest, BookingEstimateRequest, CustomerPinVerificationRequest
from app.schemas.customer import CompanyCreate, ProjectCreate, ProjectNoteCreate, ProjectUpdate, SavedLocationCreate


CATALOG = {
    "hydra_crane": ("Hydra / Pick & Carry Crane", Decimal("1500"), Decimal("12000"), "Cranes"),
    "mobile_truck_crane": ("Mobile Truck Crane", Decimal("2500"), Decimal("20000"), "Cranes"),
    "crawler_crane": ("Crawler Crane", Decimal("4000"), Decimal("32000"), "Cranes"),
    "tower_crane": ("Tower Crane", Decimal("5000"), Decimal("40000"), "Cranes"),
    "rough_terrain_crane": ("Rough Terrain Crane", Decimal("3000"), Decimal("24000"), "Cranes"),
    "all_terrain_crane": ("All Terrain Crane", Decimal("4500"), Decimal("36000"), "Cranes"),
    "jcb_backhoe_loader": ("JCB Backhoe Loader", Decimal("1200"), Decimal("9000"), "JCB & Loaders"),
    "mini_jcb": ("Mini JCB / Mini Backhoe", Decimal("900"), Decimal("7000"), "JCB & Loaders"),
    "skid_steer_loader": ("Skid Steer Loader", Decimal("1100"), Decimal("8500"), "JCB & Loaders"),
    "wheel_loader": ("Wheel Loader", Decimal("1500"), Decimal("12000"), "JCB & Loaders"),
    "excavator": ("Excavator", Decimal("1800"), Decimal("14000"), "Excavators"),
    "mini_excavator": ("Mini Excavator", Decimal("1300"), Decimal("10000"), "Excavators"),
    "mini_tipper": ("Mini Tipper", Decimal("1100"), Decimal("8000"), "Tippers"),
    "standard_tipper": ("Standard Tipper", Decimal("1500"), Decimal("12000"), "Tippers"),
    "heavy_tipper": ("Heavy / Large Tipper", Decimal("2200"), Decimal("17000"), "Tippers"),
    "loader": ("Loader", Decimal("1500"), Decimal("12000"), "JCB & Loaders"),
    "septic_tank_service": ("Septic Tank Service", Decimal("1800"), Decimal("12000"), "Septic Tank Services"),
    "septic_tank_cleaning": ("Septic Tank Cleaning", Decimal("2200"), Decimal("15000"), "Septic Tank Services"),
    "septic_tank_emptying": ("Septic Tank Emptying / Desludging", Decimal("2400"), Decimal("16000"), "Septic Tank Services"),
    "septic_tank_waste_removal": ("Sewage / Waste Removal", Decimal("2500"), Decimal("18000"), "Septic Tank Services"),
    "emergency_septic_service": ("Emergency Septic Service", Decimal("3200"), Decimal("22000"), "Septic Tank Services"),
    "waste_management": ("Waste Management", Decimal("1600"), Decimal("11000"), "Waste Management"),
    "sewage_waste_transportation": ("Sewage / Waste Transportation", Decimal("2000"), Decimal("14000"), "Waste Management"),
    "crane": ("Crane (legacy catalog alias)", Decimal("1500"), Decimal("12000"), "Cranes"),
    "jcb": ("JCB (legacy catalog alias)", Decimal("1200"), Decimal("9000"), "JCB & Loaders"),
    "backhoe": ("Backhoe Loader (legacy catalog alias)", Decimal("1200"), Decimal("9000"), "JCB & Loaders"),
}
PRICE_TABLE = {key: value[1] for key, value in CATALOG.items()}


class CustomerWorkspaceService:
    def __init__(self, client=None) -> None:
        self.client = client or get_service_database_client()

    def create_location(self, user: AuthenticatedUser, payload: SavedLocationCreate) -> dict:
        return DatabaseRepository(self.client, "saved_locations").create(
            {
                "user_id": str(user.user_id),
                "label": payload.label,
                "address": payload.address.model_dump(),
                "latitude": payload.address.latitude,
                "longitude": payload.address.longitude,
                "is_default": payload.is_default,
            }
        )

    def list_locations(self, user: AuthenticatedUser) -> list[dict]:
        return DatabaseRepository(self.client, "saved_locations").list_for_user(str(user.user_id))

    def create_company(self, user: AuthenticatedUser, payload: CompanyCreate) -> dict:
        return DatabaseRepository(self.client, "companies").create(
            {
                "owner_user_id": str(user.user_id),
                "owner_profile_id": str(user.profile_id),
                "company_name": payload.company_name,
                "business_email": payload.business_email,
                "business_phone": payload.business_phone,
                "address": payload.address.model_dump() if payload.address else {},
            }
        )

    def list_companies(self, user: AuthenticatedUser) -> list[dict]:
        return DatabaseRepository(self.client, "companies").list_for_user(str(user.user_id), "owner_user_id")

    def create_project(self, user: AuthenticatedUser, payload: ProjectCreate) -> dict:
        if payload.company_id:
            DatabaseRepository(self.client, "companies").get_owned(str(payload.company_id), str(user.user_id), "owner_user_id")
        return DatabaseRepository(self.client, "projects").create(
            {
                "user_id": str(user.user_id),
                "owner_user_id": str(user.user_id),
                "company_id": str(payload.company_id) if payload.company_id else None,
                "project_name": payload.project_name,
                "address": payload.address.model_dump(),
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "site_contact_name": payload.site_contact_name,
                "site_contact_phone": payload.site_contact_phone,
                "description": payload.description,
                "requirements": payload.requirements,
                "status": "active",
            }
        )

    def list_projects(self, user: AuthenticatedUser) -> list[dict]:
        current = DatabaseRepository(self.client, "projects").list_for_user(str(user.user_id))
        legacy = DatabaseRepository(self.client, "projects").list_for_user(str(user.user_id), "owner_user_id")
        projects = {project["id"]: project for project in [*current, *legacy]}.values()
        return [self._project_report(project, user) for project in projects]

    def get_project(self, project_id: UUID, user: AuthenticatedUser) -> dict:
        project = self._owned_project(project_id, user)
        return self._project_report(project, user)

    def update_project(self, project_id: UUID, user: AuthenticatedUser, payload: ProjectUpdate) -> dict:
        values = payload.model_dump(exclude_unset=True)
        if "address" in values and values["address"] is not None:
            values["address"] = values["address"].model_dump() if hasattr(values["address"], "model_dump") else values["address"]
        project = self._owned_project(project_id, user)
        project = self.client.table("projects").update(values).eq("id", project["id"]).execute().data[0]
        return self._project_report(project, user)

    def set_project_status(self, project_id: UUID, user: AuthenticatedUser, status: str) -> dict:
        project = self._owned_project(project_id, user)
        project = self.client.table("projects").update({"status": status, "completed_at": datetime.now(UTC).isoformat() if status == "completed" else None}).eq("id", project["id"]).execute().data[0]
        self.client.table("project_activity").insert({"project_id": str(project_id), "user_id": str(user.user_id), "activity_type": f"project_{status}", "message": f"Project marked {status}."}).execute()
        return self._project_report(project, user)

    def add_project_note(self, project_id: UUID, user: AuthenticatedUser, payload: ProjectNoteCreate) -> dict:
        self._owned_project(project_id, user)
        return DatabaseRepository(self.client, "project_notes").create({"project_id": str(project_id), "user_id": str(user.user_id), "note": payload.note, "note_type": payload.note_type})

    def _owned_project(self, project_id: UUID | str, user: AuthenticatedUser) -> dict:
        project_id = str(project_id)
        project = self.client.table("projects").select("*").eq("id", project_id).eq("user_id", str(user.user_id)).maybe_single().execute().data
        if not project:
            project = self.client.table("projects").select("*").eq("id", project_id).eq("owner_user_id", str(user.user_id)).maybe_single().execute().data
        if not project:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("projects record not found.")
        return project

    def _project_report(self, project: dict, user: AuthenticatedUser) -> dict:
        project_id = project["id"]
        bookings = self.client.table("bookings").select("*").eq("project_id", project_id).eq("user_id", str(user.user_id)).execute().data or []
        items = self.client.table("booking_items").select("*").execute().data or []
        assignments = self.client.table("booking_assignments").select("*").execute().data or []
        providers = self.client.table("providers").select("*").execute().data or []
        item_by_booking: dict[str, list[dict]] = {}
        for item in items:
            item_by_booking.setdefault(item.get("booking_id", ""), []).append(item)
        provider_by_user = {provider.get("user_id"): provider for provider in providers}
        equipment_usage: dict[str, float] = {"JCB & Loaders": 0, "Excavators": 0, "Cranes": 0, "Transport": 0}
        equipment_used: set[str] = set()
        provider_details: list[dict] = []
        total_hours = Decimal("0")
        estimated = Decimal("0")
        final = Decimal("0")
        completed = 0
        for booking in bookings:
            snapshot = booking.get("pricing_snapshot") or {}
            estimated += Decimal(str(snapshot.get("estimated_total", 0)))
            if booking.get("status") == "completed":
                completed += 1
                final += Decimal(str(snapshot.get("estimated_total", 0)))
            for item in item_by_booking.get(booking["id"], []):
                equipment_used.add(item.get("equipment_type", "Equipment"))
                hours = Decimal(str(item.get("duration_hours", 0))) * Decimal(str(item.get("quantity", 1)))
                total_hours += hours
                category = CATALOG.get(item.get("equipment_type", ""), ("", 0, 0, "Other"))[3]
                if category in equipment_usage:
                    equipment_usage[category] += float(hours)
            for assignment in assignments:
                if assignment.get("booking_id") == booking["id"]:
                    provider = provider_by_user.get(assignment.get("provider_user_id"))
                    if provider and all(detail.get("user_id") != provider.get("user_id") for detail in provider_details):
                        provider_details.append({"user_id": provider.get("user_id"), "name": provider.get("business_name") or provider.get("full_name") or "Assigned provider", "phone": provider.get("phone")})
        notes = self.client.table("project_notes").select("*").eq("project_id", project_id).order("created_at", desc=True).execute().data or []
        activity = self.client.table("project_activity").select("*").eq("project_id", project_id).order("created_at", desc=True).execute().data or []
        return {**project, "status": project.get("status", "active"), "report": {"total_bookings": len(bookings), "jobs_completed": completed, "jobs_pending": len(bookings) - completed, "equipment_used": sorted(equipment_used), "equipment_usage_hours": equipment_usage, "working_hours": float(total_hours), "estimated_cost": float(estimated), "final_cost": float(final), "providers": provider_details, "recent_activity": activity, "notes": notes}}


class PricingService:
    def estimate(self, payload: BookingEstimateRequest) -> dict:
        subtotal = Decimal("0")
        line_items = []
        for item in payload.items:
            key = item.equipment_type.lower().replace(" ", "_")
            if key not in PRICE_TABLE:
                raise ConflictError(f"Equipment or service '{item.equipment_type}' is not in the active SLAB catalog.")
            hourly_rate = PRICE_TABLE[key]
            operator_rate = Decimal("35") if item.operator_required else Decimal("0")
            line_total = (hourly_rate + operator_rate) * Decimal(str(item.duration_hours)) * item.quantity
            subtotal += line_total
            line_items.append(
                {
                    "equipment_type": item.equipment_type,
                    "quantity": item.quantity,
                    "duration_hours": item.duration_hours,
                    "hourly_rate": float(hourly_rate),
                    "operator_rate": float(operator_rate),
                    "line_total": float(line_total),
                }
            )
        travel = Decimal(str(payload.distance_km)) * Decimal("3.25")
        emergency_service_charge = Decimal("0")
        if payload.is_emergency:
            emergency_service_charge = max(subtotal * Decimal("0.15"), Decimal("750"))
        platform_fee = Decimal("0") if payload.is_emergency else (subtotal + travel) * Decimal("0.08")
        total = subtotal + travel + emergency_service_charge + platform_fee
        return {
            "currency": "INR",
            "line_items": line_items,
            "equipment_subtotal": float(round(subtotal, 2)),
            "travel_charge": float(round(travel, 2)),
            "emergency_service_charge": float(round(emergency_service_charge, 2)),
            "platform_fee": float(round(platform_fee, 2)),
            "estimated_total": float(round(total, 2)),
            "is_emergency": payload.is_emergency,
            "pricing_version": "catalog-v2-inr",
        }


class BookingService:
    def __init__(self, client=None, pricing_service: PricingService | None = None) -> None:
        self.client = client or get_service_database_client()
        self.pricing_service = pricing_service or PricingService()

    def estimate(self, payload: BookingEstimateRequest) -> dict:
        return self.pricing_service.estimate(payload)

    def create_booking(self, user: AuthenticatedUser, payload: BookingCreateRequest) -> dict:
        starts_at = payload.starts_at if payload.starts_at.tzinfo else payload.starts_at.replace(tzinfo=UTC)
        ends_at = payload.ends_at if payload.ends_at.tzinfo else payload.ends_at.replace(tzinfo=UTC)
        if starts_at <= datetime.now(UTC):
            raise ConflictError("Booking start time must be in the future.")
        if payload.project_id:
            project = CustomerWorkspaceService(self.client)._owned_project(payload.project_id, user)
            if project.get("status", "active") == "completed":
                raise ConflictError("Reopen this project before creating a new booking.")
        if payload.company_id:
            DatabaseRepository(self.client, "companies").get_owned(str(payload.company_id), str(user.user_id), "owner_user_id")

        pricing = self.estimate(payload)
        booking_status = "confirmed" if payload.is_emergency and Decimal(str(pricing.get("platform_fee") or 0)) == 0 else "payment_pending"
        booking = DatabaseRepository(self.client, "bookings").create(
            {
                "user_id": str(user.user_id),
                "company_id": str(payload.company_id) if payload.company_id else None,
                "project_id": str(payload.project_id) if payload.project_id else None,
                "status": booking_status,
                "site_location": payload.site_location.model_dump(),
                "starts_at": starts_at.isoformat(),
                "ends_at": ends_at.isoformat(),
                "requirements": payload.requirements,
                "notes": payload.notes,
                "photo_urls": payload.photo_urls,
                "pricing_snapshot": pricing,
            }
        )
        for item in payload.items:
            DatabaseRepository(self.client, "booking_items").create(
                {
                    "booking_id": booking["id"],
                    "user_id": str(user.user_id),
                    **item.model_dump(),
                }
            )
        self.client.table("booking_status_history").insert(
            {
                "booking_id": booking["id"],
                "actor_user_id": str(user.user_id),
                "from_status": None,
                "to_status": booking_status,
                "metadata": {"reason": "emergency_booking_no_slab_fee" if booking_status == "confirmed" else "booking_created_pending_slab_fee"},
            }
        ).execute()
        self.client.table("notifications").insert(
            {
                "recipient_user_id": str(user.user_id),
                "booking_id": booking["id"],
                "notification_type": "booking_created",
                "title": "Emergency booking created" if booking_status == "confirmed" else "Booking created",
                "body": "SLAB Emergency Booking Fee is ₹0. Provider matching has started." if booking_status == "confirmed" else "Pay the SLAB booking fee to confirm provider matching.",
                "channel": "app",
            }
        ).execute()
        booking["items"] = [item.model_dump() for item in payload.items]
        if booking_status == "confirmed":
            from app.services.matching_service import MatchingService
            MatchingService(self.client).start_matching_for_booking(UUID(str(booking["id"])))
        return booking

    def list_bookings(self, user: AuthenticatedUser) -> list[dict]:
        return DatabaseRepository(self.client, "bookings").list_for_user(str(user.user_id))

    def get_booking(self, booking_id: UUID, user: AuthenticatedUser) -> dict:
        return DatabaseRepository(self.client, "bookings").get_owned(str(booking_id), str(user.user_id))

    def get_booking_experience(self, booking_id: UUID, user: AuthenticatedUser) -> dict:
        booking = DatabaseRepository(self.client, "bookings").get_owned(str(booking_id), str(user.user_id))
        items = self.client.table("booking_items").select("*").eq("booking_id", str(booking_id)).execute().data or []
        assignment = self.client.table("booking_assignments").select("*").eq("booking_id", str(booking_id)).maybe_single().execute().data
        provider = None
        equipment = None
        if assignment:
            provider = self.client.table("providers").select("*").eq("user_id", assignment["provider_user_id"]).maybe_single().execute().data
            equipment = self.client.table("provider_equipment").select("*").eq("id", assignment.get("equipment_id")).maybe_single().execute().data if assignment.get("equipment_id") else None
        latest_location = None
        if assignment:
            locations = (
                self.client.table("provider_locations")
                .select("*")
                .eq("booking_id", str(booking_id))
                .order("recorded_at", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
            latest_location = locations[0] if locations else None
        payment = (
            self.client.table("slab_payments")
            .select("*")
            .eq("booking_id", str(booking_id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        history = (
            self.client.table("booking_status_history")
            .select("*")
            .eq("booking_id", str(booking_id))
            .order("created_at")
            .execute()
            .data
            or []
        )
        notifications = (
            self.client.table("notifications")
            .select("*")
            .eq("booking_id", str(booking_id))
            .eq("recipient_user_id", str(user.user_id))
            .order("created_at", desc=True)
            .limit(10)
            .execute()
            .data
            or []
        )
        return {
            "booking": booking,
            "items": items,
            "assignment": assignment,
            "provider": provider,
            "equipment": equipment,
            "latest_location": latest_location,
            "payment": payment[0] if payment else None,
            "status_history": history,
            "notifications": notifications,
            "payment_otp_required": bool(booking.get("payment_otp_hash") and not booking.get("payment_verified_at")),
            "payment_otp_verified": bool(booking.get("payment_verified_at")),
            "job_pin": booking.get("job_pin_display"),
            "pin_required": bool(assignment and assignment.get("customer_pin_hash") and not assignment.get("customer_dispatch_verified_at")),
            "pin_verified": bool(assignment and assignment.get("customer_dispatch_verified_at")),
        }

    def verify_customer_pin(self, booking_id: UUID, user: AuthenticatedUser, payload: CustomerPinVerificationRequest) -> dict:
        self.get_booking(booking_id, user)
        assignment = self.client.table("booking_assignments").select("*").eq("booking_id", str(booking_id)).maybe_single().execute().data
        if not assignment or not assignment.get("customer_pin_hash"):
            raise ConflictError("Provider assignment PIN is not available yet.")
        if int(assignment.get("customer_dispatch_pin_attempt_count") or 0) >= 5:
            raise ConflictError("PIN verification is temporarily locked after repeated failed attempts.")
        if not secrets.compare_digest(assignment["customer_pin_hash"], self._hash_pin(payload.pin)):
            self.client.table("booking_assignments").update(
                {
                    "customer_dispatch_pin_attempt_count": int(assignment.get("customer_dispatch_pin_attempt_count") or 0) + 1,
                    "customer_dispatch_pin_last_attempt_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", assignment["id"]).execute()
            raise ConflictError("Invalid PIN. Check the latest SLAB notification and try again.")
        updated = self.client.table("booking_assignments").update(
            {
                "customer_dispatch_verified_at": datetime.now(UTC).isoformat(),
                "customer_dispatch_pin_attempt_count": 0,
                "customer_dispatch_pin_last_attempt_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", assignment["id"]).execute().data[0]
        self.client.table("notifications").insert(
            {
                "recipient_user_id": str(user.user_id),
                "booking_id": str(booking_id),
                "notification_type": "pin_verified",
                "title": "Booking PIN verified",
                "body": "Live tracking is ready for this assigned provider.",
                "channel": "app",
            }
        ).execute()
        return {"verified": True, "assignment": updated}

    def cancel_booking(self, booking_id: UUID, user: AuthenticatedUser, payload: BookingCancelRequest) -> dict:
        booking = DatabaseRepository(self.client, "bookings").get_owned(str(booking_id), str(user.user_id))
        if booking["status"] in {"completed", "cancelled", "disputed"}:
            raise ConflictError("This booking can no longer be cancelled.")
        return DatabaseRepository(self.client, "bookings").update_owned(
            str(booking_id),
            str(user.user_id),
            {"status": "cancelled", "cancellation_reason": payload.reason, "cancelled_at": datetime.now(UTC).isoformat()},
        )

    def _hash_pin(self, pin: str) -> str:
        secret = get_settings().JWT_SECRET or "development-only-pin-secret"
        return hashlib.sha256(f"{secret}:{pin}".encode("utf-8")).hexdigest()


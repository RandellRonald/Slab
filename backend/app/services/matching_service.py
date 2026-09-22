from datetime import UTC, datetime
from math import asin, cos, radians, sin, sqrt
from uuid import UUID

from app.auth.schemas import AuthenticatedUser
from app.core.exceptions import AuthorizationError, ConflictError, NotFoundError
from app.database.client import get_service_database_client


def distance_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    radius = 6371.0
    dlat = radians(b_lat - a_lat)
    dlng = radians(b_lng - a_lng)
    origin = radians(a_lat)
    target = radians(b_lat)
    hav = sin(dlat / 2) ** 2 + cos(origin) * cos(target) * sin(dlng / 2) ** 2
    return 2 * radius * asin(sqrt(hav))


class MatchingService:
    def __init__(self, client=None) -> None:
        self.client = client or get_service_database_client()

    def start_matching(self, admin: AuthenticatedUser, booking_id: UUID) -> dict:
        if admin.role != "admin":
            raise AuthorizationError("Only admins can start provider matching.")
        return self.start_matching_for_booking(booking_id)

    def start_matching_for_booking(self, booking_id: UUID) -> dict:
        booking = self._booking(booking_id)
        if booking["status"] not in {"confirmed", "matching"}:
            raise ConflictError("Booking must be confirmed before matching.")
        self.client.table("bookings").update({"status": "matching"}).eq("id", str(booking_id)).execute()
        candidates = self._eligible_candidates(booking)
        pricing = booking.get("pricing_snapshot") or {}
        is_emergency = bool(pricing.get("is_emergency"))
        requests = []
        for rank, candidate in enumerate(candidates[:10], start=1):
            response = self.client.table("provider_booking_requests").upsert(
                {
                    "booking_id": str(booking_id),
                    "provider_user_id": candidate["provider_user_id"],
                    "equipment_id": candidate["equipment_id"],
                    "rank": rank,
                    "distance_km": candidate["distance_km"],
                    "eta_minutes": round((candidate["distance_km"] / 35) * 60),
                    "estimated_amount": candidate["estimated_amount"],
                    "request_payload": candidate,
                    "status": "pending",
                },
                on_conflict="booking_id,provider_user_id,equipment_id",
            ).execute()
            if response.data:
                request = response.data[0]
                requests.append(request)
                self.client.table("notifications").insert(
                    {
                        "recipient_user_id": candidate["provider_user_id"],
                        "booking_id": str(booking_id),
                        "notification_type": "provider_request",
                        "title": "URGENT REQUEST" if is_emergency else "New SLAB booking request",
                        "body": "Emergency service needed nearby. Review ETA, location, and service details." if is_emergency else "A nearby booking request is waiting for your response.",
                        "channel": "app",
                        "metadata": {"provider_request_id": request["id"], "rank": rank},
                    }
                ).execute()
        if not requests:
            self.client.table("notifications").insert(
                {
                    "recipient_user_id": booking["user_id"],
                    "booking_id": str(booking_id),
                    "notification_type": "no_provider_available",
                    "title": "No provider available",
                    "body": "SLAB could not find an eligible provider for this booking yet.",
                }
            ).execute()
        return {"booking_id": str(booking_id), "requests_created": len(requests), "requests": requests}

    def expire_request(self, admin: AuthenticatedUser, request_id: UUID) -> dict:
        if admin.role != "admin":
            raise AuthorizationError("Only admins can expire provider requests.")
        response = self.client.table("provider_booking_requests").update(
            {"status": "expired", "responded_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(request_id)).eq("status", "pending").execute()
        if not response.data:
            raise NotFoundError("Pending provider request not found.")
        return response.data[0]

    def _booking(self, booking_id: UUID) -> dict:
        response = self.client.table("bookings").select("*").eq("id", str(booking_id)).maybe_single().execute()
        if not response.data:
            raise NotFoundError("Booking not found.")
        booking = response.data
        booking["booking_items"] = self.client.table("booking_items").select("*").eq("booking_id", str(booking_id)).execute().data or []
        return booking

    def _eligible_candidates(self, booking: dict) -> list[dict]:
        site = booking.get("site_location", {})
        items = booking.get("booking_items") or []
        wanted = {item["equipment_type"].lower().replace(" ", "_") for item in items}
        response = self.client.table("provider_equipment").select("*").in_("equipment_type_slug", list(wanted) or ["__none__"]).eq("status", "available").execute()
        candidates = []
        nearest_outside_area = []
        for equipment in response.data or []:
            if equipment.get("is_active") is False:
                continue
            provider = self.client.table("providers").select("*").eq("user_id", equipment["provider_user_id"]).maybe_single().execute().data
            if not provider or provider.get("verification_status") != "approved" or not provider.get("is_online"):
                continue
            if equipment.get("operating_latitude") is None or equipment.get("operating_longitude") is None:
                continue
            km = distance_km(float(equipment["operating_latitude"]), float(equipment["operating_longitude"]), float(site.get("latitude", 0)), float(site.get("longitude", 0)))
            if not self._is_available(equipment, booking):
                continue
            candidate = {
                "provider_user_id": equipment["provider_user_id"],
                "equipment_id": equipment["id"],
                "equipment_type_slug": equipment["equipment_type_slug"],
                "distance_km": round(km, 2),
                "estimated_amount": float((equipment.get("hourly_rate") or 0) * 8),
            }
            if km <= float(equipment.get("operating_radius_km") or provider.get("operating_area_km") or 50):
                candidates.append(candidate)
            else:
                nearest_outside_area.append({**candidate, "requires_operations_review": True})
        selected = candidates or nearest_outside_area[:3]
        return sorted(selected, key=lambda item: (item["distance_km"], -item["estimated_amount"]))

    def _is_available(self, equipment: dict, booking: dict) -> bool:
        blocks = (
            self.client.table("provider_availability_blocks")
            .select("id")
            .eq("provider_user_id", equipment["provider_user_id"])
            .or_(f"equipment_id.is.null,equipment_id.eq.{equipment['id']}")
            .lt("starts_at", booking["ends_at"])
            .gt("ends_at", booking["starts_at"])
            .execute()
            .data
            or []
        )
        blocking_rows = [block for block in blocks if not str(block.get("reason") or "").lower().startswith("operating schedule")]
        if blocking_rows:
            return False

        active = (
            self.client.table("booking_assignments")
            .select("booking_id, bookings!inner(starts_at,ends_at,status)")
            .eq("provider_user_id", equipment["provider_user_id"])
            .in_("bookings.status", ["assigned", "provider_en_route", "provider_arrived", "in_progress"])
            .execute()
            .data
            or []
        )
        for assignment in active:
            scheduled = assignment.get("bookings") or {}
            if scheduled.get("starts_at") < booking["ends_at"] and scheduled.get("ends_at") > booking["starts_at"]:
                return False
        return True


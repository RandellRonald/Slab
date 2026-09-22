from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import WebSocket

from app.auth.schemas import AuthenticatedUser
from app.auth.service import authenticated_user_from_token
from app.core.exceptions import AuthorizationError, NotFoundError
from app.database.client import get_service_database_client
from app.services.payment_service import BookingExperienceService


class ConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, room: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(room, set()).add(websocket)

    def disconnect(self, room: str, websocket: WebSocket) -> None:
        sockets = self.rooms.get(room)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                self.rooms.pop(room, None)

    async def broadcast(self, room: str, payload: dict[str, Any]) -> None:
        stale = []
        for socket in self.rooms.get(room, set()).copy():
            try:
                await socket.send_json(payload)
            except Exception:
                stale.append(socket)
        for socket in stale:
            self.disconnect(room, socket)


manager = ConnectionManager()


class RealtimeAuthService:
    def __init__(self, client=None) -> None:
        self.client = client or get_service_database_client()

    def user_from_token(self, token: str | None) -> AuthenticatedUser:
        return authenticated_user_from_token(token)

    def authorize_booking(self, user: AuthenticatedUser, booking_id: UUID) -> dict:
        booking = self.client.table("bookings").select("*").eq("id", str(booking_id)).maybe_single().execute().data
        if not booking:
            raise NotFoundError("Booking not found.")
        assignment = self.client.table("booking_assignments").select("*").eq("booking_id", str(booking_id)).maybe_single().execute().data or {}
        if user.role != "admin" and str(user.user_id) not in {booking["user_id"], assignment.get("provider_user_id")}:
            raise AuthorizationError()
        return {"booking": booking, "assignment": assignment}

    def authorize_provider_status(self, user: AuthenticatedUser, provider_id: UUID) -> None:
        provider = self.client.table("providers").select("user_id").eq("id", str(provider_id)).maybe_single().execute().data
        if not provider:
            raise NotFoundError("Provider not found.")
        if user.role != "admin" and str(user.user_id) != provider["user_id"]:
            raise AuthorizationError()

    def authorize_notifications(self, user: AuthenticatedUser, user_id: UUID) -> None:
        if user.role != "admin" and str(user.user_id) != str(user_id):
            raise AuthorizationError()


class RealtimePersistenceService:
    def __init__(self, client=None) -> None:
        self.client = client or get_service_database_client()

    def tracking_update(self, user: AuthenticatedUser, booking_id: UUID, payload: dict[str, Any]) -> dict:
        auth = RealtimeAuthService(self.client).authorize_booking(user, booking_id)
        assignment = auth["assignment"]
        if str(user.user_id) != assignment.get("provider_user_id"):
            raise AuthorizationError("Only the assigned provider can publish tracking.")
        booking_status = auth["booking"]["status"]
        if booking_status not in {"provider_en_route", "provider_arrived", "in_progress"}:
            raise AuthorizationError("Tracking is available only for active dispatch states.")
        row = self.client.table("provider_locations").insert(
            {
                "provider_user_id": str(user.user_id),
                "booking_id": str(booking_id),
                "latitude": float(payload["lat"]),
                "longitude": float(payload["lng"]),
                "accuracy_meters": payload.get("accuracy_meters"),
                "recorded_at": payload.get("timestamp") or datetime.now(UTC).isoformat(),
            }
        ).execute().data[0]
        return {
            "type": "tracking_update",
            "booking_id": str(booking_id),
            "provider_id": str(user.user_id),
            "lat": row["latitude"],
            "lng": row["longitude"],
            "heading": payload.get("heading"),
            "timestamp": row["recorded_at"],
        }

    def chat_message(self, user: AuthenticatedUser, booking_id: UUID, payload: dict[str, Any]) -> dict:
        message = BookingExperienceService(self.client).send_chat(user, booking_id, payload["message"])
        return {"type": "chat_message", "message": message}


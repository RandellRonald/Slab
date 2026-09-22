from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.auth.dependencies import get_current_user, require_admin, require_provider
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response
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
from app.services.matching_service import MatchingService
from app.services.provider_service import ProviderService

router = APIRouter()


@router.get("/dashboard")
def dashboard(user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().dashboard(user))


@router.put("/status")
def update_status(payload: ProviderStatusUpdate, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().update_online_status(user, payload))


@router.post("/verification")
def submit_verification(payload: ProviderVerificationSubmit, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().submit_verification(user, payload))


@router.get("/documents")
def list_documents(user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().list_documents(user))


@router.post("/documents")
def create_document(payload: ProviderDocumentCreate, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().create_document(user, payload))


@router.post("/documents/{document_id}/review")
def review_document(document_id: UUID, payload: ProviderDocumentReview, admin: AuthenticatedUser = Depends(require_admin)) -> dict:
    return success_response(ProviderService().review_document(admin, document_id, payload))


@router.get("/admin/review-queue")
def admin_review_queue(admin: AuthenticatedUser = Depends(require_admin)) -> dict:
    return success_response(ProviderService().admin_review_queue(admin))


@router.post("/admin/verifications/{verification_id}/review")
def review_verification(verification_id: UUID, payload: ProviderDocumentReview, admin: AuthenticatedUser = Depends(require_admin)) -> dict:
    return success_response(ProviderService().review_verification(admin, verification_id, payload))


@router.get("/equipment")
def list_equipment(user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().list_equipment(user))


@router.post("/equipment")
def create_equipment(payload: ProviderEquipmentUpsert, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().create_equipment(user, payload))


@router.put("/equipment/{equipment_id}")
def update_equipment(equipment_id: UUID, payload: ProviderEquipmentUpsert, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().update_equipment(user, equipment_id, payload))


@router.delete("/equipment/{equipment_id}")
def remove_equipment(equipment_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().remove_equipment(user, equipment_id))


@router.get("/availability")
def list_availability(user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().list_availability(user))


@router.post("/availability/blocks")
def block_availability(payload: AvailabilityBlockCreate, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().block_availability(user, payload))


@router.get("/requests")
def list_requests(user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().list_requests(user))


@router.post("/requests/{request_id}/accept")
def accept_request(request_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().accept_request(user, request_id))


@router.post("/requests/{request_id}/reject")
def reject_request(request_id: UUID, payload: ProviderRequestResponse, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().reject_request(user, request_id, payload))


@router.get("/jobs")
def list_jobs(user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().list_jobs(user))


@router.get("/jobs/{booking_id}")
def job_detail(booking_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().job_detail(user, booking_id))


@router.post("/jobs/{booking_id}/en-route")
def mark_en_route(booking_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().transition_job(user, booking_id, "en-route"))


@router.post("/jobs/{booking_id}/arrived")
def mark_arrived(booking_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().transition_job(user, booking_id, "arrived"))


@router.post("/jobs/{booking_id}/verify-pin")
def verify_pin(booking_id: UUID, payload: PinVerificationRequest, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().transition_job(user, booking_id, "verify-pin", payload))


@router.post("/jobs/{booking_id}/start")
def start_job(booking_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().transition_job(user, booking_id, "start"))


@router.post("/jobs/{booking_id}/complete")
def complete_job(booking_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().transition_job(user, booking_id, "complete"))


@router.post("/jobs/{booking_id}/break")
def break_job(booking_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().transition_job(user, booking_id, "break"))


@router.post("/jobs/{booking_id}/resume")
def resume_job(booking_id: UUID, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().transition_job(user, booking_id, "resume"))


@router.post("/location")
def update_location(payload: ProviderLocationUpdate, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().update_location(user, payload))


@router.post("/jobs/{booking_id}/messages")
def message_customer(booking_id: UUID, payload: ProviderCustomerMessage, user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().message_customer(user, booking_id, payload))


@router.get("/notifications")
def notifications(user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().notifications(user))


@router.post("/matching/{booking_id}/start")
def start_matching(booking_id: UUID, admin: AuthenticatedUser = Depends(require_admin)) -> dict:
    return success_response(MatchingService().start_matching(admin, booking_id))


@router.post("/matching/requests/{request_id}/expire")
def expire_request(request_id: UUID, admin: AuthenticatedUser = Depends(require_admin)) -> dict:
    return success_response(MatchingService().expire_request(admin, request_id))


@router.websocket("/ws/provider")
async def provider_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        await websocket.send_json({"type": "connected", "message": "Refetch provider dashboard state after reconnect."})
        while True:
            await websocket.receive_text()
            await websocket.send_json({"type": "ack"})
    except WebSocketDisconnect:
        return

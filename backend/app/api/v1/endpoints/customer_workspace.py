from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.dependencies import require_customer
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response
from app.schemas.booking import BookingCancelRequest, BookingCreateRequest, BookingEstimateRequest, CustomerPinVerificationRequest
from app.schemas.customer import CompanyCreate, ProjectCreate, ProjectNoteCreate, ProjectUpdate, SavedLocationCreate
from app.services.phase2_service import BookingService, CustomerWorkspaceService
from app.services.phase2_service import CATALOG

router = APIRouter()

@router.get("/catalog")
def catalog(user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response([{"slug": slug, "name": name, "hourly_rate": float(hourly), "daily_rate": float(daily), "category": category, "status": "active"} for slug, (name, hourly, daily, category) in CATALOG.items()])


@router.get("/locations")
def list_locations(user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().list_locations(user))


@router.post("/locations")
def create_location(payload: SavedLocationCreate, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().create_location(user, payload))


@router.get("/companies")
def list_companies(user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().list_companies(user))


@router.post("/companies")
def create_company(payload: CompanyCreate, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().create_company(user, payload))


@router.get("/projects")
def list_projects(user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().list_projects(user))


@router.post("/projects")
def create_project(payload: ProjectCreate, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().create_project(user, payload))


@router.get("/projects/{project_id}")
def get_project(project_id: UUID, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().get_project(project_id, user))


@router.patch("/projects/{project_id}")
def update_project(project_id: UUID, payload: ProjectUpdate, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().update_project(project_id, user, payload))


@router.post("/projects/{project_id}/finish")
def finish_project(project_id: UUID, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().set_project_status(project_id, user, "completed"))


@router.post("/projects/{project_id}/reopen")
def reopen_project(project_id: UUID, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().set_project_status(project_id, user, "active"))


@router.post("/projects/{project_id}/notes")
def add_project_note(project_id: UUID, payload: ProjectNoteCreate, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerWorkspaceService().add_project_note(project_id, user, payload))


@router.get("/bookings")
def list_bookings(user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(BookingService().list_bookings(user))


@router.post("/bookings/estimate")
def estimate_booking(payload: BookingEstimateRequest, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(BookingService().estimate(payload))


@router.post("/bookings")
def create_booking(payload: BookingCreateRequest, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(BookingService().create_booking(user, payload))

@router.get("/bookings/{booking_id}/experience")
def get_booking_experience(booking_id: UUID, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(BookingService().get_booking_experience(booking_id, user))


@router.post("/bookings/{booking_id}/verify-pin")
def verify_customer_pin(booking_id: UUID, payload: CustomerPinVerificationRequest, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(BookingService().verify_customer_pin(booking_id, user, payload))


@router.get("/bookings/{booking_id}")
def get_booking(booking_id: UUID, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(BookingService().get_booking(booking_id, user))


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: UUID, payload: BookingCancelRequest, user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(BookingService().cancel_booking(booking_id, user, payload))

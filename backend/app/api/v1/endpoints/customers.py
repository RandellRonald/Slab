from fastapi import APIRouter, Depends

from app.auth.dependencies import require_customer
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response
from app.services.profile_service import CustomerService

router = APIRouter()


@router.get("/me")
def get_customer(user: AuthenticatedUser = Depends(require_customer)) -> dict:
    return success_response(CustomerService().get_current_customer(user))

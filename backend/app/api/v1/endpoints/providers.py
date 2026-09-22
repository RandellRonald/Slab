from fastapi import APIRouter, Depends

from app.auth.dependencies import require_provider
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response
from app.services.profile_service import ProviderService

router = APIRouter()


@router.get("/me")
def get_provider(user: AuthenticatedUser = Depends(require_provider)) -> dict:
    return success_response(ProviderService().get_current_provider(user))

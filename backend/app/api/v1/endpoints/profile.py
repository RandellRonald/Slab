from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response
from app.schemas.profile import ProfileUpdateRequest
from app.services.profile_service import ProfileService

router = APIRouter()


@router.get("")
def get_profile(user: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return success_response(ProfileService().get_current_profile(user))


@router.put("")
def update_profile(payload: ProfileUpdateRequest, user: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return success_response(ProfileService().update_current_profile(user, payload))

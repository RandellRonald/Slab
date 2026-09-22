from fastapi import APIRouter, Depends

from app.auth.dependencies import require_admin
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response

router = APIRouter()


@router.get("/me")
def get_admin(user: AuthenticatedUser = Depends(require_admin)) -> dict:
    return success_response(
        {
            "user_id": str(user.user_id),
            "profile_id": str(user.profile_id),
            "role": user.role,
            "foundation": "admin-access-verified",
        }
    )

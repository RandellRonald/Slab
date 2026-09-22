from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.dependencies import bearer_scheme, get_current_user
from app.auth.schemas import AuthenticatedUser, LoginRequest, LogoutRequest, PresentationLoginRequest, RefreshRequest, RegisterRequest
from app.auth.service import AuthService
from app.core.responses import success_response

router = APIRouter()


@router.post("/register")
def register(payload: RegisterRequest) -> dict:
    return success_response(AuthService().register(payload))


@router.post("/login")
def login(payload: LoginRequest) -> dict:
    return success_response(AuthService().login(payload))


@router.post("/presentation-login")
def presentation_login(payload: PresentationLoginRequest) -> dict:
    return success_response(AuthService().presentation_login(payload))


@router.post("/logout")
def logout(
    payload: LogoutRequest | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    token = payload.access_token if payload else None
    AuthService().logout(token or (credentials.credentials if credentials else None))
    return success_response({"logged_out": True})


@router.get("/me")
def me(user: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return success_response(user.model_dump(mode="json"))


@router.post("/refresh")
def refresh(payload: RefreshRequest) -> dict:
    return success_response(AuthService().refresh(payload.refresh_token))

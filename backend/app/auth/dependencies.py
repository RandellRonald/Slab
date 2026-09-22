from collections.abc import Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.schemas import AppRole, AuthenticatedUser
import jwt
from app.core.config import get_settings
from app.database.local import SessionLocal, get_user_by_id, user_payload
from app.core.exceptions import AuthenticationError, AuthorizationError

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> AuthenticatedUser:
    if credentials is None:
        raise AuthenticationError()

    token = credentials.credentials
    try:
        claims = jwt.decode(token, get_settings().JWT_SECRET or "local-development-secret", algorithms=[get_settings().JWT_ALGORITHM])
        user_id = claims["sub"]
    except Exception as exc:
        raise AuthenticationError("Invalid or expired token.") from exc
    with SessionLocal() as session:
        user = get_user_by_id(session, user_id)
    if not user or not user.is_active:
        raise AuthorizationError("This account is inactive.")
    return AuthenticatedUser(**user_payload(user))


def require_roles(*roles: AppRole) -> Callable[[AuthenticatedUser], AuthenticatedUser]:
    def dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in roles:
            raise AuthorizationError("Your role cannot access this endpoint.")
        return user

    return dependency


def require_customer(user: AuthenticatedUser = Depends(require_roles("customer"))) -> AuthenticatedUser:
    return user


def require_provider(user: AuthenticatedUser = Depends(require_roles("provider"))) -> AuthenticatedUser:
    return user


def require_admin(user: AuthenticatedUser = Depends(require_roles("admin"))) -> AuthenticatedUser:
    return user

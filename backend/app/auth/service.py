from typing import Any

from app.auth.schemas import AuthenticatedUser, LoginRequest, PresentationLoginRequest, RegisterRequest
from app.core.exceptions import AuthenticationError, AuthorizationError, ConflictError
from datetime import UTC, datetime, timedelta
import jwt
from app.core.config import get_settings
from app.database.local import SessionLocal, User, get_user_by_email, get_user_by_id, pwd_context, seed_auth_users, user_payload


def _field(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


class AuthService:
    def __init__(self, *_, **__) -> None:
        self.settings = get_settings()
        seed_auth_users()

    def register(self, payload: RegisterRequest) -> dict[str, Any]:
        if payload.role == "admin": raise AuthorizationError("Admin accounts are created by the backend.")
        with SessionLocal.begin() as session:
            if get_user_by_email(session, payload.email): raise ConflictError("An account with this email already exists.")
            user = User(id=str(__import__('uuid').uuid4()), email=payload.email.lower(), password_hash=pwd_context.hash(payload.password), full_name=payload.full_name, phone=payload.phone, role=payload.role)
            session.add(user); session.flush()
            return self._session_payload(user)

    def login(self, payload: LoginRequest) -> dict[str, Any]:
        with SessionLocal() as session:
            user = get_user_by_email(session, payload.email)
            if not user or not user.is_active or not pwd_context.verify(payload.password, user.password_hash): raise AuthenticationError("Invalid email or password.")
            if payload.expected_role and user.role != payload.expected_role:
                raise AuthorizationError("Use the sign-in page for your SLAB account type.")
            return self._session_payload(user)

    def presentation_login(self, payload: PresentationLoginRequest) -> dict[str, Any]:
        if not self.settings.PRESENTATION_MODE or self.settings.ENVIRONMENT == "production":
            raise AuthorizationError("Presentation access is disabled.")
        seeded_email = {
            "customer": "customer@slab.local",
            "provider": "provider@slab.local",
            "admin": "admin@slab.local",
        }[payload.role]
        with SessionLocal() as session:
            user = get_user_by_email(session, seeded_email)
            if not user or not user.is_active or user.role != payload.role:
                raise AuthenticationError("Presentation account is unavailable.")
            return self._session_payload(user)

    def logout(self, access_token: str | None = None) -> None:
        return None

    def refresh(self, refresh_token: str) -> dict[str, Any]:
        return self._decode_session(refresh_token)

    def _session_payload(self, user: User) -> dict[str, Any]:
        now = datetime.now(UTC); token = jwt.encode({"sub": user.id, "exp": now + timedelta(hours=8), "role": user.role}, self.settings.JWT_SECRET or "local-development-secret", algorithm=self.settings.JWT_ALGORITHM)
        return {"user": user_payload(user), "access_token": token, "refresh_token": token, "token_type": "bearer", "expires_in": 28800}

    def _decode_session(self, token: str) -> dict[str, Any]:
        try: claims = jwt.decode(token, self.settings.JWT_SECRET or "local-development-secret", algorithms=[self.settings.JWT_ALGORITHM])
        except Exception as exc: raise AuthenticationError("Session refresh failed.") from exc
        with SessionLocal() as session:
            user = session.get(User, claims.get("sub"))
            if not user: raise AuthenticationError("Session refresh failed.")
            return self._session_payload(user)


def authenticated_user_from_token(token: str | None) -> AuthenticatedUser:
    if not token:
        raise AuthenticationError()
    try:
        claims = jwt.decode(token, get_settings().JWT_SECRET or "local-development-secret", algorithms=[get_settings().JWT_ALGORITHM])
    except Exception as exc:
        raise AuthenticationError("Invalid or expired token.") from exc
    with SessionLocal() as session:
        user = get_user_by_id(session, claims.get("sub"))
    if not user or not user.is_active:
        raise AuthorizationError("This account is inactive.")
    return AuthenticatedUser(**user_payload(user))

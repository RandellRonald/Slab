from uuid import uuid4

import pytest

from app.auth.dependencies import require_roles
from app.auth.schemas import AuthenticatedUser
from app.core.exceptions import AuthorizationError


def make_user(role: str) -> AuthenticatedUser:
    return AuthenticatedUser(
        user_id=uuid4(),
        profile_id=uuid4(),
        email="user@example.com",
        role=role,
        full_name="User",
        is_active=True,
    )


def test_require_roles_allows_matching_role() -> None:
    dependency = require_roles("admin")
    user = make_user("admin")

    assert dependency(user) == user


def test_require_roles_rejects_wrong_role() -> None:
    dependency = require_roles("admin")

    with pytest.raises(AuthorizationError):
        dependency(make_user("customer"))

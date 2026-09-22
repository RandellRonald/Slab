from app.auth.schemas import AuthenticatedUser
from app.database.client import get_service_database_client
from app.database.repositories.profiles import ProfileRepository
from app.schemas.profile import ProfileUpdateRequest


class ProfileService:
    def __init__(self, repository: ProfileRepository | None = None) -> None:
        self.repository = repository or ProfileRepository(get_service_database_client())

    def get_current_profile(self, user: AuthenticatedUser) -> dict:
        return self.repository.get_by_user_id(user.user_id)

    def update_current_profile(self, user: AuthenticatedUser, payload: ProfileUpdateRequest) -> dict:
        values = payload.model_dump(exclude_unset=True)
        return self.repository.update_profile(user.user_id, values)


class CustomerService:
    def __init__(self, repository: ProfileRepository | None = None) -> None:
        self.repository = repository or ProfileRepository(get_service_database_client())

    def get_current_customer(self, user: AuthenticatedUser) -> dict:
        return self.repository.get_customer_by_user_id(user.user_id)


class ProviderService:
    def __init__(self, repository: ProfileRepository | None = None) -> None:
        self.repository = repository or ProfileRepository(get_service_database_client())

    def get_current_provider(self, user: AuthenticatedUser) -> dict:
        return self.repository.get_provider_by_user_id(user.user_id)


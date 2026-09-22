from typing import Any
from uuid import UUID

from app.core.exceptions import NotFoundError


class ProfileRepository:
    def __init__(self, client) -> None:
        self.client = client

    def get_by_user_id(self, user_id: str | UUID) -> dict[str, Any]:
        response = (
            self.client.table("profiles")
            .select("*")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise NotFoundError("Profile not found.")
        return response.data

    def create_profile(self, values: dict[str, Any]) -> dict[str, Any]:
        response = self.client.table("profiles").insert(values).execute()
        return response.data[0]

    def update_profile(self, user_id: str | UUID, values: dict[str, Any]) -> dict[str, Any]:
        response = (
            self.client.table("profiles")
            .update(values)
            .eq("user_id", str(user_id))
            .execute()
        )
        if not response.data:
            raise NotFoundError("Profile not found.")
        return response.data[0]

    def create_customer(self, values: dict[str, Any]) -> dict[str, Any]:
        response = self.client.table("customers").insert(values).execute()
        return response.data[0]

    def create_provider(self, values: dict[str, Any]) -> dict[str, Any]:
        response = self.client.table("providers").insert(values).execute()
        return response.data[0]

    def get_customer_by_user_id(self, user_id: str | UUID) -> dict[str, Any]:
        response = (
            self.client.table("customers")
            .select("*")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise NotFoundError("Customer profile not found.")
        return response.data

    def get_provider_by_user_id(self, user_id: str | UUID) -> dict[str, Any]:
        response = (
            self.client.table("providers")
            .select("*")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise NotFoundError("Provider profile not found.")
        return response.data

from typing import Any

from app.core.exceptions import NotFoundError


class DatabaseRepository:
    def __init__(self, client, table_name: str) -> None:
        self.client = client
        self.table_name = table_name

    def list_for_user(self, user_id: str, user_column: str = "user_id") -> list[dict[str, Any]]:
        response = self.client.table(self.table_name).select("*").eq(user_column, user_id).execute()
        return response.data or []

    def get_owned(self, row_id: str, user_id: str, user_column: str = "user_id") -> dict[str, Any]:
        response = (
            self.client.table(self.table_name)
            .select("*")
            .eq("id", row_id)
            .eq(user_column, user_id)
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise NotFoundError(f"{self.table_name} record not found.")
        return response.data

    def create(self, values: dict[str, Any]) -> dict[str, Any]:
        response = self.client.table(self.table_name).insert(values).execute()
        return response.data[0]

    def update_owned(self, row_id: str, user_id: str, values: dict[str, Any], user_column: str = "user_id") -> dict[str, Any]:
        response = (
            self.client.table(self.table_name)
            .update(values)
            .eq("id", row_id)
            .eq(user_column, user_id)
            .execute()
        )
        if not response.data:
            raise NotFoundError(f"{self.table_name} record not found.")
        return response.data[0]

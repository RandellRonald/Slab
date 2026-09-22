from app.database.local_client import LocalClient, initialize_local_database


def get_local_database_client() -> LocalClient:
    initialize_local_database()
    return LocalClient()

get_public_database_client = get_local_database_client
get_service_database_client = get_local_database_client

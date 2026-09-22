from typing import Any


def success_response(data: Any = None) -> dict[str, Any]:
    return {"success": True, "data": {} if data is None else data}

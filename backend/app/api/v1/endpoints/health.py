from fastapi import APIRouter

from app.core.responses import success_response
from app.database.local import SessionLocal
from sqlalchemy import text

router = APIRouter()


@router.get("")
def health() -> dict:
    return success_response({"status": "ok", "service": "slab-api"})


@router.get("/ready")
def ready() -> dict:
    dependencies = {"application": "ok", "database": "unavailable"}
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        dependencies["database"] = "ok"
    except Exception:
        pass

    return success_response(
        {
            "status": "ok" if dependencies["database"] == "ok" else "degraded",
            "service": "slab-api",
            "dependencies": dependencies,
        }
    )

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.auth.dependencies import require_admin
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response
from app.database.local import SessionLocal, User
from app.database.local_client import LocalClient

router = APIRouter()


@router.get("/me")
def get_admin(user: AuthenticatedUser = Depends(require_admin)) -> dict:
    return success_response(
        {
            "user_id": str(user.user_id),
            "profile_id": str(user.profile_id),
            "role": user.role,
            "foundation": "admin-access-verified",
        }
    )


@router.get("/dashboard")
def get_admin_dashboard(user: AuthenticatedUser = Depends(require_admin)) -> dict:
    client = LocalClient()
    with SessionLocal() as session:
        users = [serialize_user(row) for row in session.scalars(select(User)).all()]

    records = {table: client.table(table).select("*").execute().data or [] for table in (
        "profiles",
        "providers",
        "provider_equipment",
        "projects",
        "bookings",
        "slab_payments",
        "booking_reviews",
        "disputes",
        "notifications",
        "booking_status_history",
        "provider_booking_requests",
        "booking_assignments",
    )}

    customer_users = [row for row in users if row["role"] == "customer"]
    provider_users = [row for row in users if row["role"] == "provider"]
    bookings = sorted(records["bookings"], key=lambda row: row.get("starts_at", ""), reverse=True)
    payments = sorted(records["slab_payments"], key=lambda row: row.get("created_at", row.get("id", "")), reverse=True)
    providers = enrich_providers(provider_users, records)

    return success_response(
        {
            "stats": {
                "customers": len(customer_users),
                "providers": len(provider_users),
                "equipment": len(records["provider_equipment"]),
                "projects": len(records["projects"]),
                "bookings": len(bookings),
                "payments": len(payments),
                "open_disputes": len([row for row in records["disputes"] if row.get("status") not in {"resolved", "rejected"}]),
                "platform_revenue_inr": sum(int((row.get("amount_cents") or 0)) for row in payments if row.get("status") in {"succeeded", "success"}) / 100,
            },
            "customers": customer_users,
            "providers": providers,
            "equipment": records["provider_equipment"],
            "projects": records["projects"],
            "bookings": bookings,
            "payments": payments,
            "reviews": records["booking_reviews"],
            "disputes": records["disputes"],
            "notifications": sorted(records["notifications"], key=lambda row: row.get("created_at", ""), reverse=True),
            "activity": sorted(records["booking_status_history"], key=lambda row: row.get("created_at", ""), reverse=True),
            "requests": records["provider_booking_requests"],
            "assignments": records["booking_assignments"],
        }
    )


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def enrich_providers(provider_users: list[dict], records: dict[str, list[dict]]) -> list[dict]:
    provider_rows = {row.get("user_id"): row for row in records["providers"]}
    equipment = records["provider_equipment"]
    result = []
    for user in provider_users:
        provider = provider_rows.get(user["id"], {})
        result.append(
            {
                **user,
                **provider,
                "full_name": user["full_name"],
                "email": user["email"],
                "equipment_count": len([row for row in equipment if row.get("provider_user_id") == user["id"]]),
            }
        )
    return result

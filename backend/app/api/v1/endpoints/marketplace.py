from fastapi import APIRouter, Query

from app.core.responses import success_response
from app.database.client import get_public_database_client
from app.services.phase2_service import CATALOG

router = APIRouter()

CATEGORY_TYPES = {
    "excavators": {"excavator", "mini_excavator"},
    "jcb-backhoe": {"jcb_backhoe_loader", "mini_jcb", "skid_steer_loader", "wheel_loader", "loader", "jcb"},
    "cranes": {"hydra_crane", "mobile_truck_crane", "crawler_crane", "tower_crane", "rough_terrain_crane", "all_terrain_crane", "crane", "mobile_crane"},
    "tippers": {"mini_tipper", "standard_tipper", "heavy_tipper"},
    "septic-tank-services": {"septic_tank_service", "septic_tank_cleaning", "septic_tank_emptying", "septic_tank_waste_removal", "emergency_septic_service", "sewage_waste_transportation"},
}

INVENTORY_ALIASES = {
    "jcb": "jcb_backhoe_loader",
    "crane": "hydra_crane",
    "mobile_crane": "mobile_truck_crane",
    "tipper": "standard_tipper",
    "septic_service": "septic_tank_service",
    "septic_tank_emptying": "septic_tank_emptying",
    "emergency_septic_service": "emergency_septic_service",
}


def _provider_summary(provider: dict, profile: dict | None) -> dict:
    return {
        "id": provider.get("user_id"),
        "name": (profile or {}).get("full_name") or provider.get("company_name") or "SLAB verified provider",
        "company_name": provider.get("company_name"),
        "rating": provider.get("rating_average"),
        "rating_count": provider.get("rating_count"),
        "is_online": bool(provider.get("is_online")),
        "verification_status": provider.get("verification_status"),
    }


@router.get("/equipment")
def list_public_equipment(category: str | None = Query(default=None)) -> dict:
    requested_types = CATEGORY_TYPES.get(category, set()) if category else set(CATALOG)
    client = get_public_database_client()
    profiles = {row.get("user_id"): row for row in client.table("profiles").select("*").execute().data or []}
    providers = {row.get("user_id"): row for row in client.table("providers").select("*").eq("verification_status", "approved").execute().data or []}
    inventory = client.table("provider_equipment").select("*").eq("status", "available").execute().data or []

    rows = []
    for slug, (name, hourly_rate, daily_rate, catalog_category) in CATALOG.items():
        if slug not in requested_types or "legacy catalog alias" in name:
            continue
        matching_inventory = [
            item for item in inventory
            if INVENTORY_ALIASES.get(item.get("equipment_type_slug"), item.get("equipment_type_slug")) == slug
            and item.get("provider_user_id") in providers
        ]
        provider_summaries = []
        seen_provider_ids = set()
        for item in matching_inventory:
            provider_id = item["provider_user_id"]
            if provider_id in seen_provider_ids:
                continue
            seen_provider_ids.add(provider_id)
            provider_summaries.append(_provider_summary(providers[provider_id], profiles.get(provider_id)))
        rows.append({
            "slug": slug,
            "name": name,
            "category": catalog_category,
            "hourly_rate": float(hourly_rate),
            "daily_rate": float(daily_rate),
            "available_count": len(matching_inventory),
            "providers": provider_summaries,
        })
    return success_response(rows)

from math import asin, cos, radians, sin, sqrt
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.maps import Coordinate, MapSearchRequest, ReverseGeocodeRequest, RouteRequest


def haversine_km(origin: Coordinate, destination: Coordinate) -> float:
    radius = 6371.0
    dlat = radians(destination.latitude - origin.latitude)
    dlon = radians(destination.longitude - origin.longitude)
    lat1 = radians(origin.latitude)
    lat2 = radians(destination.latitude)
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * radius * asin(sqrt(a))


class MapsService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def search(self, payload: MapSearchRequest) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{self.settings.NOMINATIM_BASE_URL}/search",
                params={"q": payload.query, "format": "jsonv2", "limit": payload.limit, "addressdetails": 1},
                headers={"User-Agent": self.settings.MAPS_USER_AGENT},
            )
            response.raise_for_status()
            return response.json()

    async def reverse_geocode(self, payload: ReverseGeocodeRequest) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{self.settings.NOMINATIM_BASE_URL}/reverse",
                params={"lat": payload.latitude, "lon": payload.longitude, "format": "jsonv2", "addressdetails": 1},
                headers={"User-Agent": self.settings.MAPS_USER_AGENT},
            )
            response.raise_for_status()
            raw = response.json()
            address = raw.get("address", {})
            road = " ".join(filter(None, [address.get("house_number"), address.get("road")]))
            area = address.get("neighbourhood") or address.get("suburb") or address.get("village") or address.get("town") or ""
            city = address.get("city") or address.get("town") or address.get("municipality") or area
            return {
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "address": road or raw.get("display_name", ""),
                "area_locality": area,
                "city": city,
                "district": address.get("county") or address.get("district") or "",
                "state": address.get("state") or "",
                "postal_code": address.get("postcode") or "",
                "display_name": raw.get("display_name", ""),
            }

    async def route(self, payload: RouteRequest) -> dict[str, Any]:
        coords = (
            f"{payload.origin.longitude},{payload.origin.latitude};"
            f"{payload.destination.longitude},{payload.destination.latitude}"
        )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"{self.settings.OSRM_BASE_URL}/route/v1/driving/{coords}",
                    params={"overview": "full", "geometries": "geojson", "steps": "false"},
                )
                response.raise_for_status()
                route = response.json()["routes"][0]
                return {
                    "distance_km": round(route["distance"] / 1000, 2),
                    "duration_minutes": round(route["duration"] / 60),
                    "geometry": route.get("geometry"),
                    "source": "osrm",
                }
        except Exception:
            distance = haversine_km(payload.origin, payload.destination)
            return {
                "distance_km": round(distance, 2),
                "duration_minutes": round((distance / 35) * 60),
                "geometry": None,
                "source": "haversine_fallback",
            }


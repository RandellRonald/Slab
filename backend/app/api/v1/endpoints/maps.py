from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.responses import success_response
from app.schemas.maps import MapSearchRequest, NearestRequest, ReverseGeocodeRequest, RouteRequest
from app.services.maps_service import MapsService

router = APIRouter()


@router.get("/search")
async def search_get(
    query: str = Query(min_length=2, max_length=200),
    limit: int = Query(default=5, ge=1, le=10),
    _: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    return success_response(await MapsService().search(MapSearchRequest(query=query, limit=limit)))


@router.post("/search")
async def search(payload: MapSearchRequest, _: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return success_response(await MapsService().search(payload))


@router.get("/reverse-geocode")
async def reverse_geocode_get(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    _: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    return success_response(await MapsService().reverse_geocode(ReverseGeocodeRequest(latitude=latitude, longitude=longitude)))


@router.post("/reverse-geocode")
async def reverse_geocode(payload: ReverseGeocodeRequest, _: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return success_response(await MapsService().reverse_geocode(payload))


def _route_payload(origin_latitude: float, origin_longitude: float, destination_latitude: float, destination_longitude: float) -> RouteRequest:
    return RouteRequest(
        origin={"latitude": origin_latitude, "longitude": origin_longitude},
        destination={"latitude": destination_latitude, "longitude": destination_longitude},
    )


@router.get("/route")
async def route_get(
    origin_latitude: float = Query(ge=-90, le=90),
    origin_longitude: float = Query(ge=-180, le=180),
    destination_latitude: float = Query(ge=-90, le=90),
    destination_longitude: float = Query(ge=-180, le=180),
    _: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    return success_response(await MapsService().route(_route_payload(origin_latitude, origin_longitude, destination_latitude, destination_longitude)))


@router.post("/route")
async def route(payload: RouteRequest, _: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return success_response(await MapsService().route(payload))


@router.get("/distance")
async def distance_get(
    origin_latitude: float = Query(ge=-90, le=90),
    origin_longitude: float = Query(ge=-180, le=180),
    destination_latitude: float = Query(ge=-90, le=90),
    destination_longitude: float = Query(ge=-180, le=180),
    _: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    route_result = await MapsService().route(_route_payload(origin_latitude, origin_longitude, destination_latitude, destination_longitude))
    return success_response({"distance_km": route_result["distance_km"], "source": route_result["source"]})


@router.post("/distance")
async def distance(payload: RouteRequest, _: AuthenticatedUser = Depends(get_current_user)) -> dict:
    route_result = await MapsService().route(payload)
    return success_response({"distance_km": route_result["distance_km"], "source": route_result["source"]})


@router.get("/eta")
async def eta_get(
    origin_latitude: float = Query(ge=-90, le=90),
    origin_longitude: float = Query(ge=-180, le=180),
    destination_latitude: float = Query(ge=-90, le=90),
    destination_longitude: float = Query(ge=-180, le=180),
    _: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    route_result = await MapsService().route(_route_payload(origin_latitude, origin_longitude, destination_latitude, destination_longitude))
    return success_response({"duration_minutes": route_result["duration_minutes"], "source": route_result["source"]})


@router.post("/eta")
async def eta(payload: RouteRequest, _: AuthenticatedUser = Depends(get_current_user)) -> dict:
    route_result = await MapsService().route(payload)
    return success_response({"duration_minutes": route_result["duration_minutes"], "source": route_result["source"]})


@router.get("/nearest")
async def nearest_get(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=50, gt=0, le=500),
    _: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    payload = NearestRequest(latitude=latitude, longitude=longitude, radius_km=radius_km)
    return success_response({"origin": payload.model_dump(), "radius_km": payload.radius_km, "providers": []})


@router.post("/nearest")
async def nearest(payload: NearestRequest, _: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return success_response({"origin": payload.model_dump(), "radius_km": payload.radius_km, "providers": []})

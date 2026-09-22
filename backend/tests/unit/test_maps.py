from app.schemas.maps import Coordinate
from app.services.maps_service import haversine_km


def test_haversine_fallback_returns_reasonable_distance() -> None:
    origin = Coordinate(latitude=40.7128, longitude=-74.006)
    destination = Coordinate(latitude=40.7306, longitude=-73.9352)

    distance = haversine_km(origin, destination)

    assert 6 <= distance <= 7
